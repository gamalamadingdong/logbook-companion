import React, { useState, useEffect } from 'react';
import { Terminal, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { parseRWN } from '../utils/rwnParser';
import { structureToIntervals } from '../utils/structureAdapter';
import { calculateCanonicalName } from '../utils/prCalculator';

export const RWNPlayground: React.FC = () => {
    const [input, setInput] = useState('3 x 2000m / 4:00r');
    const [parsed, setParsed] = useState<any>(null);
    const [canonicalName, setCanonicalName] = useState<string>('—');
    const [error, setError] = useState<string | null>(null);

    const EXAMPLES = [
        { label: 'Intervals', value: '4x500m/1:00r', desc: 'Sprints' },
        { label: 'Distance', value: '10000m', desc: 'Steady State' },
        { label: 'Time', value: '30:00', desc: 'Duration' },
        { label: 'Relative', value: '30:00 @2k+18', desc: 'Split Target' },
        { label: 'Multi-Erg', value: 'Bike: 15000m', desc: 'Modality Prefix' },
        { label: 'Rate Cap', value: '2000m @r24', desc: 'Rate Limit' },
        { label: 'Mixed', value: '2000m+1000m+500m', desc: 'Variable' },
        { label: 'Complex', value: '3x(4:00/2:00r)', desc: 'Time Intervals' },
    ];

    useEffect(() => {
        if (!input.trim()) {
            setParsed(null);
            setError(null);
            setCanonicalName('—');
            return;
        }

        const result = parseRWN(input);
        if (result) {
            setParsed(result);
            setError(null);

            // Try to generate canonical name
            try {
                const intervals = structureToIntervals(result);
                const name = calculateCanonicalName(intervals);
                setCanonicalName(name);
            } catch (e) {
                setCanonicalName('Error generating name');
            }
        } else {
            setParsed(null);
            setError('Invalid RWN Syntax');
            setCanonicalName('—');
        }
    }, [input]);

    return (
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-sm mt-8">
            <div className="bg-neutral-900/50 p-4 border-b border-neutral-800 flex items-center gap-2">
                <Terminal className="text-emerald-500" size={18} />
                <h3 className="font-semibold text-white">Interactive Validator</h3>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">
                            Enter RWN String
                        </label>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="w-full h-32 bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-500 resize-none transition-colors"
                            placeholder="e.g., 4x500m/1:00r"
                            spellCheck={false}
                        />
                    </div>

                    {/* Status Indicator */}
                    <div className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${error
                        ? 'bg-red-900/10 border-red-900/30 text-red-400'
                        : input.trim()
                            ? 'bg-emerald-900/10 border-emerald-900/30 text-emerald-400'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                        }`}>
                        {error ? (
                            <>
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </>
                        ) : input.trim() ? (
                            <>
                                <CheckCircle2 size={16} />
                                <span>Valid Syntax</span>
                            </>
                        ) : (
                            <span>Waiting for input...</span>
                        )}
                    </div>

                    {/* Reference Examples */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-3">
                            Try Examples
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {EXAMPLES.map((ex) => (
                                <button
                                    key={ex.label}
                                    onClick={() => setInput(ex.value)}
                                    className="text-left px-3 py-2 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-700 transition-all group"
                                >
                                    <div className="text-xs font-medium text-neutral-300 group-hover:text-emerald-400 transition-colors">
                                        {ex.label}
                                    </div>
                                    <div className="text-[10px] text-neutral-500 font-mono mt-0.5 truncate">
                                        {ex.value}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Output Section */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">
                            Parsed Structure
                        </label>
                        <div className="relative group">
                            <pre className="w-full h-64 bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-xs font-mono text-neutral-300 overflow-auto custom-scrollbar">
                                {parsed ? JSON.stringify(parsed, null, 2) : '// Output will appear here'}
                            </pre>
                            {/* Overlay Label for result */}
                            {parsed && (
                                <div className="absolute top-4 right-4 bg-neutral-800/80 backdrop-blur px-2 py-1 rounded text-xs text-emerald-400 border border-emerald-900/30">
                                    {parsed.type}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Derived Info */}
                    {parsed && (
                        <div className="flex items-center justify-between bg-neutral-900 p-3 rounded-lg border border-neutral-800">
                            <span className="text-sm text-neutral-500">Canonical Name</span>
                            <div className="flex items-center gap-2">
                                <ArrowRight size={14} className="text-neutral-600" />
                                <span className="font-mono text-white font-medium">{canonicalName}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
