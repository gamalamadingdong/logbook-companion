import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { useAuth } from '../hooks/useAuth';
import { supabase, saveUserGoal, type UserGoal } from '../services/supabase';
import { Waves, Link as LinkIcon, Dumbbell, Target, ChevronRight, Check } from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

const TOTAL_STEPS = 4;

const GOAL_TYPES: { value: UserGoal['type']; label: string; unit: string; placeholder: string }[] = [
  { value: 'monthly_distance', label: 'Complete X meters this month', unit: 'meters', placeholder: '100000' },
  { value: 'weekly_distance', label: 'Row X meters per week', unit: 'meters', placeholder: '30000' },
  { value: 'weekly_sessions', label: 'Complete X sessions per week', unit: 'sessions', placeholder: '4' },
  { value: 'weekly_time', label: 'Row X minutes per week', unit: 'minutes', placeholder: '120' },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ open, onComplete }) => {
  const { profile, refreshProfile, user } = useAuth();
  const [step, setStep] = useState(0);

  // Step 2: Baseline
  const [weight, setWeight] = useState('');
  const [twoKTime, setTwoKTime] = useState('');

  // Step 3: Goal
  const [goalTypeIdx, setGoalTypeIdx] = useState(0);
  const [goalValue, setGoalValue] = useState('');

  const [saving, setSaving] = useState(false);

  const unitPref = (profile?.preferences?.units as string) || 'imperial';
  const weightLabel = unitPref === 'metric' ? 'kg' : 'lbs';

  const markOnboardingComplete = async () => {
    if (!profile?.user_id) return;
    const currentPrefs = profile.preferences || {};
    const updatedPrefs = { ...currentPrefs, onboarding_complete: true };

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ preferences: updatedPrefs })
        .eq('user_id', profile.user_id);

      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      console.error('[Onboarding] Failed to save completion:', err);
    }
  };

  const handleSaveBaseline = async () => {
    if (!profile?.user_id) return;
    const updates: Record<string, unknown> = {};

    if (weight) {
      updates.weight_lbs = parseFloat(weight);
    }
    if (twoKTime) {
      const parts = twoKTime.split(':');
      if (parts.length === 2) {
        const totalSeconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        if (totalSeconds > 0) {
          updates.personal_records = {
            ...(profile.personal_records || {}),
            '2k': totalSeconds,
          };
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      try {
        const { error } = await supabase
          .from('user_profiles')
          .update(updates)
          .eq('user_id', profile.user_id);

        if (error) throw error;
        await refreshProfile();
      } catch (err) {
        console.error('[Onboarding] Failed to save baseline:', err);
        toast.error('Could not save baseline data.');
      }
    }
  };

  const handleSaveGoal = async () => {
    if (!user?.id || !goalValue) return;
    const goalType = GOAL_TYPES[goalTypeIdx];
    let targetValue = parseFloat(goalValue);

    if (goalType.value === 'weekly_time') {
      targetValue = targetValue * 60; // store as seconds
    }

    try {
      await saveUserGoal({
        user_id: user.id,
        type: goalType.value,
        target_value: targetValue,
        is_active: true,
      });
    } catch (err) {
      console.error('[Onboarding] Failed to save goal:', err);
      toast.error('Could not save goal.');
    }
  };

  const handleConnect = () => {
    const client_id = import.meta.env.VITE_CONCEPT2_CLIENT_ID;
    const redirect_uri = `${window.location.origin}/callback`;
    const scope = 'user:read,results:write';
    const url = `https://log.concept2.com/oauth/authorize?client_id=${client_id}&scope=${scope}&response_type=code&redirect_uri=${redirect_uri}`;
    window.location.href = url;
  };

  const finish = async () => {
    setSaving(true);
    try {
      // Save baseline if provided in step 2
      await handleSaveBaseline();
      // Save goal if provided in step 3
      if (goalValue) await handleSaveGoal();
      // Mark complete
      await markOnboardingComplete();
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const advance = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  const skip = () => advance();

  // -- Step renderers --

  const ProgressDots = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === step
              ? 'w-6 bg-accent-primary'
              : i < step
                ? 'w-2 bg-accent-primary/60'
                : 'w-2 bg-border'
          }`}
        />
      ))}
    </div>
  );

  const StepWelcome = () => (
    <div className="text-center space-y-6 py-4">
      <div className="flex justify-center">
        <div className="p-4 bg-accent-primary/10 rounded-2xl text-accent-primary">
          <Waves size={48} />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-content-primary mb-2">Welcome to Logbook Companion</h2>
        <p className="text-content-muted">Your training, analyzed and elevated.</p>
      </div>
      <ul className="text-left space-y-3 max-w-sm mx-auto">
        <li className="flex items-start gap-3 text-content-secondary">
          <Dumbbell size={20} className="text-accent-primary mt-0.5 shrink-0" />
          <span>Track every workout with automatic Concept2 sync</span>
        </li>
        <li className="flex items-start gap-3 text-content-secondary">
          <Target size={20} className="text-accent-primary mt-0.5 shrink-0" />
          <span>Analyze trends, PRs, and training zones over time</span>
        </li>
        <li className="flex items-start gap-3 text-content-secondary">
          <LinkIcon size={20} className="text-accent-primary mt-0.5 shrink-0" />
          <span>Coaching tools for teams, lineups, and programming</span>
        </li>
      </ul>
      <button
        onClick={advance}
        className="mt-4 bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold py-3 px-8 rounded-xl transition-colors inline-flex items-center gap-2"
      >
        Get Started <ChevronRight size={18} />
      </button>
    </div>
  );

  const StepConnectC2 = () => (
    <div className="text-center space-y-6 py-4">
      <div className="flex justify-center">
        <div className="p-4 bg-accent-primary/10 rounded-2xl text-accent-primary">
          <LinkIcon size={40} />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-content-primary mb-2">Connect Your Concept2 Logbook</h2>
        <p className="text-content-muted text-sm max-w-sm mx-auto">
          Link your Concept2 account to automatically import all your erg workouts, track lifetime meters, and unlock performance analytics.
        </p>
      </div>
      <button
        onClick={handleConnect}
        className="bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold py-3 px-8 rounded-xl transition-colors inline-flex items-center gap-2"
      >
        <LinkIcon size={18} />
        Connect Logbook
      </button>
      <div>
        <button onClick={skip} className="text-content-muted hover:text-content-secondary text-sm transition-colors">
          Skip for now
        </button>
      </div>
    </div>
  );

  const StepBaseline = () => (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-content-primary mb-2">Set Your Baseline</h2>
        <p className="text-content-muted text-sm max-w-sm mx-auto">
          These help power training zones and personalized analytics. You can always update them later in Preferences.
        </p>
      </div>
      <div className="max-w-sm mx-auto space-y-4">
        <div>
          <label htmlFor="onboard-weight" className="block text-sm font-medium text-content-secondary mb-1">
            Body Weight ({weightLabel})
          </label>
          <input
            id="onboard-weight"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={unitPref === 'metric' ? '80' : '175'}
            className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2.5 text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary"
          />
        </div>
        <div>
          <label htmlFor="onboard-2k" className="block text-sm font-medium text-content-secondary mb-1">
            2k PR Time (MM:SS)
          </label>
          <input
            id="onboard-2k"
            type="text"
            value={twoKTime}
            onChange={(e) => setTwoKTime(e.target.value)}
            placeholder="7:00"
            className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2.5 text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary"
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={advance}
          className="bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold py-3 px-8 rounded-xl transition-colors inline-flex items-center gap-2"
        >
          Continue <ChevronRight size={18} />
        </button>
        <button onClick={skip} className="text-content-muted hover:text-content-secondary text-sm transition-colors">
          Skip for now
        </button>
      </div>
    </div>
  );

  const StepGoal = () => (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-content-primary mb-2">Set Your First Goal</h2>
        <p className="text-content-muted text-sm max-w-sm mx-auto">
          Goals keep you motivated. Pick one to get started — you can add more anytime.
        </p>
      </div>
      <div className="max-w-sm mx-auto space-y-4">
        <div>
          <label htmlFor="onboard-goal-type" className="block text-sm font-medium text-content-secondary mb-1">
            Goal Type
          </label>
          <select
            id="onboard-goal-type"
            value={goalTypeIdx}
            onChange={(e) => { setGoalTypeIdx(Number(e.target.value)); setGoalValue(''); }}
            className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2.5 text-content-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary"
          >
            {GOAL_TYPES.map((g, i) => (
              <option key={g.value} value={i}>{g.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="onboard-goal-value" className="block text-sm font-medium text-content-secondary mb-1">
            Target ({GOAL_TYPES[goalTypeIdx].unit})
          </label>
          <input
            id="onboard-goal-value"
            type="number"
            value={goalValue}
            onChange={(e) => setGoalValue(e.target.value)}
            placeholder={GOAL_TYPES[goalTypeIdx].placeholder}
            className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2.5 text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary"
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => finish()}
          disabled={saving}
          className="bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 text-white font-semibold py-3 px-8 rounded-xl transition-colors inline-flex items-center gap-2"
        >
          {saving ? 'Saving…' : <><Check size={18} /> Finish</>}
        </button>
        <button
          onClick={() => { setGoalValue(''); finish(); }}
          disabled={saving}
          className="text-content-muted hover:text-content-secondary text-sm transition-colors disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );

  const stepContent = [StepWelcome, StepConnectC2, StepBaseline, StepGoal];
  const CurrentStep = stepContent[step];

  return (
    <Modal
      open={open}
      onClose={() => {}}
      size="lg"
      closeOnBackdrop={false}
      closeOnEscape={false}
    >
      <ProgressDots />
      <CurrentStep />
    </Modal>
  );
};
