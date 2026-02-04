/**
 * Find the best matching template for a workout by canonical name
 * Priority: User's own templates first, then most popular community templates
 */

import { supabase } from '../services/supabase';
import { normalizeForMatching } from './workoutNormalization';

export interface MatchedTemplate {
  id: string;
  name: string;
  canonical_name: string;
  usage_count: number;
  created_by: string | null;
}

/**
 * Find best matching template by canonical name
 * @param userId - Current user's ID (for priority matching)
 * @param canonicalName - The canonical RWN representation to match
 * @returns The best matching template, or null if none found
 */
export async function findBestMatchingTemplate(
  userId: string,
  canonicalName: string | null
): Promise<MatchedTemplate | null> {
  if (!canonicalName) {
    return null;
  }

  // Normalize for matching (strips block tags, normalizes spacing)
  const normalizedName = normalizeForMatching(canonicalName);

  // Query all templates with matching canonical_name
  const { data: templates, error } = await supabase
    .from('workout_templates')
    .select('id, name, canonical_name, usage_count, created_by')
    .eq('canonical_name', normalizedName)
    .order('usage_count', { ascending: false });

  if (error || !templates || templates.length === 0) {
    return null;
  }

  // Priority 1: User's own templates (created_by = userId)
  const userTemplate = templates.find(t => t.created_by === userId);
  if (userTemplate) {
    return userTemplate;
  }

  // Priority 2: Most popular community template (already sorted by usage_count DESC)
  return templates[0];
}

/**
 * Match and update workout with template_id
 * @param workoutId - ID of the workout_log to update
 * @param userId - Current user's ID
 * @param canonicalName - Canonical RWN to match against templates
 * @returns true if matched and updated, false otherwise
 */
export async function matchWorkoutToTemplate(
  workoutId: string,
  userId: string,
  canonicalName: string | null
): Promise<boolean> {
  const template = await findBestMatchingTemplate(userId, canonicalName);

  if (!template) {
    return false;
  }

  // Update workout_log with matched template_id
  const { error } = await supabase
    .from('workout_logs')
    .update({ template_id: template.id })
    .eq('id', workoutId);

  if (error) {
    console.error('Error updating workout with template_id:', error);
    return false;
  }

  return true;
}
