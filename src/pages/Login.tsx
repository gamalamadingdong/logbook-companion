import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoginForm } from '../components/auth/LoginForm';
import { SignUpForm } from '../components/auth/SignUpForm';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { Waves } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot-password';

export const Login: React.FC = () => {
    const { user, loginAsGuest } = useAuth();
    const [mode, setMode] = useState<AuthMode>('login');

    if (user) {
        return <Navigate to="/" replace />;
    }

    const renderAuthForm = () => {
        switch (mode) {
            case 'login':
                return (
                    <LoginForm
                        onSwitchToSignUp={() => setMode('signup')}
                        onForgotPassword={() => setMode('forgot-password')}
                    />
                );
            case 'signup':
                return (
                    <SignUpForm
                        onSwitchToLogin={() => setMode('login')}
                    />
                );
            case 'forgot-password':
                return (
                    <ForgotPasswordForm
                        onSwitchToLogin={() => setMode('login')}
                    />
                );
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col md:flex-row font-sans text-white">
            {/* Left Side: Branding */}
            <div className="md:w-1/2 p-12 flex flex-col justify-between bg-gradient-to-br from-neutral-900 to-neutral-950 border-r border-neutral-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                        <Waves size={32} />
                    </div>
                </div>

                <div className="max-w-lg">
                    <h1 className="text-5xl font-bold mb-6 tracking-tight">
                        Master your <span className="text-emerald-500">rowing data.</span>
                    </h1>
                    <p className="text-xl text-neutral-400 mb-4 leading-relaxed">
                        Connect your Concept2 logbook, analyze interval performance, and export deep-dive reports to Google Sheets.
                    </p>
                    <a href="/about" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors font-medium text-base">
                        Learn more about the Logbook Companion &rarr;
                    </a>
                </div>

                <div className="mb-8 flex items-center gap-2 text-sm text-neutral-400 bg-neutral-900/50 w-fit px-4 py-2 rounded-full border border-neutral-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Secure, read-only connection via official Concept2 API.
                </div>

                <div className="flex items-center gap-6 mt-8 text-sm font-medium">
                    <span className="text-neutral-500">&copy; 2025 Logbook Companion</span>
                </div>
            </div>

            {/* Right Side: Auth Forms */}
            <div className="md:w-1/2 flex items-center justify-center p-8 bg-neutral-950">
                <div className="w-full max-w-md space-y-6">
                    {renderAuthForm()}

                    {/* Guest Mode Entry */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-neutral-800" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-neutral-950 text-neutral-500">Or experience without signing up</span>
                        </div>
                    </div>

                    <button
                        onClick={() => loginAsGuest && loginAsGuest()}
                        className="w-full py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-lg transition-colors border border-neutral-700 flex items-center justify-center gap-2"
                    >
                        Try Demo Mode
                    </button>
                </div>
            </div>
        </div>
    );
};
