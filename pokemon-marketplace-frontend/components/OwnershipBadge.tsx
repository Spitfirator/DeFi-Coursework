'use client';

import { Badge } from './ui/Badge';

interface OwnershipBadgeProps {
    saleType: 'fixed' | 'auction' | 'dutch' | 'none';
    isOwner: boolean;
}

export function OwnershipBadge({ saleType, isOwner }: OwnershipBadgeProps) {
    if (!isOwner) return null;

    if (saleType === 'none') {
        return (
            <Badge variant="default" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                ✓ Owned
            </Badge>
        );
    }

    return (
        <Badge variant="default" className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
            📋 Listed for Sale
        </Badge>
    );
}
