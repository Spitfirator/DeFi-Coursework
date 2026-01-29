import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ethers } from 'ethers';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Resolves an IPFS URI to an accessible HTTP URL
 */
export function resolveIPFS(uri: string): string {
    if (!uri) return '/placeholder_pokemon.png';

    // If already an HTTP URL, return as-is
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
        return uri;
    }

    // Handle ipfs:// protocol
    if (uri.startsWith('ipfs://')) {
        const hash = uri.replace('ipfs://', '');
        const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
        return `${gateway}${hash}`;
    }

    return uri;
}

/**
 * Format Wei to Ether string
 */
export function formatEther(wei: bigint): string {
    return ethers.formatEther(wei);
}
