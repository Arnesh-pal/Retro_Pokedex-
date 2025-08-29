// server.js
// Updated to be more efficient for a hosting environment.
// It now fetches the master list on the first search instead of on startup.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
// Render provides the PORT environment variable.
const PORT = process.env.PORT || 3001;

// Caches for data we've already fetched.
const generationCache = {};
const pokemonDetailCache = {}; // Cache for individual pokemon details
let masterPokemonList = []; // Will be populated on the first search.

const corsOptions = {
    origin: 'https://pokedex03.netlify.app', // Your Netlify frontend URL
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

const getIdFromUrl = (url) => url.split('/').filter(Boolean).pop();

// A simplified details fetcher. It will cache results.
const getPokemonDetails = async (pokemonIdentifier) => {
    const identifier = String(pokemonIdentifier).toLowerCase();
    if (pokemonDetailCache[identifier]) {
        return pokemonDetailCache[identifier];
    }
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${identifier}`);
        const data = response.data;

        const details = {
            id: data.id,
            name: data.name,
            imageUrl: data.sprites.other['official-artwork'].front_default,
            types: data.types.map(t => t.type.name),
            height: data.height,
            weight: data.weight,
            stats: data.stats.map(s => ({ name: s.stat.name, value: s.base_stat })),
            abilities: data.abilities.map(a => a.ability.name.replace(/-/g, ' ')),
            moves: data.moves.map(m => m.move.name.replace(/-/g, ' ')).sort(),
        };

        // Add to cache
        pokemonDetailCache[identifier] = details;
        return details;
    } catch (error) {
        console.error(`Failed to get details for: ${identifier}`, error.message);
        return null;
    }
};

const getEvolutionPokemonInfo = async (pokemonId) => {
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        const data = response.data;
        return {
            id: data.id,
            name: data.name,
            imageUrl: data.sprites.other['official-artwork'].front_default
        };
    } catch (error) { return null; }
};

const parseEvolutionChain = (chainNode) => {
    if (!chainNode) return null;
    const getTrigger = (details) => {
        if (!details || details.length === 0) return '';
        const detail = details[0];
        let triggerText = `${detail.trigger.name.replace('-', ' ')}`;
        if (detail.min_level) triggerText += ` Lvl ${detail.min_level}`;
        if (detail.item) triggerText += ` w/ ${detail.item.name.replace('-', ' ')}`;
        if (detail.held_item) triggerText += ` holding ${detail.held_item.name.replace('-', ' ')}`;
        return `(${triggerText})`;
    };
    return {
        id: getIdFromUrl(chainNode.species.url),
        name: chainNode.species.name,
        trigger: getTrigger(chainNode.evolution_details),
        evolves_to: chainNode.evolves_to.map(parseEvolutionChain)
    };
};


// --- API Routes ---

app.get('/api/pokemon/generation/:gen', async (req, res) => {
    const { gen } = req.params;
    const cacheKey = `gen_${gen}`;
    if (generationCache[cacheKey]) {
        return res.json(generationCache[cacheKey]);
    }
    try {
        const genResponse = await axios.get(`https://pokeapi.co/api/v2/generation/${gen}`);
        const promises = genResponse.data.pokemon_species.map(s => getPokemonDetails(s.name));
        const results = (await Promise.all(promises)).filter(p => p !== null).sort((a, b) => a.id - b.id);
        generationCache[cacheKey] = results;
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: `Failed to fetch data for Gen ${gen}.` });
    }
});

app.get('/api/pokemon/search/:query', async (req, res) => {
    // If the master list is empty, fetch it for the first time.
    if (masterPokemonList.length === 0) {
        console.log('First search triggered. Initializing master Pokémon list...');
        try {
            const listResponse = await axios.get('https://pokeapi.co/api/v2/pokemon-species?limit=1500');
            masterPokemonList = listResponse.data.results.map(pokemon => ({
                name: pokemon.name,
                id: getIdFromUrl(pokemon.url)
            }));
            console.log(`Master list initialized with ${masterPokemonList.length} Pokémon!`);
        } catch (error) {
            console.error('Failed to initialize master Pokémon list:', error.message);
            return res.status(503).json({ message: 'Failed to build search index. Please try again in a moment.' });
        }
    }

    // Perform the search on the now-populated list.
    const query = req.params.query.toLowerCase();
    const results = masterPokemonList.filter(p => p.name.includes(query) || String(p.id).includes(query));

    // We only have names and IDs, so now we fetch full details for just the results.
    const detailedResults = await Promise.all(results.slice(0, 50).map(p => getPokemonDetails(p.name))); // Limit to 50 results
    res.json(detailedResults.filter(p => p !== null));
});


app.get('/api/pokemon/evolution/:id', async (req, res) => {
    try {
        const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${req.params.id}`);
        const evolutionResponse = await axios.get(speciesResponse.data.evolution_chain.url);

        const addImagesToChain = async (node) => {
            if (!node) return null;
            const pokemonInfo = await getEvolutionPokemonInfo(node.id);
            if (pokemonInfo) {
                node.imageUrl = pokemonInfo.imageUrl;
                node.name = pokemonInfo.name;
            }
            if (node.evolves_to && node.evolves_to.length > 0) {
                node.evolves_to = await Promise.all(node.evolves_to.map(addImagesToChain));
            }
            return node;
        };

        const evolutionTree = parseEvolutionChain(evolutionResponse.data.chain);
        const evolutionTreeWithImages = await addImagesToChain(evolutionTree);
        res.json(evolutionTreeWithImages);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch evolution data.' });
    }
});

// This route must be last to catch requests for full details.
app.get('/api/pokemon/:id', async (req, res) => {
    const pokemonDetails = await getPokemonDetails(req.params.id);
    if (pokemonDetails) {
        res.json(pokemonDetails);
    } else {
        res.status(404).json({ message: 'Pokémon not found.' });
    }
});


app.listen(PORT, () => {
    // The server is now ready to listen on the port Render provides.
    console.log(`Pokédex backend server is running on port ${PORT}`);
});
