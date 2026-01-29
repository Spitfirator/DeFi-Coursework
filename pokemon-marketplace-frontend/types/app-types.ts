export interface PokemonData {
    tokenId: bigint | string;
    name: string;
    ptype: string;
    rarity: number; // 0: Common, 1: Rare, 2: Legendary
    level: number;
}

export interface ListingData {
    seller: string;
    price: bigint;
}

export interface AuctionData {
    seller: string;
    startingPrice: bigint;
    endTime: bigint;
    highestBid: bigint;
    highestBidder: string;
    active: boolean;
}

export interface DutchAuctionData {
    seller: string;
    startPrice: bigint;
    endPrice: bigint;
    startTime: bigint;
    duration: bigint;
    active: boolean;
}

export type SaleType = 'fixed' | 'auction' | 'dutch' | 'none';

export interface MarketplaceItem {
    pokemon: PokemonData;
    saleType: SaleType;
    listing?: ListingData;
    auction?: AuctionData;
    dutchAuction?: DutchAuctionData;
    imageUri: string;
    owner: string;
}
