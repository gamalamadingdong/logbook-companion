import {
  translateWorkoutToPm5,
  type Pm5TranslationMode,
} from '@readyall/rwn';
import type { ActiveWorkoutSpec } from '../types/ergSession.types';
import type { WorkoutStructure } from '../types/workoutStructure.types';

export type Pm5LoweringMode = Pm5TranslationMode;

export interface Pm5LoweringResult {
  mode: Pm5LoweringMode;
  activeWorkoutSpec: ActiveWorkoutSpec | null;
  notes: string[];
}

export const lowerWorkoutStructureToPm5 = (structure: WorkoutStructure): Pm5LoweringResult => {
  const lowered = translateWorkoutToPm5(structure);
  return {
    mode: lowered.mode,
    activeWorkoutSpec: lowered.workout as ActiveWorkoutSpec | null,
    notes: lowered.notes,
  };
};
