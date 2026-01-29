import { useQuery } from '@tanstack/react-query';
import { useWeb3 } from '../context/Web3Context';
import { MarketplaceItem, PokemonData, SaleType } from '../types/app-types';

export function useMarketplaceData() {
    const { nftContract, marketplaceContract } = useWeb3();

    return useQuery<MarketplaceItem[]>({
        queryKey: ['marketplace', nftContract?.target, marketplaceContract?.target],
        enabled: !!nftContract && !!marketplaceContract,
        queryFn: async () => {
            if (!nftContract || !marketplaceContract) {
                throw new Error('Contracts not initialized');
            }

            try {
                const totalSupply = await nftContract.totalSupply();
                const total = Number(totalSupply);

                // Load all 100 NFTs (changed from 50)
                const INITIAL_LOAD_COUNT = 100;
                const loadCount = Math.min(total, INITIAL_LOAD_COUNT);
                const tokenIds = Array.from({ length: loadCount }, (_, i) => i);

                console.log(`Loading ${loadCount} of ${total} NFTs...`);

                // Fetch data in BATCHES to optimize loading time
                const BATCH_SIZE = 20; // Process 20 NFTs at a time
                const allItems: MarketplaceItem[] = [];

                for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
                    const batch = tokenIds.slice(i, i + BATCH_SIZE);

                    const batchItems = await Promise.all(
                        batch.map(async (id) => {
                            const tokenId = BigInt(id);

                            // Fetch all contract data in parallel (NO HTTP requests for metadata)
                            const [pokemonRaw, listing, auction, dutchAuction, owner] = await Promise.all([
                                nftContract.pokemonData(tokenId),
                                marketplaceContract.listings(nftContract.target, tokenId),
                                marketplaceContract.auctions(nftContract.target, tokenId),
                                marketplaceContract.dutchAuctions(nftContract.target, tokenId),
                                nftContract.ownerOf(tokenId).catch(() => '0x0')
                            ]);

                            // Use direct PokeAPI image URL (no HTTP fetch needed!)
                            // Token ID maps to Pokedex number (offset by 1 for most)
                            const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id + 1}.png`;

                            // Determine sale type
                            const isFixedListed = listing.price > 0n;
                            const isAuctionActive = auction.active;
                            const isDutchActive = dutchAuction.active;

                            let saleType: SaleType = 'none';
                            if (isFixedListed) saleType = 'fixed';
                            else if (isAuctionActive) saleType = 'auction';
                            else if (isDutchActive) saleType = 'dutch';

                            // Construct Pokemon data
                            const pokemon: PokemonData = {
                                tokenId: tokenId,
                                name: pokemonRaw.name,
                                ptype: pokemonRaw.ptype,
                                rarity: Number(pokemonRaw.rarity),
                                level: Number(pokemonRaw.level),
                            };

                            // Construct marketplace item
                            const item: MarketplaceItem = {
                                pokemon,
                                imageUri: imageUrl,
                                saleType,
                                owner,
                                listing: isFixedListed ? {
                                    seller: listing.seller,
                                    price: listing.price
                                } : undefined,
                                auction: isAuctionActive ? {
                                    seller: auction.seller,
                                    startingPrice: auction.startingPrice,
                                    endTime: auction.endTime,
                                    highestBid: auction.highestBid,
                                    highestBidder: auction.highestBidder,
                                    active: auction.active
                                } : undefined,
                                dutchAuction: isDutchActive ? {
                                    seller: dutchAuction.seller,
                                    startPrice: dutchAuction.startPrice,
                                    endPrice: dutchAuction.endPrice,
                                    startTime: dutchAuction.startTime,
                                    duration: dutchAuction.duration,
                                    active: dutchAuction.active
                                } : undefined,
                            };

                            return item;
                        })
                    );

                    allItems.push(...batchItems);
                    console.log(`Loaded ${allItems.length}/${total} NFTs...`);
                }

                // Randomize order to show variety (not just first 50 in sequence)
                const randomized = allItems.sort(() => Math.random() - 0.5);

                return randomized;
            } catch (error) {
                console.error("Error fetching marketplace data:", error);
                throw error;
            }
        },
        staleTime: 1000 * 60, // 1 minute cache
        refetchOnWindowFocus: true, // Auto-refresh when user returns to tab
    });
}
