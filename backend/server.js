// server.js
// The definitive backend, updated to fetch all data for the new "About" tab design.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const generationCache = {};
const typeCache = {};
let masterPokemonList = [];
let isMasterListReady = false;

app.use(cors());
app.use(express.json());

const getIdFromUrl = (url) => url.split('/').filter(Boolean).pop();

const getTypeData = async (typeName) => {
    if (typeCache[typeName]) return typeCache[typeName];
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/type/${typeName}`);
        const relations = response.data.damage_relations;
        typeCache[typeName] = relations;
        return relations;
    } catch (error) {
        console.error(`Failed to fetch type data for ${typeName}`);
        return null;
    }
};

const getFormDetails = async (formUrl) => {
    try {
        const response = await axios.get(formUrl);
        const data = response.data;

        let finalName = data.name.replace(/-/g, ' ');
        if (finalName.includes('mega')) {
            const parts = finalName.split(' ');
            finalName = `Mega ${parts[0]} ${parts.slice(2).join(' ')}`.trim();
        } else {
            finalName = finalName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }

        return {
            name: finalName,
            rawName: data.name,
            imageUrl: data.sprites.other['official-artwork'].front_default,
            types: data.types.map(t => t.type.name),
        };
    } catch (error) { return null; }
};

const getPokemonDetails = async (pokemonIdentifier, generation = null) => {
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonIdentifier}`);
        const data = response.data;

        const matchups = { weaknesses: new Set(), strengths: new Set(), resistances: new Set(), immunities: new Set() };
        const typeRelations = await Promise.all(data.types.map(t => getTypeData(t.type.name)));
        for (const relations of typeRelations) {
            if (!relations) continue;
            relations.double_damage_from.forEach(t => matchups.weaknesses.add(t.name));
            relations.double_damage_to.forEach(t => matchups.strengths.add(t.name));
            relations.half_damage_from.forEach(t => matchups.resistances.add(t.name));
            relations.no_damage_from.forEach(t => matchups.immunities.add(t.name));
        }

        let megaEvolutions = [];
        let regionalForms = [];
        let speciesData = {};

        if (!String(pokemonIdentifier).includes('-')) {
            try {
                const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${data.id}`);
                const speciesInfo = speciesResponse.data;
                const formVarieties = speciesInfo.varieties.filter(v => !v.is_default);
                const megaVarieties = formVarieties.filter(v => v.pokemon.name.includes('-mega'));
                const regionalVarieties = formVarieties.filter(v => ['-alola', '-galar', '-hisui', '-paldea'].some(region => v.pokemon.name.includes(region)));
                if (megaVarieties.length > 0) megaEvolutions = await Promise.all(megaVarieties.map(v => getFormDetails(v.pokemon.url)));
                if (regionalVarieties.length > 0) regionalForms = await Promise.all(regionalVarieties.map(v => getFormDetails(v.pokemon.url)));

                speciesData = {
                    species: (speciesInfo.genera.find(g => g.language.name === 'en') || {}).genus || 'Unknown',
                    genderRate: speciesInfo.gender_rate,
                    eggGroups: speciesInfo.egg_groups.map(eg => eg.name),
                    hatchCounter: speciesInfo.hatch_counter,
                };

            } catch (speciesError) { console.log(`No species data for ${data.name}, skipping forms.`); }
        }

        let finalName;
        if (data.name.includes('-')) {
            finalName = data.name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            if (finalName.includes('Mega')) {
                const parts = finalName.split(' ');
                finalName = `Mega ${parts[0]} ${parts.slice(2).join(' ')}`.trim();
            }
        } else {
            finalName = data.name.charAt(0).toUpperCase() + data.name.slice(1);
        }

        const moves = data.moves.map(moveData => moveData.move.name.replace(/-/g, ' ')).sort();

        return {
            id: data.id,
            name: finalName,
            imageUrl: data.sprites.other['official-artwork'].front_default,
            types: data.types.map(t => t.type.name),
            height: data.height, weight: data.weight,
            stats: data.stats.map(s => ({ name: s.stat.name, value: s.base_stat })),
            abilities: data.abilities.map(a => a.ability.name),
            generation,
            matchups: { weaknesses: [...matchups.weaknesses], strengths: [...matchups.strengths], resistances: [...matchups.resistances], immunities: [...matchups.immunities] },
            megaEvolutions: megaEvolutions.filter(m => m !== null),
            regionalForms: regionalForms.filter(r => r !== null),
            moves: moves,
            ...speciesData
        };
    } catch (error) { return null; }
};

const getEvolutionPokemonInfo = async (pokemonId) => {
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        const data = response.data;
        return { id: data.id, name: data.name.charAt(0).toUpperCase() + data.name.slice(1), imageUrl: data.sprites.other['official-artwork'].front_default };
    } catch (error) { return null; }
};

const initializeMasterList = async () => {
    console.log('Initializing master Pokémon list (this will take a minute)...');
    try {
        const listResponse = await axios.get('https://pokeapi.co/api/v2/pokemon-species?limit=1100');
        const promises = listResponse.data.results.map(species => getPokemonDetails(getIdFromUrl(species.url)));
        const allDetails = await Promise.all(promises);
        masterPokemonList = allDetails.filter(p => p !== null).sort((a, b) => a.id - b.id);
        isMasterListReady = true;
        console.log(`Master list initialized with ${masterPokemonList.length} Pokémon!`);
    } catch (error) { console.error('Failed to initialize master Pokémon list:', error.message); }
};

// server.js

const parseEvolutionChain = (chainNode) => {
    if (!chainNode) return null;

    const getTrigger = (details) => {
        if (!details || details.length === 0) return '';
        const detail = details[0];
        let triggerText = `${detail.trigger.name.replace('-', ' ')}`;
        if (detail.min_level) triggerText += ` ${detail.min_level}`;
        if (detail.item) triggerText += ` w/ ${detail.item.name.replace('-', ' ')}`;
        if (detail.held_item) triggerText += ` holding ${detail.held_item.name.replace('-', ' ')}`;
        if (detail.known_move) triggerText += ` knowing ${detail.known_move.name.replace('-', ' ')}`;
        if (detail.min_happiness) triggerText += ` w/ high happiness`;
        if (detail.time_of_day) triggerText += ` at ${detail.time_of_day}`;
        return `(${triggerText})`;
    };

    const evolution = {
        id: getIdFromUrl(chainNode.species.url),
        name: chainNode.species.name,
        trigger: getTrigger(chainNode.evolution_details),
        evolves_to: chainNode.evolves_to.map(parseEvolutionChain) // Recursively parse children
    };

    return evolution;
};

// --- API Routes ---
app.get('/api/pokemon/form/:name', async (req, res) => {
    const pokemonDetails = await getPokemonDetails(req.params.name);
    if (pokemonDetails) res.json(pokemonDetails);
    else res.status(404).json({ message: 'Pokémon form not found.' });
});

app.get('/api/pokemon/:id', async (req, res) => {
    const pokemonDetails = await getPokemonDetails(req.params.id);
    if (pokemonDetails) res.json(pokemonDetails);
    else res.status(404).json({ message: 'Pokémon not found.' });
});

app.get('/api/pokemon/generation/:gen', async (req, res) => {
    const { gen } = req.params;
    const cacheKey = `pokemon_gen_${gen}`;
    if (generationCache[cacheKey]) return res.json(generationCache[cacheKey]);
    try {
        const genResponse = await axios.get(`https://pokeapi.co/api/v2/generation/${gen}`);
        const promises = genResponse.data.pokemon_species.map(s => getPokemonDetails(getIdFromUrl(s.url), parseInt(gen)));
        const results = await Promise.all(promises);
        const successfulFetches = results.filter(p => p !== null).sort((a, b) => a.id - b.id);
        generationCache[cacheKey] = successfulFetches;
        res.json(successfulFetches);
    } catch (error) { res.status(500).json({ message: `Failed to fetch data for Gen ${gen}.` }); }
});

app.get('/api/pokemon/search/:query', (req, res) => {
    if (!isMasterListReady) return res.status(503).json({ message: 'Search is initializing...' });
    const results = masterPokemonList.filter(p => p.name.toLowerCase().includes(req.params.query.toLowerCase()) || String(p.id).includes(req.params.query));
    res.json(results);
});

// server.js

app.get('/api/pokemon/evolution/:id', async (req, res) => {
    try {
        const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${req.params.id}`);
        const evolutionResponse = await axios.get(speciesResponse.data.evolution_chain.url);

        // This function will fetch images for the entire tree
        const addImagesToChain = async (node) => {
            if (!node) return null;
            const pokemonInfo = await getEvolutionPokemonInfo(node.id);
            node.imageUrl = pokemonInfo ? pokemonInfo.imageUrl : '';
            node.name = pokemonInfo ? pokemonInfo.name : node.name;
            // Recursively add images for all children
            if (node.evolves_to && node.evolves_to.length > 0) {
                for (let i = 0; i < node.evolves_to.length; i++) {
                    node.evolves_to[i] = await addImagesToChain(node.evolves_to[i]);
                }
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

app.listen(PORT, () => {
    console.log(`Pokédex backend server is running on http://localhost:${PORT}`);
    initializeMasterList();
});
