import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export const NotFound: React.FC = () => (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-md text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                <AlertTriangle size={28} />
            </div>
            <h1 className="text-3xl font-bold">Page not found</h1>
            <p className="text-neutral-400">
                We couldn’t find the page you were looking for. Double-check the link or head back to your dashboard.
            </p>
            <Link
                to="/"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
                Return to dashboard
            </Link>
        </div>
    </div>
);
