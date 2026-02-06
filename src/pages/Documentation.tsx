import React, { useState } from 'react';
import { Activity, Database, ArrowRight, Code } from 'lucide-react';
import { RWNPlayground } from '../components/RWNPlayground';

export const Documentation: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'concepts' | 'rwn' | 'analytics'>('concepts');
    const [rwnSubTab, setRwnSubTab] = useState<'spec' | 'playground'>('spec');

    return (
        <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Documentation</h1>
                    <p className="text-neutral-400">
                        Guides and standards for using Logbook Companion
                    </p>
                </div>
                <div className="flex bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                    <button
                        onClick={() => setActiveTab('concepts')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'concepts'
                            ? 'bg-neutral-800 text-white shadow-sm'
                            : 'text-neutral-400 hover:text-white'
                            }`}
                    >
                        Core Concepts
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'analytics'
                            ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50'
                            : 'text-neutral-400 hover:text-white'
                            }`}
                    >
                        Analytics & Zones
                    </button>
                    <button
                        onClick={() => setActiveTab('rwn')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'rwn'
                            ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50'
                            : 'text-neutral-400 hover:text-white'
                            }`}
                    >
                        RWN Specification
                    </button>
                </div>
            </div>

            {activeTab === 'concepts' && (
                <div className="space-y-12 anime-fade-in">
                    {/* Hero Section: The Philosophy */}
                    <section className="text-center max-w-3xl mx-auto py-8">
                        <h2 className="text-2xl font-bold text-white mb-4">Built for the Data-Driven Rower</h2>
                        <p className="text-lg text-neutral-400 leading-relaxed">
                            Logbook Companion isn't just a viewer for your Concept2 logbook. It's an <span className="text-emerald-400">intelligence layer</span> that turns raw meters and seconds into actionable insights. We believe that to improve, you need to understand <em>how</em> you skied, rowed, or biked—not just how far.
                        </p>
                    </section>

                    <div className="grid gap-8">
                        {/* 1. Sync & Data */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start">
                                <div className="p-4 bg-blue-500/10 rounded-xl shrink-0">
                                    <Database size={32} className="text-blue-400" />
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-2">Automated Data Sync</h3>
                                        <p className="text-neutral-400 leading-relaxed">
                                            Stop typing numbers into spreadsheets. We connect directly to your Concept2 Logbook API to pull every session automatically.
                                        </p>
                                    </div>
                                    <div className="bg-neutral-950 rounded-lg p-6 border border-neutral-800">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Why it helps</h4>
                                        <ul className="space-y-3">
                                            <li className="flex items-start gap-3 text-sm text-neutral-400">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                <span><strong>Total Accuracy:</strong> We capture split-by-split data, stroke rates, and heart rate profiles that manual entry misses.</span>
                                            </li>
                                            <li className="flex items-start gap-3 text-sm text-neutral-400">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                <span><strong>Zero Friction:</strong> Just row. Your data appears here instantly after syncing.</span>
                                            </li>
                                            <li className="flex items-start gap-3 text-sm text-neutral-400">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                <span><strong>Legacy Compatible:</strong> We can pull your entire history, unlocking years of insights you didn't know you had.</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Templates & Library */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start">
                                <div className="p-4 bg-fuchsia-500/10 rounded-xl shrink-0">
                                    <Activity size={32} className="text-fuchsia-400" />
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-2">The Workout Library</h3>
                                        <p className="text-neutral-400 leading-relaxed">
                                            The Library is where you define your training intent. Instead of just logging "what happened", you define "what is supposed to happen".
                                        </p>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="bg-neutral-950 p-5 rounded-lg border border-neutral-800">
                                            <strong className="block text-white mb-1">Templates (The Plan)</strong>
                                            <p className="text-sm text-neutral-400 mb-3">
                                                Reusable blueprints for workouts (e.g., "The Pete Plan 4x1000m"). Define the intervals, target pace, and rate caps once.
                                            </p>
                                            <div className="text-xs text-fuchsia-400 font-mono bg-fuchsia-900/10 px-2 py-1 rounded w-fit">
                                                Blueprints for consistency
                                            </div>
                                        </div>
                                        <div className="bg-neutral-950 p-5 rounded-lg border border-neutral-800">
                                            <strong className="block text-white mb-1">Logs (The Reality)</strong>
                                            <p className="text-sm text-neutral-400 mb-3">
                                                Your actual performance. We link Logs back to Templates so you can track your progress on specific specific sessions over time.
                                            </p>
                                            <div className="text-xs text-emerald-400 font-mono bg-emerald-900/10 px-2 py-1 rounded w-fit">
                                                Proof of progress
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Standardization (RWN) */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start">
                                <div className="p-4 bg-emerald-500/10 rounded-xl shrink-0">
                                    <Code size={32} className="text-emerald-400" />
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-2">Standardization with RWN</h3>
                                        <p className="text-neutral-400 leading-relaxed">
                                            Rowers Workout Notation (RWN) is the glue that holds it all together. It's a universal language for describing intervals that machines can understand.
                                        </p>
                                    </div>
                                    <div className="bg-neutral-950 rounded-lg p-6 border border-neutral-800">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">The Problem & The Fix</h4>
                                        <div className="grid md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <span className="text-xs font-bold text-red-400 uppercase">Without RWN</span>
                                                <p className="text-sm text-neutral-400">
                                                    "8x500", "8 x 500m", "500m sprints x8".
                                                    <br />
                                                    Computers see these as three totally different things. Your history gets fragmented.
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <span className="text-xs font-bold text-emerald-400 uppercase">With RWN</span>
                                                <p className="text-sm text-neutral-400">
                                                    <code className="bg-neutral-900 px-1 py-0.5 rounded text-emerald-400">8x500m/2:00r</code>
                                                    <br />
                                                    One standard format. Every time you row it, it matches the same Template. Your analytics automatically aggregate.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <button
                                            onClick={() => setActiveTab('rwn')}
                                            className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                                        >
                                            Explore the RWN Specification <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Live Sessions */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start">
                                <div className="p-4 bg-fuchsia-500/10 rounded-xl shrink-0">
                                    <Activity size={32} className="text-fuchsia-400" />
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold text-white">Live Sessions</h3>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-fuchsia-900/30 text-fuchsia-400 border border-fuchsia-500/30">
                                                Experimental
                                            </span>
                                        </div>
                                        <p className="text-neutral-400 leading-relaxed">
                                            Connect directly to Concept2 PM5 monitors via Bluetooth for real-time racing and programmable workouts.
                                        </p>
                                    </div>
                                    <div className="bg-neutral-950 rounded-lg p-6 border border-neutral-800">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Coming Soon</h4>
                                        <ul className="space-y-3">
                                            <li className="flex items-start gap-3 text-sm text-neutral-400">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
                                                <span><strong>Group Workouts:</strong> Host sessions where everyone's monitor is programmed automatically.</span>
                                            </li>
                                            <li className="flex items-start gap-3 text-sm text-neutral-400">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
                                                <span><strong>Synchronized Racing:</strong> Fair starts and live leaderboards for your squad.</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'analytics' && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden anime-fade-in">
                    <div className="p-6 border-b border-neutral-800 bg-neutral-900/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">Analytics & Training Zones</h2>
                                <p className="text-sm text-neutral-400 mt-1">Understanding your rowing performance metrics</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-8">
                        <section>
                            <h3 className="text-lg font-semibold text-white mb-3">Training Zones</h3>
                            <p className="text-neutral-400 mb-4 text-sm">
                                Zones are calculated based on your <strong>2k Baseline Watts</strong>. This ensures that training targets scale with your current fitness level.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-5">
                                {[
                                    { name: 'UT2', label: 'Utilization 2', range: '55-70%', desc: 'Long steady state. Aerobic base building.', color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-900/50' },
                                    { name: 'UT1', label: 'Utilization 1', range: '70-80%', desc: 'Harder aerobic work. Threshold development.', color: 'text-teal-400', bg: 'bg-teal-900/20', border: 'border-teal-900/50' },
                                    { name: 'AT', label: 'Anaerobic Threshold', range: '80-90%', desc: 'Race pace sustainability. High intensity.', color: 'text-amber-400', bg: 'bg-amber-900/20', border: 'border-amber-900/50' },
                                    { name: 'TR', label: 'Transportation', range: '90-105%', desc: 'Race pace intervals. High output.', color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-900/50' },
                                    { name: 'AN', label: 'Anaerobic', range: '105%+', desc: 'Max effort sprints. Power development.', color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-900/50' },
                                ].map((z) => (
                                    <div key={z.name} className={`p-3 rounded border ${z.bg} ${z.border}`}>
                                        <div className={`text-xs font-bold ${z.color} mb-1`}>{z.name}</div>
                                        <div className="text-xs text-white font-medium mb-1">{z.range} of 2k Watts</div>
                                        <p className="text-[10px] text-neutral-400 leading-tight">{z.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-3">Key Metrics</h3>
                                <ul className="space-y-3">
                                    <li className="bg-neutral-950 p-3 rounded border border-neutral-800">
                                        <div className="flex justify-between items-start">
                                            <strong className="text-white text-sm block">Global Zone Filters</strong>
                                            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold">New</span>
                                        </div>
                                        <span className="text-xs text-neutral-400">
                                            Toggle the Zone Filter buttons (UT2, AT, TR, etc.) in the global header to instantly filter your Dashboard and Workout lists to only show sessions matching that intensity.
                                        </span>
                                    </li>
                                    <li className="bg-neutral-950 p-3 rounded border border-neutral-800">
                                        <strong className="text-white text-sm block">Zone Distribution</strong>
                                        <span className="text-xs text-neutral-400">Breakdown of time spent in each intensity zone. Helps verify if you are training polarized (80/20 rule).</span>
                                    </li>
                                    <li className="bg-neutral-950 p-3 rounded border border-neutral-800">
                                        <strong className="text-white text-sm block">Weekly Volume</strong>
                                        <span className="text-xs text-neutral-400">Total distance or time tracked per week. Monitor this to avoid overtraining spikes.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-3">Workout Comparison</h3>
                                    <div className="bg-neutral-950 p-4 rounded border border-neutral-800 h-full">
                                        <p className="text-sm text-neutral-400 mb-3">
                                            Compare any two workouts side-by-side with full stroke data overlays.
                                        </p>
                                        <div className="space-y-2 text-xs text-neutral-300">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-neutral-600"></div>
                                                <span><strong>Metric Switching:</strong> Toggle between Watts, Pace, Rate, and Heart Rate views.</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-neutral-600"></div>
                                                <span><strong>Pinning:</strong> Click any point on the chart to lock the stats header for detailed inspection.</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-neutral-600"></div>
                                                <span><strong>Multi-Stat Header:</strong> View Watts, Pace, Rate, and HR simultaneously for both workouts.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-3">Auto-Detection</h3>
                                    <div className="bg-neutral-950 p-4 rounded border border-neutral-800 h-full">
                                        <p className="text-sm text-neutral-400 mb-3">
                                            The system automatically tags your workouts based on their average intensity if not explicitly categorized.
                                        </p>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-neutral-300">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                <span>Manual Tags take priority</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-neutral-300">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                <span>Calculated from Average Watts vs. Baseline</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {activeTab === 'rwn' && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden anime-fade-in">
                    <div className="p-6 border-b border-neutral-800 bg-neutral-900/50">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">Rowers Workout Notation (RWN)</h2>
                                <p className="text-sm text-neutral-400 mt-1">Version 0.1.0-draft • Request for Comment</p>
                            </div>
                            <div className="px-3 py-1 bg-emerald-900/30 border border-emerald-900/50 rounded-full text-xs font-medium text-emerald-400">
                                RFC Status
                            </div>
                        </div>

                        {/* Sub-tabs for RWN Section with explicit type definition */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setRwnSubTab('spec')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${rwnSubTab === 'spec'
                                    ? 'bg-neutral-800 text-white shadow-sm'
                                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                                    }`}
                            >
                                Specification Guide
                            </button>
                            <button
                                onClick={() => setRwnSubTab('playground')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${rwnSubTab === 'playground'
                                    ? 'bg-neutral-800 text-white shadow-sm'
                                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                                    }`}
                            >
                                <Code size={16} />
                                Interactive Playground
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        {rwnSubTab === 'playground' ? (
                            <div className="anime-fade-in">
                                <RWNPlayground />
                                <div className="mt-8 p-4 bg-emerald-900/10 border border-emerald-900/20 rounded-lg">
                                    <h4 className="text-sm font-semibold text-emerald-400 mb-2">How to use the Validator</h4>
                                    <p className="text-sm text-neutral-400">
                                        Type any workout string above to see how the system parses it.
                                        Check the "Canonical Name" to see how it will appear in your logbook.
                                        The JSON output shows the exact structure that will be saved to the database.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 anime-fade-in">
                                <section>
                                    <h3 className="text-lg font-semibold text-white mb-3">1. Basic Structure</h3>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                                            <h4 className="text-sm font-medium text-neutral-300 mb-2">Standard Intervals</h4>
                                            <code className="text-sm text-emerald-400 block mb-2">[Repeats] x [Work] / [Rest]r</code>
                                            <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
                                                <li>4x500m/1:00r</li>
                                                <li>3x20:00/2:00r</li>
                                                <li><span className="text-emerald-400">NEW:</span> 500m/1:00r (Single interval)</li>
                                            </ul>
                                        </div>
                                        <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                                            <h4 className="text-sm font-medium text-neutral-300 mb-2">Steady State</h4>
                                            <code className="text-sm text-emerald-400 block mb-2">[Duration] or [Distance]</code>
                                            <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
                                                <li>10000m</li>
                                                <li>30:00</li>
                                                <li>60:00</li>
                                            </ul>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-lg font-semibold text-white mb-3">2. Components</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="border-b border-neutral-800 text-neutral-400">
                                                    <th className="py-2 px-4">Type</th>
                                                    <th className="py-2 px-4">Syntax</th>
                                                    <th className="py-2 px-4">Example</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-800 text-neutral-300">
                                                <tr>
                                                    <td className="py-2 px-4">Distance</td>
                                                    <td className="py-2 px-4 font-mono text-emerald-400">[N]m</td>
                                                    <td className="py-2 px-4">2000m</td>
                                                </tr>
                                                <tr>
                                                    <td className="py-2 px-4">Time</td>
                                                    <td className="py-2 px-4 font-mono text-emerald-400">[M]:[SS]</td>
                                                    <td className="py-2 px-4">30:00</td>
                                                </tr>
                                                <tr>
                                                    <td className="py-2 px-4">Rest</td>
                                                    <td className="py-2 px-4 font-mono text-emerald-400">...r</td>
                                                    <td className="py-2 px-4">2:00r, /...r (undefined)</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-lg font-semibold text-white mb-3">3. Extended Guidance (@)</h3>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                                            <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">Stroke Rate</div>
                                            <div className="font-mono text-emerald-400 text-sm">@r20</div>
                                            <div className="text-xs text-neutral-600 mt-1">or @18..22spm</div>
                                        </div>
                                        <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                                            <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">Pace Target</div>
                                            <div className="font-mono text-emerald-400 text-sm">@1:45</div>
                                            <div className="text-xs text-neutral-600 mt-1">or @2:05..2:10</div>
                                        </div>
                                        <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                                            <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">Relative Pace</div>
                                            <div className="font-mono text-emerald-400 text-sm">@2k+10</div>
                                            <div className="text-xs text-neutral-600 mt-1">PR + offset</div>
                                        </div>
                                        <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                                            <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">Zone</div>
                                            <div className="font-mono text-emerald-400 text-sm">@UT2</div>
                                            <div className="text-xs text-neutral-600 mt-1">Intensity zones</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 bg-neutral-950 p-4 rounded border border-neutral-800">
                                        <h4 className="text-sm font-medium text-neutral-300 mb-2">Block Tags (Semantic Structure)</h4>
                                        <p className="text-xs text-neutral-500 mb-3">Use block tags to denote warmup, cooldown, and test segments:</p>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex gap-3">
                                                <code className="text-emerald-400">[w]10:00</code>
                                                <span className="text-neutral-600">→ Warmup (10 min)</span>
                                            </div>
                                            <div className="flex gap-3">
                                                <code className="text-emerald-400">[c]5:00</code>
                                                <span className="text-neutral-600">→ Cooldown (5 min)</span>
                                            </div>
                                            <div className="flex gap-3">
                                                <code className="text-emerald-400">[t]2000m@2k</code>
                                                <span className="text-neutral-600">→ Test piece (2k at PR pace)</span>
                                            </div>
                                            <div className="flex gap-3">
                                                <code className="text-emerald-400">[w]10:00 + 5x500m/1:00r + [c]5:00</code>
                                                <span className="text-neutral-600">→ Complete workout with W/U and C/D</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 bg-amber-950/20 p-4 rounded border border-amber-900/30">
                                        <h4 className="text-sm font-medium text-amber-400 mb-2">Input Tolerance</h4>
                                        <p className="text-xs text-neutral-400 mb-2">The parser accepts common shorthand notations:</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div><code className="text-amber-400">30:00r20</code> <span className="text-neutral-600">→ 30:00@r20</span></div>
                                            <div><code className="text-amber-400">4 x 500m</code> <span className="text-neutral-600">→ 4x500m</span></div>
                                            <div><code className="text-amber-400">@18-22spm</code> <span className="text-neutral-600">→ @18..22spm</span></div>
                                            <div><code className="text-amber-400">1:00 r</code> <span className="text-neutral-600">→ 1:00r</span></div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-lg font-semibold text-white mb-3">4. Advanced Syntax</h3>
                                    <div className="space-y-3">
                                        <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                                            <h4 className="text-sm font-medium text-neutral-300 mb-1">Segmented (Compound) Workouts</h4>
                                            <p className="text-xs text-neutral-500 mb-3">Linked by <code>+</code> operator. Used for complex pieces with internal changes.</p>

                                            <div className="space-y-4">
                                                <div>
                                                    <div className="text-xs text-neutral-400 font-semibold mb-1">Simple Segments</div>
                                                    <code className="text-sm text-emerald-400 block">2000m + 1000m</code>
                                                    <span className="text-xs text-neutral-600 block mt-1">Continuous 3k row, recorded as two distinct intervals.</span>
                                                </div>

                                                <div>
                                                    <div className="text-xs text-neutral-400 font-semibold mb-1">Rate Progressions / Steps</div>
                                                    <code className="text-sm text-emerald-400 block">10:00@r22 + 5:00@r26</code>
                                                    <code className="text-sm text-emerald-400 block mt-1">15:00 (5:00@r20 + 5:00@r24 + 5:00@r28)</code>
                                                    <span className="text-xs text-neutral-600 block mt-1">Maps to Variable Intervals with 0 rest. Monitor advances automatically at each step.</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                                            <h4 className="text-sm font-medium text-neutral-300 mb-1">PM5 Splits</h4>
                                            <p className="text-xs text-neutral-500 mb-2">Defined in <code>[]</code></p>
                                            <code className="text-sm text-emerald-400 block">10000m [2000m]</code>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-lg font-semibold text-white mb-3">5. Machine Types & Mixed Modalities</h3>
                                    <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                                        <p className="text-sm text-neutral-400 mb-4">
                                            RWN supports non-rowing activities using a <code>Type:</code> prefix.
                                        </p>

                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <h4 className="text-xs font-semibold text-white uppercase mb-2">Supported Types</h4>
                                                    <ul className="text-sm text-neutral-400 space-y-1">
                                                        <li><code className="text-emerald-400">Row</code>, <code className="text-emerald-400">Ski</code>, <code className="text-emerald-400">Bike</code> (Ergs)</li>
                                                        <li><code className="text-blue-400">Run</code> (Running)</li>
                                                        <li><code className="text-fuchsia-400">Other</code> (Generic)</li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-semibold text-white uppercase mb-2">Parsing Logic</h4>
                                                    <ul className="text-sm text-neutral-400 space-y-1">
                                                        <li><strong>Ergs:</strong> Strict RWN syntax (dist/time/rest).</li>
                                                        <li><strong>Run/Other:</strong> Flexible mode. Leading quantities parsed as work; rest is label.</li>
                                                    </ul>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-semibold text-white uppercase mb-2">Examples</h4>
                                                <div className="space-y-2 font-mono text-sm">
                                                    <div className="flex gap-3">
                                                        <span className="text-blue-400">Run: 400m</span>
                                                        <span className="text-neutral-600">→ Type: Run, Dist: 400m</span>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <span className="text-blue-400">Run: 15:00 Tempo</span>
                                                        <span className="text-neutral-600">→ Type: Run, Time: 15:00, Note: "Tempo"</span>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <span className="text-fuchsia-400">Other: 10 Burpees</span>
                                                        <span className="text-neutral-600">→ Type: Other, Note: "10 Burpees"</span>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <span className="text-emerald-400">Row: 2k + Other: Plank + Row: 2k</span>
                                                        <span className="text-neutral-600">→ Compound Mixed</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
