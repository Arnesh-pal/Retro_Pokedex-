// --- CRT TV SCRIPT ---
const tv = document.querySelector('.crt-tv');
const led = document.getElementById('powerLed');
const knob = document.getElementById('powerKnob');
const flash = document.getElementById('powerFlash');
let powered = true;
knob.addEventListener('click', () => {
    powered = !powered;
    tv.setAttribute('data-powered', powered ? 'on' : 'off');
    led.classList.toggle('on', powered);
    if (!powered) {
        flash.animate([{ opacity: .9, transform: 'scaleY(0.06)' }, { opacity: 0, transform: 'scaleY(0.01)' }], { duration: 260, easing: 'cubic-bezier(.22,.61,.36,1)' });
    } else {
        flash.animate([{ opacity: .0 }, { opacity: .35 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
    }
});
const screen = document.getElementById('crtScreen');
screen.addEventListener('mousemove', (e) => {
    if (!powered) return;
    const r = screen.getBoundingClientRect();
    const cx = (e.clientX - r.left) / r.width - 0.5;
    const cy = (e.clientY - r.top) / r.height - 0.5;
    screen.style.transform = `rotateX(${(-cy * 1.8).toFixed(2)}deg) rotateY(${(cx * 2.2).toFixed(2)}deg)`;
});
screen.addEventListener('mouseleave', () => { screen.style.transform = 'rotateX(0.5deg) rotateY(-0.6deg)'; });

// --- POKEDEX APPLICATION SCRIPT ---
const pokedexGrid = document.getElementById('pokedexGrid');
const searchInput = document.getElementById('searchInput');
const loader = document.getElementById('loader');
const pokemonModal = document.getElementById('pokemonModal');
const modalContainer = document.getElementById('modalContainer');
const generationSelector = document.getElementById('generationSelector');
const API_BASE_URL = 'http://localhost:3001';
let currentGenerationData = [], allPokemonForModal = {}, searchTimeout;

const fetchPokemonByGeneration = async (gen) => {
    loader.classList.remove('hidden');
    pokedexGrid.innerHTML = '';
    searchInput.value = '';
    try {
        const response = await fetch(`${API_BASE_URL}/api/pokemon/generation/${gen}`);
        const data = await response.json();
        currentGenerationData = data;
        displayPokemon(currentGenerationData);
    } catch (error) {
        pokedexGrid.innerHTML = `<p class="text-red-500 col-span-full text-center">Failed to load Pokémon. Is the backend running?</p>`;
    } finally {
        loader.classList.add('hidden');
    }
};

const displayPokemon = (pokemonList) => {
    pokedexGrid.innerHTML = '';
    pokemonList.forEach(pokemon => {
        if (!allPokemonForModal[pokemon.id]) allPokemonForModal[pokemon.id] = pokemon;
        const pokemonCard = document.createElement('div');
        pokemonCard.className = `pokemon-card`;
        pokemonCard.dataset.id = pokemon.id;
        let genNum;
        if (pokemon.id <= 151) genNum = 'I'; else if (pokemon.id <= 251) genNum = 'II'; else if (pokemon.id <= 386) genNum = 'III'; else if (pokemon.id <= 493) genNum = 'IV'; else if (pokemon.id <= 649) genNum = 'V'; else if (pokemon.id <= 721) genNum = 'VI'; else if (pokemon.id <= 809) genNum = 'VII'; else if (pokemon.id <= 905) genNum = 'VIII'; else genNum = 'IX';
        pokemonCard.innerHTML = `
            <div class="bg-black">${"GEN " + genNum}</div>
            <div class="flex-grow flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-baseline">
                        <h2 class="capitalize">${pokemon.name}</h2>
                        <span>#${String(pokemon.id).padStart(3, '0')}</span>
                    </div>
                    <div class="text-center">
                        <img src="${pokemon.imageUrl}" alt="${pokemon.name}" class="mx-auto">
                    </div>
                </div>
                <div>
                    <div class="text-center">${pokemon.types.map(type => `<span class="bg-black bg-opacity-20">${type}</span>`).join('')}</div>
                </div>
            </div>`;
        pokedexGrid.appendChild(pokemonCard);
    });
};

function animateStatBars() {
    setTimeout(() => {
        document.querySelectorAll('.stat-bar').forEach(bar => {
            bar.style.width = bar.dataset.value + '%';
        });
    }, 100);
}

const openModal = async (identifier) => {
    let pokemon;
    if (typeof identifier === 'number' && allPokemonForModal[identifier] && allPokemonForModal[identifier].moves) {
        pokemon = allPokemonForModal[identifier];
    } else {
        try {
            const endpoint = typeof identifier === 'string' ? `form/${identifier}` : `${identifier}`;
            const response = await fetch(`${API_BASE_URL}/api/pokemon/${endpoint}`);
            if (!response.ok) throw new Error('Pokémon not found');
            pokemon = await response.json();
            allPokemonForModal[pokemon.id] = pokemon;
        } catch (error) { return; }
    }

    const aboutContent = `<div class="grid grid-cols-3 gap-4 text-2xl"><span class="font-bold opacity-80">Species</span><span class="col-span-2 font-bold">${pokemon.species || '???'}</span><span class="font-bold opacity-80">Height</span><span class="col-span-2 font-bold">${(pokemon.height / 10).toFixed(1)} m</span><span class="font-bold opacity-80">Weight</span><span class="col-span-2 font-bold">${(pokemon.weight / 10).toFixed(1)} kg</span><span class="font-bold opacity-80">Abilities</span><span class="col-span-2 capitalize font-bold">${pokemon.abilities.join(', ')}</span></div>`;
    const statsContent = pokemon.stats.map(stat => `<div class="flex items-center gap-2"><span class="w-1/3 opacity-70 font-semibold capitalize text-lg">${stat.name.replace('-', ' ')}</span><span class="font-bold text-2xl w-8 text-right">${stat.value}</span><div class="w-2/3 flex items-center gap-2"><div class="w-full stat-bar-bg rounded-full h-2"><div class="stat-bar h-2 rounded-full" style="width: 0%;" data-value="${(stat.value / 255) * 100}"></div></div></div></div>`).join('');
    const evolutionContent = `<div id="evolutionChain" class="flex justify-start flex-wrap items-start gap-2 text-center overflow-x-auto"><div class="animate-spin rounded-full h-8 w-8 border-b-2"></div></div>`;
    const movesContent = `<div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-md max-h-64 overflow-y-auto pr-2">${pokemon.moves.map(move => `<span class="capitalize p-1 bg-gray-200 rounded">${move}</span>`).join('') || '<p class="col-span-full">None</p>'}</div>`;

    modalContainer.innerHTML = `<div><div class="p-6 rounded-t-3xl"><button id="closeModalBtn" class="absolute top-4 right-4 text-3xl leading-none">&times;</button><div class="flex justify-between items-center pr-16"><h2 class="font-bold text-4xl capitalize">${pokemon.name}</h2><span class="font-bold text-2xl">#${String(pokemon.id).padStart(3, '0')}</span></div><div class="mt-2">${pokemon.types.map(type => `<span class="inline-block bg-white bg-opacity-20 rounded-full px-3 py-1 text-lg font-semibold mr-2">${type}</span>`).join('')}</div><div class="relative h-32 mt-2"><img src="${pokemon.imageUrl}" alt="${pokemon.name}" class="absolute bottom-[-50px] left-1/2 -translate-x-1/2 w-48 h-48 drop-shadow-2xl"></div></div><div class="pt-20 px-6 pb-6"><div id="modalTabs" class="flex justify-around border-b mb-4 text-xl"><button class="modal-tab py-2 border-b-2 transition active" data-content="about">About</button><button class="modal-tab py-2 border-b-2 transition" data-content="stats">Stats</button><button class="modal-tab py-2 border-b-2 transition" data-content="evolution">Evo</button><button class="modal-tab py-2 border-b-2 transition" data-content="moves">Moves</button></div><div id="modalTabContent">${aboutContent}</div></div></div>`;

    document.body.classList.add('modal-open');
    pokemonModal.classList.remove('hidden');
    setTimeout(() => { modalContainer.classList.remove('scale-95'); }, 10);

    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('modalTabs').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-tab')) {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBStztvLHfEMTACFfqNq7jGEmABxQh7zGqIFQJwAXQnWwv6+HYSwAF0Bvq7u2lGcwABc8a6a5tIxqMQAYOmijt7WRbDMAFzhqpbizkWw0ABc4aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc3aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc4aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc3aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc4aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc3aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc4aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc3aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc4aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc3aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc4aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc3aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc4aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc3aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc4aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc3aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc4aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc3aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc4aqS3tJFsNAAXN2qkt7SRbDQAFzdqpLe0kWw0ABc3aqS3tJFsNAAXN2qkt7SRbDQAFzY=');
            audio.volume = 0.1;
            audio.play().catch(() => { });
            const contentKey = e.target.dataset.content;
            document.querySelectorAll('.modal-tab').forEach(tab => tab.classList.remove('active'));
            e.target.classList.add('active');
            const contentContainer = document.getElementById('modalTabContent');
            if (contentKey === 'about') contentContainer.innerHTML = aboutContent;
            if (contentKey === 'stats') {
                contentContainer.innerHTML = statsContent;
                animateStatBars();
            }
            if (contentKey === 'evolution') {
                contentContainer.innerHTML = evolutionContent;
                fetchAndDisplayEvolutions(pokemon.id);
            }
            if (contentKey === 'moves') contentContainer.innerHTML = movesContent;
        }
    });
};

const fetchAndDisplayEvolutions = async (id) => {
    const evoContainer = document.getElementById('evolutionChain');
    evoContainer.innerHTML = `<div class="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"></div>`;
    try {
        const response = await fetch(`${API_BASE_URL}/api/pokemon/evolution/${id}`);
        const tree = await response.json();
        if (!tree.evolves_to || tree.evolves_to.length === 0) {
            evoContainer.innerHTML = '<p>This Pokémon does not evolve.</p>';
            return;
        }
        evoContainer.innerHTML = createEvolutionHTML(tree);
    } catch (error) { evoContainer.innerHTML = `<p class="text-sm">Could not load evolution data.</p>`; }
};

const createEvolutionHTML = (node) => {
    if (!node) return '';
    const nodeHTML = `<div class="form-item text-center cursor-pointer" data-id="${node.id}"><img src="${node.imageUrl}" alt="${node.name}" class="w-24 h-24 mx-auto drop-shadow-lg transition-transform hover:scale-110"><p class="text-lg capitalize font-semibold mt-1">${node.name}</p></div>`;
    let evolutionsHTML = '';
    if (node.evolves_to && node.evolves_to.length > 0) {
        const branchesHTML = node.evolves_to.map(evo => `<div class="flex items-center"><div class="flex flex-col items-center text-center mx-4"><span class="text-2xl font-light">&rarr;</span><span class="text-sm capitalize">${evo.trigger}</span></div>${createEvolutionHTML(evo)}</div>`).join('');
        evolutionsHTML = `<div class="flex flex-col pl-8 gap-4">${branchesHTML}</div>`;
    }
    return `<div class="flex items-center">${nodeHTML}${evolutionsHTML}</div>`;
};

const closeModal = () => {
    modalContainer.classList.add('scale-95');
    setTimeout(() => {
        pokemonModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }, 300);
};

const handleSearch = async () => {
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm.length < 2) {
        displayPokemon(currentGenerationData);
        return;
    }
    loader.classList.remove('hidden');
    pokedexGrid.innerHTML = '';
    try {
        const response = await fetch(`${API_BASE_URL}/api/pokemon/search/${searchTerm}`);
        const data = await response.json();
        displayPokemon(data);
    } catch (error) {
        pokedexGrid.innerHTML = `<p class="col-span-full text-center">Search failed.</p>`;
    } finally {
        loader.classList.add('hidden');
    }
};

generationSelector.addEventListener('click', (e) => {
    if (e.target.classList.contains('gen-btn')) {
        document.querySelectorAll('.gen-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        fetchPokemonByGeneration(e.target.dataset.gen);
    }
});

searchInput.addEventListener('keyup', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(handleSearch, 300); });

document.addEventListener('click', (e) => {
    const pokemonCard = e.target.closest('.pokemon-card');
    if (pokemonCard) { openModal(parseInt(pokemonCard.dataset.id)); return; }
    const formItem = e.target.closest('.form-item');
    if (formItem) { openModal(parseInt(formItem.dataset.id)); return; }
    if (e.target.id === 'pokemonModal') { closeModal(); }
});

fetchPokemonByGeneration(1);