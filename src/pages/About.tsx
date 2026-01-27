import React from 'react';
import { ArrowLeft, Activity, Zap, SplitSquareHorizontal, Database, ShieldAlert, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const About: React.FC = () => {
    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-12 font-sans selection:bg-blue-500/30">
            <div className="max-w-4xl mx-auto space-y-16">

                {/* Hero Section */}
                <header className="space-y-6 text-center pt-10 animate-fade-in">
                    <div className="inline-flex items-center justify-center p-3 bg-neutral-900 rounded-2xl mb-4 border border-neutral-800 shadow-2xl">
                        <Activity className="text-emerald-500" size={32} />
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-br from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
                        Logbook Analyzer
                    </h1>
                    <p className="text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                        A dedicated analysis layer for the Concept2 Logbook.
                        Go beyond simple summaries with physics-based metrics and deep performance insights.
                    </p>
                    <div className="pt-8 flex justify-center gap-4">
                        <Link to="/login" className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-neutral-200 transition-all transform hover:scale-105">
                            Get Started
                        </Link>
                        <Link to="/login" className="px-8 py-3 bg-neutral-900 text-white font-medium rounded-full border border-neutral-800 hover:bg-neutral-800 transition-colors">
                            Log In
                        </Link>
                    </div>
                </header>

                {/* What it Does */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FeatureCard
                        icon={Database}
                        color="blue"
                        title="Seamless Sync"
                        description="Automatically syncs your Concept2 Logbook history. No manual uploads required. We fetch your raw stroke data for deep analysis."
                    />
                    <FeatureCard
                        icon={Zap}
                        color="yellow"
                        title="Physics-Based Power"
                        description="We recalculate true power output (Watts) from stroke pace data, fixing common discrepancies in raw log data to give you accurate intensity metrics."
                    />
                    <FeatureCard
                        icon={BarChart3}
                        color="emerald"
                        title="Benchmark Trends"
                        description="Track your performance over time on standard ranked pieces (2k, 5k, 30:00). See your progress visually with trend lines and historical averages."
                    />
                    <FeatureCard
                        icon={SplitSquareHorizontal}
                        color="purple"
                        title="Head-to-Head Compare"
                        description="Overlay any two workouts to analyze pacing strategies, stroke rate differences, and power output stroke-by-stroke."
                    />
                </section>

                {/* What it Doesn't Do */}
                <section className="bg-neutral-900/30 rounded-3xl p-8 md:p-12 border border-neutral-800/50">
                    <div className="flex items-center gap-4 mb-8">
                        <ShieldAlert className="text-rose-500" size={24} />
                        <h2 className="text-2xl font-bold text-neutral-200">Scope & Limitations</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-neutral-400">
                        <div className="space-y-2">
                            <h3 className="text-white font-medium">Not a Logbook Replacement</h3>
                            <p className="text-sm leading-relaxed">
                                We are an analysis tool, not a record keeper. Always ensure your data is safely stored in the official Concept2 Logbook.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-white font-medium">No Social Features</h3>
                            <p className="text-sm leading-relaxed">
                                This is a tool for personal improvement. There are no likes, comments, or leaderboards. It's just you and your data.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-white font-medium">No Coaching Plans</h3>
                            <p className="text-sm leading-relaxed">
                                We provide the data to help you make decisions, but we don't prescribe workouts or training plans.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="text-center pt-12 pb-8 text-neutral-600 text-sm border-t border-neutral-900">
                    <Link to="/login" className="inline-flex items-center hover:text-white transition-colors gap-2 mb-4">
                        <ArrowLeft size={14} />
                        Back to Application
                    </Link>
                    <p>© {new Date().getFullYear()} Logbook Analyzer. Not affiliated with Concept2.</p>
                </footer>
            </div>
        </div>
    );
};

const FeatureCard = ({ icon: Icon, color, title, description }: any) => (
    <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-2xl hover:bg-neutral-900 hover:border-neutral-700 transition-all group">
        <div className={`w-12 h-12 rounded-xl bg-neutral-950 flex items-center justify-center mb-4 text-${color}-500 border border-neutral-800 group-hover:border-${color}-500/30 transition-colors`}>
            <Icon size={24} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-neutral-400 leading-relaxed">
            {description}
        </p>
    </div>
);
