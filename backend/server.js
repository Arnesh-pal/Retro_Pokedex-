// server.js
// Final version with the Species data fix.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const generationCache = {};
const pokemonDetailCache = {};
let masterPokemonList = [];

const corsOptions = {
    origin: 'https://pokedex03.netlify.app', // Your Netlify frontend URL
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

const getIdFromUrl = (url) => url.split('/').filter(Boolean).pop();

// This function now ONLY gets the basic details from the main /pokemon/ endpoint.
const getBasePokemonDetails = async (identifier) => {
    const lowerId = String(identifier).toLowerCase();
    if (pokemonDetailCache[lowerId] && pokemonDetailCache[lowerId].species) {
        return pokemonDetailCache[lowerId]; // Return from cache if we have full details
    }
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${lowerId}`);
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
        // Store base details in cache
        pokemonDetailCache[lowerId] = details;
        return details;
    } catch (error) {
        console.error(`Failed to get base details for: ${lowerId}`, error.message);
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
        const promises = genResponse.data.pokemon_species.map(s => getBasePokemonDetails(s.name));
        const results = (await Promise.all(promises)).filter(p => p !== null).sort((a, b) => a.id - b.id);
        generationCache[cacheKey] = results;
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: `Failed to fetch data for Gen ${gen}.` });
    }
});

app.get('/api/pokemon/search/:query', async (req, res) => {
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
            return res.status(503).json({ message: 'Failed to build search index.' });
        }
    }

    const query = req.params.query.toLowerCase();
    const results = masterPokemonList.filter(p => p.name.includes(query) || String(p.id).includes(query));

    const detailedResults = await Promise.all(results.slice(0, 50).map(p => getBasePokemonDetails(p.name)));
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

// This is the main route for getting FULL details for the modal.
app.get('/api/pokemon/:id', async (req, res) => {
    const identifier = String(req.params.id).toLowerCase();

    // First, get the base details (from cache or API)
    let pokemonDetails = await getBasePokemonDetails(identifier);
    if (!pokemonDetails) {
        return res.status(404).json({ message: 'Pokémon not found.' });
    }

    // If we don't have species data yet, fetch it now.
    if (!pokemonDetails.species) {
        try {
            const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${pokemonDetails.id}`);
            const speciesData = speciesResponse.data;

            // Find the English genus entry.
            const genusEntry = speciesData.genera.find(g => g.language.name === 'en');
            const speciesName = genusEntry ? genusEntry.genus.replace(' Pokémon', '') : 'Unknown';

            // Merge the new data into our existing object
            pokemonDetails.species = speciesName;

            // Update the cache with the full details
            pokemonDetailCache[identifier] = pokemonDetails;

        } catch (error) {
            console.error(`Failed to get species data for: ${identifier}`, error.message);
            // Even if this fails, we can still send the base data.
            pokemonDetails.species = 'Unknown';
        }
    }

    res.json(pokemonDetails);
});

app.listen(PORT, () => {
    console.log(`Pokédex backend server is running on port ${PORT}`);
});
