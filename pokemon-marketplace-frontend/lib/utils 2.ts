import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Resolves an IPFS URI to an accessible HTTP URL
 * For local development, serves from /nft_metadata/ directory
 */
export function resolveIPFS(uri: string): string {
    if (!uri) return '/placeholder_pokemon.png';

    // If already an HTTP URL, return as-is
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
        return uri;
    }

    export function formatEther(wei: any): string {
        // Basic wrapper, real app might use ethers.formatEther
        // We will import ethers where needed
        return "0.0";
    }
