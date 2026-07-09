-- Add lightweight movement-family metadata so support-work alternatives can be
-- ranked by intent first, then equipment compatibility.

WITH family_seed(exercise_key, family) AS (
  VALUES
    ('romanian_deadlift', 'hinge'),
    ('conventional_deadlift', 'hinge'),
    ('trap_bar_deadlift', 'hinge'),
    ('sumo_deadlift', 'hinge'),
    ('dumbbell_romanian_deadlift', 'hinge'),
    ('single_leg_romanian_deadlift', 'hinge'),
    ('good_morning', 'hinge'),
    ('kettlebell_swing', 'hinge'),
    ('hip_thrust', 'hip_extension'),
    ('glute_bridge', 'hip_extension'),
    ('hamstring_curl', 'hamstring_knee_flexion'),
    ('nordic_hamstring_curl', 'hamstring_knee_flexion'),
    ('front_squat', 'squat'),
    ('back_squat', 'squat'),
    ('goblet_squat', 'squat'),
    ('leg_press', 'squat'),
    ('bulgarian_split_squat', 'single_leg_squat_lunge'),
    ('walking_lunge', 'single_leg_squat_lunge'),
    ('reverse_lunge', 'single_leg_squat_lunge'),
    ('lateral_lunge', 'single_leg_squat_lunge'),
    ('step_up', 'single_leg_squat_lunge'),
    ('pendlay_row', 'horizontal_pull'),
    ('bench_pull', 'horizontal_pull'),
    ('bent_over_barbell_row', 'horizontal_pull'),
    ('chest_supported_dumbbell_row', 'horizontal_pull'),
    ('seated_cable_row', 'horizontal_pull'),
    ('single_arm_dumbbell_row', 'horizontal_pull'),
    ('inverted_row', 'horizontal_pull'),
    ('weighted_pull_up', 'vertical_pull'),
    ('pull_up', 'vertical_pull'),
    ('lat_pulldown', 'vertical_pull'),
    ('push_up', 'horizontal_push'),
    ('bench_press', 'horizontal_push'),
    ('dumbbell_bench_press', 'horizontal_push'),
    ('overhead_press', 'vertical_or_diagonal_push'),
    ('landmine_press', 'vertical_or_diagonal_push'),
    ('half_kneeling_single_arm_press', 'vertical_or_diagonal_push'),
    ('farmer_carry', 'loaded_carry'),
    ('front_rack_carry', 'loaded_carry'),
    ('suitcase_carry', 'loaded_carry'),
    ('forearm_plank', 'anti_extension_core'),
    ('dead_bug', 'anti_extension_core'),
    ('ab_wheel_rollout', 'anti_extension_core'),
    ('hollow_hold', 'anti_extension_core'),
    ('stir_the_pot', 'anti_extension_core'),
    ('pallof_press', 'anti_rotation_core'),
    ('tall_kneeling_pallof_press', 'anti_rotation_core'),
    ('bird_dog', 'anti_rotation_core'),
    ('half_kneeling_chop', 'anti_rotation_core'),
    ('half_kneeling_lift', 'anti_rotation_core'),
    ('face_pull', 'shoulder_prehab_pull'),
    ('band_pull_apart', 'shoulder_prehab_pull'),
    ('band_shoulder_external_rotation', 'shoulder_external_rotation'),
    ('cable_shoulder_external_rotation', 'shoulder_external_rotation'),
    ('banded_no_money_drill', 'shoulder_external_rotation')
)
UPDATE public.support_exercises e
SET metadata = jsonb_set(
    COALESCE(e.metadata, '{}'::jsonb),
    '{support_work_family}',
    to_jsonb(f.family),
    true
),
updated_at = now()
FROM family_seed f
WHERE e.exercise_key = f.exercise_key
  AND e.user_id IS NULL;
