import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getProfile } from '../api/concept2';
import { RecentWorkouts } from '../components/RecentWorkouts';
import { Link } from 'react-router-dom';
import { Waves, LogOut, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../services/supabase';

export const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [totalMeters, setTotalMeters] = useState(0);
    const [loading, setLoading] = useState(true);
    const [c2Connected, setC2Connected] = useState(!!localStorage.getItem('concept2_token'));

    useEffect(() => {
        async function loadData() {
            if (!c2Connected) {
                setLoading(false);
                return;
            }

            try {
                const data = await getProfile();
                setProfile(data);

                // Fetch Lifetime Meters from DB
                if (user) {
                    const { data: logs, error } = await supabase
                        .from('workout_logs')
                        .select('distance_meters')
                        .eq('user_id', user.id);

                    if (!error && logs) {
                        const total = logs.reduce((sum, log) => sum + (log.distance_meters || 0), 0);
                        setTotalMeters(total);
                    }
                }
            } catch (error: any) {
                console.error(error);
                if (error.response?.status === 401) {
                    setC2Connected(false);
                    localStorage.removeItem('concept2_token');
                }
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [c2Connected, user]);

    const handleConnect = () => {
        const client_id = import.meta.env.VITE_CONCEPT2_CLIENT_ID;
        const redirect_uri = `${window.location.origin}/callback`;
        const scope = 'user:read,results:read';
        const url = `https://log.concept2.com/oauth/authorize?client_id=${client_id}&scope=${scope}&response_type=code&redirect_uri=${redirect_uri}`;
        window.location.href = url;
    };

    if (loading) return <div className="p-8 text-white">Loading...</div>;

    if (!c2Connected) {
        return (
            <div className="min-h-screen bg-neutral-950 text-white p-8 flex flex-col items-center justify-center">
                <div className="max-w-md text-center space-y-8">
                    <div className="flex justify-center">
                        <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500">
                            <Waves size={48} />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold">Welcome, {user?.email?.split('@')[0]}!</h1>
                    <p className="text-neutral-400">
                        To see your stats, you need to connect your Concept2 logbook account.
                    </p>

                    <button
                        onClick={handleConnect}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                    >
                        <LinkIcon size={20} />
                        Connect Concept2 Logbook
                    </button>

                    <button onClick={() => logout()} className="text-neutral-500 hover:text-white text-sm">
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                <main className="space-y-8 mt-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50">
                            <div className="text-neutral-400 text-sm mb-1">Athlete</div>
                            <div className="text-2xl font-bold">{profile?.username || 'Rower'}</div>
                        </div>

                        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50">
                            <div className="text-neutral-400 text-sm mb-1">Weight</div>
                            <div className="text-2xl font-bold">
                                {profile?.weight ? (profile.weight / 100 * 2.20462).toFixed(1) : '-'} <span className="text-sm font-normal text-neutral-500">lbs</span>
                            </div>
                        </div>

                        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50">
                            <div className="total-meters">
                                <div className="text-neutral-400 text-sm mb-1">Lifetime Meters</div>
                                <div className="text-2xl font-bold text-emerald-400">
                                    {totalMeters.toLocaleString()} <span className="text-sm font-normal text-neutral-500">m</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {profile && <RecentWorkouts userId={profile.id} />}
                </main>
            </div>
        </div>
    );
};
