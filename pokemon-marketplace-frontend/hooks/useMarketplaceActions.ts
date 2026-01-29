import { useCallback, useState } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { parseEther } from 'ethers';

// Helper to parse contract errors
const getFriendlyErrorMessage = (error: any): string => {
    const message = error.message || '';
    const data = error.data || '';

    // Check for custom error selectors
    if (message.includes('0xef025889') || data.includes('0xef025889')) return 'You cannot bid on your own auction.';
    if (message.includes('0xa0d26eb6') || data.includes('0xa0d26eb6')) return 'Bid must be higher than current highest bid.';
    if (message.includes('0x69b8d0fe') || data.includes('0x69b8d0fe')) return 'Auction is not active.';
    if (message.includes('0xdda144a5') || data.includes('0xdda144a5')) return 'Auction has ended.';
    if (message.includes('0x338bdb50') || data.includes('0x338bdb50')) return 'Cannot cancel auction with active bids.';
    if (message.includes('0x4c084f14') || data.includes('0x4c084f14')) return 'You are not the owner of this token.';

    // User Rejection
    if (error.code === 'ACTION_REJECTED' || message.includes('user rejected') || message.includes('User denied')) {
        return 'Transaction Cancelled';
    }

    return message || 'Transaction failed';
};

export function useMarketplaceActions() {
    const { marketplaceContract, nftContract, account } = useWeb3();
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helper to check if we can transact
    const checkRequirements = () => {
        if (!marketplaceContract || !nftContract || !account) {
            throw new Error('Wallet not connected or contracts not initialized');
        }
        return { marketplaceContract, nftContract };
    };

    const buyFixedPrice = useCallback(async (nftAddress: string, tokenId: bigint, priceInWei: bigint) => {
        setIsPending(true);
        setError(null);
        try {
            const { marketplaceContract } = checkRequirements();

            const tx = await marketplaceContract.buyFixedPrice(nftAddress, tokenId, {
                value: priceInWei
            });
            console.log('Transaction sent:', tx.hash);

            await tx.wait();
            console.log('Transaction confirmed');
            return true;

        } catch (err: any) {
            console.error('Buy error:', err);
            setError(getFriendlyErrorMessage(err));
            return false;
        } finally {
            setIsPending(false);
        }
    }, [marketplaceContract, nftContract, account]);

    const placeBid = useCallback(async (nftAddress: string, tokenId: bigint, bidAmountEth: string) => {
        setIsPending(true);
        setError(null);
        try {
            const { marketplaceContract } = checkRequirements();
            const bidInWei = parseEther(bidAmountEth);

            const tx = await marketplaceContract.bid(nftAddress, tokenId, {
                value: bidInWei
            });
            await tx.wait();
            return true;
        } catch (err: any) {
            console.error('Bid error:', err);
            setError(getFriendlyErrorMessage(err));
            return false;
        } finally {
            setIsPending(false);
        }
    }, [marketplaceContract, nftContract, account]);

    // General helper for approvals
    const ensureApproved = async (nftC: any, mkpAddress: string) => {
        const isApproved = await nftC.isApprovedForAll(account!, mkpAddress);
        if (!isApproved) {
            console.log("Approving marketplace...");
            const approveTx = await nftC.setApprovalForAll(mkpAddress, true);
            await approveTx.wait();
            console.log("Approved");
        }
    };

    const listFixedPrice = useCallback(async (nftAddress: string, tokenId: bigint, priceEth: string) => {
        setIsPending(true);
        setError(null);
        try {
            const { marketplaceContract, nftContract } = checkRequirements();
            await ensureApproved(nftContract, await marketplaceContract.getAddress());

            const priceWei = parseEther(priceEth);
            const tx = await marketplaceContract.listFixedPrice(nftAddress, tokenId, priceWei);
            await tx.wait();
            return true;
        } catch (err: any) {
            console.error('List error:', err);
            setError(getFriendlyErrorMessage(err));
            return false;
        } finally {
            setIsPending(false);
        }
    }, [marketplaceContract, nftContract, account]);

    const createAuction = useCallback(async (nftAddress: string, tokenId: bigint, startPriceEth: string, durationSeconds: number) => {
        setIsPending(true);
        setError(null);
        try {
            const { marketplaceContract, nftContract } = checkRequirements();
            await ensureApproved(nftContract, await marketplaceContract.getAddress());

            const priceWei = parseEther(startPriceEth);
            const tx = await marketplaceContract.startAuction(nftAddress, tokenId, priceWei, BigInt(durationSeconds));
            await tx.wait();
            return true;
        } catch (err: any) {
            console.error('Create Auction error:', err);
            setError(err.message || 'Auction creation failed');
            return false;
        } finally {
            setIsPending(false);
        }
    }, [marketplaceContract, nftContract, account]);

    const createDutchAuction = useCallback(async (nftAddress: string, tokenId: bigint, startPriceEth: string, endPriceEth: string, durationSeconds: number) => {
        setIsPending(true);
        setError(null);
        try {
            const { marketplaceContract, nftContract } = checkRequirements();
            await ensureApproved(nftContract, await marketplaceContract.getAddress());

            const startPriceWei = parseEther(startPriceEth);
            const endPriceWei = parseEther(endPriceEth);
            const tx = await marketplaceContract.createDutchAuction(
                nftAddress,
                tokenId,
                startPriceWei,
                endPriceWei,
                BigInt(durationSeconds)
            );
            await tx.wait();
            return true;
        } catch (err: any) {
            console.error('Create Dutch Auction error:', err);
            setError(err.message || 'Dutch Auction creation failed');
            return false;
        } finally {
            setIsPending(false);
        }
    }, [marketplaceContract, nftContract, account]);

    const cancelListing = useCallback(async (nftAddress: string, tokenId: bigint) => {
        setIsPending(true);
        setError(null);
        try {
            const { marketplaceContract } = checkRequirements();
            const tx = await marketplaceContract.cancelListing(nftAddress, tokenId);
            await tx.wait();
            return true;
        } catch (err: any) {
            console.error('Cancel listing error:', err);
            setError(getFriendlyErrorMessage(err));
            return false;
        } finally {
            setIsPending(false);
        }
    }, [marketplaceContract, nftContract, account]);

    const cancelAuction = useCallback(async (nftAddress: string, tokenId: bigint) => {
        setIsPending(true);
        setError(null);
        try {
            const { marketplaceContract } = checkRequirements();
            const tx = await marketplaceContract.cancelAuction(nftAddress, tokenId);
            await tx.wait();
            return true;
        } catch (err: any) {
            console.error('Cancel auction error:', err);
            setError(getFriendlyErrorMessage(err));
            return false;
        } finally {
            setIsPending(false);
        }
    }, [marketplaceContract, nftContract, account]);

    const cancelDutchAuction = useCallback(async (nftAddress: string, tokenId: bigint) => {
        setIsPending(true);
        setError(null);
        try {
            const { marketplaceContract } = checkRequirements();
            const tx = await marketplaceContract.cancelDutchAuction(nftAddress, tokenId);
            await tx.wait();
            return true;
        } catch (err: any) {
            console.error('Cancel Dutch auction error:', err);
            setError(getFriendlyErrorMessage(err));
            return false;
        } finally {
            setIsPending(false);
        }
    }, [marketplaceContract, nftContract, account]);

    const endAuction = useCallback(async (nftAddress: string, tokenId: bigint) => {
        setIsPending(true);
        setError(null);
        try {
            const { marketplaceContract } = checkRequirements();
            const tx = await marketplaceContract.endAuction(nftAddress, tokenId);
            await tx.wait();
            return true;
        } catch (err: any) {
            console.error('End auction error:', err);
            setError(getFriendlyErrorMessage(err));
            return false;
        } finally {
            setIsPending(false);
        }
    }, [marketplaceContract, nftContract, account]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        buyFixedPrice,
        placeBid,
        listFixedPrice,
        createAuction,
        createDutchAuction,
        cancelListing,
        cancelAuction,
        cancelDutchAuction,
        endAuction,
        isPending,
        error,
        clearError
    };
}
