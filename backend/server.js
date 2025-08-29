// server.js
// Final refactored version to ensure all data, including species, is fetched reliably.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// A single cache for fully detailed Pokémon objects.
const pokemonDetailCache = {};
let masterPokemonList = []; // For search functionality.

const corsOptions = {
    origin: 'https://pokedex03.netlify.app', // Your Netlify frontend URL
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Health Check Endpoint for UptimeRobot
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is healthy.' });
});

const getIdFromUrl = (url) => url.split('/').filter(Boolean).pop();

/**
 * The single, authoritative function to get ALL details for a Pokémon.
 * It fetches from both the main pokemon and the species endpoints,
 * combines them, and caches the complete result.
 */
const getFullPokemonDetails = async (identifier) => {
    const lowerId = String(identifier).toLowerCase();

    // If we have a fully detailed object in cache, return it immediately.
    if (pokemonDetailCache[lowerId]) {
        return pokemonDetailCache[lowerId];
    }

    try {
        // Fetch both sets of data in parallel for speed.
        const pokemonPromise = axios.get(`https://pokeapi.co/api/v2/pokemon/${lowerId}`);
        const speciesPromise = axios.get(`https://pokeapi.co/api/v2/pokemon-species/${lowerId}`);

        const [pokemonResponse, speciesResponse] = await Promise.all([pokemonPromise, speciesPromise]);

        const pokemonData = pokemonResponse.data;
        const speciesData = speciesResponse.data;

        // Find the English "genus" (which we call Species).
        const genusEntry = speciesData.genera.find(g => g.language.name === 'en');
        const speciesName = genusEntry ? genusEntry.genus.replace(' Pokémon', '') : 'Unknown';

        const fullDetails = {
            id: pokemonData.id,
            name: pokemonData.name,
            imageUrl: pokemonData.sprites.other['official-artwork'].front_default,
            types: pokemonData.types.map(t => t.type.name),
            height: pokemonData.height,
            weight: pokemonData.weight,
            stats: pokemonData.stats.map(s => ({ name: s.stat.name, value: s.base_stat })),
            abilities: pokemonData.abilities.map(a => a.ability.name.replace(/-/g, ' ')),
            moves: pokemonData.moves.map(m => m.move.name.replace(/-/g, ' ')).sort(),
            species: speciesName, // The corrected species data!
        };

        // Cache the complete object.
        pokemonDetailCache[lowerId] = fullDetails;
        return fullDetails;

    } catch (error) {
        console.error(`Failed to get full details for: ${lowerId}`, error.message);
        return null; // Return null if any API call fails.
    }
};

const getEvolutionPokemonInfo = async (pokemonId) => {
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        return {
            id: response.data.id,
            name: response.data.name,
            imageUrl: response.data.sprites.other['official-artwork'].front_default
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
    try {
        const genResponse = await axios.get(`https://pokeapi.co/api/v2/generation/${req.params.gen}`);
        const promises = genResponse.data.pokemon_species.map(s => getFullPokemonDetails(s.name));
        const results = (await Promise.all(promises)).filter(p => p !== null).sort((a, b) => a.id - b.id);
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: `Failed to fetch data for Gen ${req.params.gen}.` });
    }
});

app.get('/api/pokemon/search/:query', async (req, res) => {
    if (masterPokemonList.length === 0) {
        try {
            const listResponse = await axios.get('https://pokeapi.co/api/v2/pokemon-species?limit=1500');
            masterPokemonList = listResponse.data.results.map(p => ({ name: p.name, id: getIdFromUrl(p.url) }));
        } catch (error) {
            return res.status(503).json({ message: 'Failed to build search index.' });
        }
    }
    const query = req.params.query.toLowerCase();
    const results = masterPokemonList.filter(p => p.name.includes(query) || String(p.id).includes(query));
    const detailedResults = await Promise.all(results.slice(0, 50).map(p => getFullPokemonDetails(p.name)));
    res.json(detailedResults.filter(p => p !== null));
});

app.get('/api/pokemon/evolution/:id', async (req, res) => {
    try {
        const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${req.params.id}`);
        const evolutionResponse = await axios.get(speciesResponse.data.evolution_chain.url);
        const addImagesToChain = async (node) => {
            if (!node) return null;
            const info = await getEvolutionPokemonInfo(node.id);
            if (info) {
                node.imageUrl = info.imageUrl;
                node.name = info.name;
            }
            node.evolves_to = await Promise.all(node.evolves_to.map(addImagesToChain));
            return node;
        };
        const tree = parseEvolutionChain(evolutionResponse.data.chain);
        res.json(await addImagesToChain(tree));
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch evolution data.' });
    }
});

// This route now simply calls our main function.
app.get('/api/pokemon/:id', async (req, res) => {
    const pokemonDetails = await getFullPokemonDetails(req.params.id);
    if (pokemonDetails) {
        res.json(pokemonDetails);
    } else {
        res.status(444).json({ message: 'Pokémon not found.' });
    }
});

app.listen(PORT, () => {
    console.log(`Pokédex backend server is running on port ${PORT}`);
});
