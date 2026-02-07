import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { PokemonData } from '../types/app-types';
import { resolveIPFS } from '../lib/utils';
import Image from 'next/image';
import { Button } from './ui/Button';
import Link from 'next/link';

interface PokemonCardProps {
    pokemon: PokemonData;
    imageUri?: string; // If we already fetched metadata
    children?: React.ReactNode; // For actions
}

export function PokemonCard({ pokemon, imageUri, children }: PokemonCardProps) {
    const getRarityLabel = (rarity: number) => {
        if (rarity === 5) return 'Legendary';
        if (rarity === 4) return 'Rare';
        return 'Common';
    };

    const getRarityVariant = (rarity: number) => {
        if (rarity === 5) return 'legendary';
        if (rarity === 4) return 'rare';
        return 'common';
    };

    // Note: imageUri now contains the direct PokeAPI URL from metadata
    const displayImage = imageUri || '/placeholder-pokemon.png';


    return (
        <Card className="w-full max-w-sm overflow-hidden hover:scale-105 transition-transform duration-300">
            <Link href={`/nft/${pokemon.tokenId}`} className="block">
                <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-4">
                    {imageUri ? (
                        <img
                            src={displayImage}
                            alt={pokemon.name}
                            className="object-contain w-full h-full drop-shadow-xl"
                            loading="lazy"
                        />
                    ) : (
                        <div className="text-gray-400">Loading Image...</div>
                    )}
                    <div className="absolute top-2 right-2">
                        <Badge variant={getRarityVariant(pokemon.rarity)}>
                            {getRarityLabel(pokemon.rarity)}
                        </Badge>
                    </div>
                    <div className="absolute top-2 left-2">
                        <span className="px-2 py-1 bg-black/50 text-white rounded text-xs font-mono">
                            #{pokemon.tokenId.toString()}
                        </span>
                    </div>
                </div>

                <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle>{pokemon.name}</CardTitle>
                        <div className="text-sm font-bold text-gray-500">
                            Lvl {pokemon.level}
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="uppercase text-[10px]">
                            {pokemon.ptype}
                        </Badge>
                    </div>
                </CardHeader>
            </Link>

            <CardFooter className="p-4 pt-2 flex flex-col gap-2">
                {children}
            </CardFooter>
        </Card>
    );
}
