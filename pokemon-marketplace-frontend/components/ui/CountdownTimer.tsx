'use client';

import { useEffect, useState } from 'react';

interface CountdownTimerProps {
    targetDate: number;
}

export function CountdownTimer({ targetDate }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        isExpired: boolean;
    }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false });

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const difference = targetDate - now;

            if (difference <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
                clearInterval(interval);
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    if (timeLeft.isExpired) {
        return <div className="text-red-500 font-bold">Auction Ended</div>;
    }

    return (
        <div className="flex gap-2 text-sm font-mono mt-2">
            <div className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                <span className="font-bold text-lg">{timeLeft.days}</span>d
            </div>
            <div className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                <span className="font-bold text-lg">{timeLeft.hours.toString().padStart(2, '0')}</span>h
            </div>
            <div className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                <span className="font-bold text-lg">{timeLeft.minutes.toString().padStart(2, '0')}</span>m
            </div>
            <div className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                <span className="font-bold text-lg text-blue-600">{timeLeft.seconds.toString().padStart(2, '0')}</span>s
            </div>
        </div>
    );
}
