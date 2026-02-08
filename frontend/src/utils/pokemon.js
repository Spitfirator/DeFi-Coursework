
export const pokemonToPokedexId = {
    'Mewtwo': 150, 'Lugia': 249, 'Rayquaza': 384, 'Arceus': 493, 'Giratina': 487,
    'Charizard': 6, 'Blastoise': 9, 'Venusaur': 3, 'Gengar': 94, 'Dragonite': 149,
    'Gyarados': 130, 'Alakazam': 65, 'Machamp': 68, 'Snorlax': 143, 'Arcanine': 59,
    'Lapras': 131, 'Tyranitar': 248, 'Metagross': 376, 'Salamence': 373, 'Garchomp': 445,
    'Pikachu': 25, 'Bulbasaur': 1, 'Charmander': 4, 'Squirtle': 7, 'Pidgey': 16,
    'Rattata': 19, 'Zubat': 41, 'Geodude': 74, 'Magikarp': 129, 'Caterpie': 10,
    'Eevee': 133, 'Jigglypuff': 39, 'Psyduck': 54, 'Growlithe': 58, 'Oddish': 43
};

export const getPokemonImageUrl = (name) => {
    const pokedexId = pokemonToPokedexId[name];
    if (pokedexId) {
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokedexId}.png`;
    }
    return null;
};
