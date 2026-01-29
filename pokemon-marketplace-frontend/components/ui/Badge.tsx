import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'legendary' | 'rare' | 'common';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
    const variants = {
        default: 'border-transparent bg-gray-900 text-white hover:bg-gray-900/80',
        secondary: 'border-transparent bg-gray-100 text-gray-900 hover:bg-gray-100/80',
        outline: 'text-gray-950 border-gray-200 hover:bg-gray-100',
        legendary: 'border-transparent bg-amber-500 text-white shadow-amber-500/20 shadow-lg',
        rare: 'border-transparent bg-blue-500 text-white shadow-blue-500/20 shadow-lg',
        common: 'border-transparent bg-slate-500 text-white',
    };

    return (
        <div
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                variants[variant],
                className
            )}
            {...props}
        />
    );
}

export { Badge };
