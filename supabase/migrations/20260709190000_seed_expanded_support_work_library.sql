-- Expand the canonical support-work exercise catalog and give exercises stable
-- upsert keys to match support_session_templates.template_key.

ALTER TABLE public.support_exercises
  ADD COLUMN IF NOT EXISTS exercise_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'support_exercises_exercise_key_format'
      AND conrelid = 'public.support_exercises'::regclass
  ) THEN
    ALTER TABLE public.support_exercises
      ADD CONSTRAINT support_exercises_exercise_key_format
      CHECK (exercise_key IS NULL OR exercise_key ~ '^[a-z0-9_]+$')
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.support_exercises
  VALIDATE CONSTRAINT support_exercises_exercise_key_format;

CREATE UNIQUE INDEX IF NOT EXISTS support_exercises_global_key_unique
  ON public.support_exercises (exercise_key)
  WHERE user_id IS NULL AND exercise_key IS NOT NULL;

WITH legacy_key_seed(name, exercise_key) AS (
  VALUES
    ('Deadlift or Romanian Deadlift', 'legacy_deadlift_or_romanian_deadlift'),
    ('Pendlay Row or Bench Pull', 'legacy_pendlay_row_or_bench_pull'),
    ('Weighted Pull-ups or Lat Pulldown', 'legacy_weighted_pull_up_or_lat_pulldown'),
    ('Face Pulls', 'legacy_face_pulls'),
    ('Front Squat or Back Squat', 'legacy_front_squat_or_back_squat'),
    ('Overhead Press or Flat Bench Press', 'legacy_overhead_press_or_flat_bench_press'),
    ('Walking Lunges', 'legacy_walking_lunges'),
    ('Ab Wheel Rollouts', 'legacy_ab_wheel_rollouts')
)
UPDATE public.support_exercises e
SET exercise_key = l.exercise_key,
    metadata = e.metadata || jsonb_build_object('superseded_by_seed', 'expanded_support_work_library_v1'),
    updated_at = now()
FROM legacy_key_seed l
WHERE e.user_id IS NULL
  AND e.name = l.name
  AND e.exercise_key IS NULL;

WITH exercise_seed(
  exercise_key,
  name,
  category,
  movement_pattern,
  equipment,
  default_sets,
  default_reps,
  default_duration_seconds,
  cues,
  tags
) AS (
  VALUES
    ('romanian_deadlift', 'Romanian Deadlift', 'strength', 'hinge', ARRAY['barbell'], 4, '6-8', NULL::integer, ARRAY['Hinge from the hips with a neutral spine.', 'Keep the bar close and stop before form breaks.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_intermediate']),
    ('conventional_deadlift', 'Conventional Deadlift', 'strength', 'hinge', ARRAY['barbell'], 3, '5-6', NULL::integer, ARRAY['Brace before the pull and keep the bar close.', 'Use submaximal loads for support work.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_advanced']),
    ('trap_bar_deadlift', 'Trap Bar Deadlift', 'strength', 'hinge', ARRAY['trap bar'], 3, '5-8', NULL::integer, ARRAY['Push the floor away and keep ribs stacked over pelvis.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_intermediate']),
    ('sumo_deadlift', 'Sumo Deadlift', 'strength', 'hinge', ARRAY['barbell'], 3, '5-6', NULL::integer, ARRAY['Keep knees tracking with toes and brace before each rep.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_advanced']),
    ('dumbbell_romanian_deadlift', 'Dumbbell Romanian Deadlift', 'strength', 'hinge', ARRAY['dumbbells'], 3, '8-10', NULL::integer, ARRAY['Reach hips back and keep the weights close to the legs.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_beginner']),
    ('single_leg_romanian_deadlift', 'Single-Leg Romanian Deadlift', 'strength', 'single-leg hinge', ARRAY['bodyweight','dumbbells'], 3, '8/side', NULL::integer, ARRAY['Move slowly and keep hips square.'], ARRAY['rowing','posterior_chain','hip_hinge','single_leg','strength','difficulty_intermediate']),
    ('good_morning', 'Good Morning', 'strength', 'hinge', ARRAY['barbell'], 3, '8', NULL::integer, ARRAY['Use light loads and keep the hinge controlled.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_advanced']),
    ('kettlebell_swing', 'Kettlebell Swing', 'strength', 'hinge power', ARRAY['kettlebell'], 3, '12-15', NULL::integer, ARRAY['Snap from the hips, not the low back.'], ARRAY['rowing','posterior_chain','hip_hinge','power','difficulty_intermediate']),
    ('hip_thrust', 'Hip Thrust', 'strength', 'hip extension', ARRAY['barbell','bench'], 3, '8-10', NULL::integer, ARRAY['Finish with glutes, not low-back extension.'], ARRAY['rowing','posterior_chain','strength','difficulty_intermediate']),
    ('glute_bridge', 'Glute Bridge', 'strength', 'hip extension', ARRAY['bodyweight','band'], 3, '12-15', NULL::integer, ARRAY['Pause briefly at the top with ribs down.'], ARRAY['rowing','posterior_chain','warmup','strength','difficulty_beginner']),
    ('hamstring_curl', 'Hamstring Curl', 'strength', 'knee flexion', ARRAY['machine','stability ball'], 3, '10-12', NULL::integer, ARRAY['Control the eccentric and avoid hip sag.'], ARRAY['rowing','posterior_chain','strength','difficulty_beginner']),
    ('nordic_hamstring_curl', 'Nordic Hamstring Curl', 'strength', 'knee flexion', ARRAY['bodyweight'], 2, '4-6', NULL::integer, ARRAY['Use assistance as needed and avoid forced range.'], ARRAY['rowing','posterior_chain','strength','difficulty_advanced']),
    ('calf_raise', 'Calf Raise', 'strength', 'ankle extension', ARRAY['bodyweight','dumbbells'], 3, '12-15', NULL::integer, ARRAY['Move through a controlled full range.'], ARRAY['rowing','strength','difficulty_beginner']),
    ('front_squat', 'Front Squat', 'strength', 'squat', ARRAY['barbell'], 4, '6-8', NULL::integer, ARRAY['Stay tall and keep elbows lifted.'], ARRAY['rowing','squat','strength','difficulty_intermediate']),
    ('back_squat', 'Back Squat', 'strength', 'squat', ARRAY['barbell'], 4, '6-8', NULL::integer, ARRAY['Brace and keep reps smooth; no grinders.'], ARRAY['rowing','squat','strength','difficulty_advanced']),
    ('goblet_squat', 'Goblet Squat', 'strength', 'squat', ARRAY['kettlebell','dumbbell'], 3, '8-12', NULL::integer, ARRAY['Sit between the hips and keep chest organized.'], ARRAY['rowing','squat','strength','difficulty_beginner']),
    ('leg_press', 'Leg Press', 'strength', 'squat press', ARRAY['machine'], 3, '10', NULL::integer, ARRAY['Use controlled depth and avoid locking out hard.'], ARRAY['rowing','squat','strength','difficulty_beginner']),
    ('bulgarian_split_squat', 'Bulgarian Split Squat', 'strength', 'single-leg squat', ARRAY['dumbbells','bodyweight'], 3, '8/side', NULL::integer, ARRAY['Keep pelvis level and front foot planted.'], ARRAY['rowing','single_leg','squat','strength','difficulty_intermediate']),
    ('walking_lunge', 'Walking Lunge', 'strength', 'lunge', ARRAY['dumbbells','bodyweight'], 3, '10 steps/leg', NULL::integer, ARRAY['Stay tall and step with control.'], ARRAY['rowing','single_leg','strength','difficulty_intermediate']),
    ('reverse_lunge', 'Reverse Lunge', 'strength', 'lunge', ARRAY['dumbbells','bodyweight'], 3, '8/side', NULL::integer, ARRAY['Step back softly and keep the front knee tracking.'], ARRAY['rowing','single_leg','strength','difficulty_beginner']),
    ('lateral_lunge', 'Lateral Lunge', 'strength', 'frontal-plane lunge', ARRAY['bodyweight','dumbbells'], 3, '8/side', NULL::integer, ARRAY['Sit into the hip and keep the trail leg long.'], ARRAY['rowing','single_leg','mobility','strength','difficulty_intermediate']),
    ('step_up', 'Step-Up', 'strength', 'single-leg', ARRAY['box','dumbbells'], 3, '8/side', NULL::integer, ARRAY['Drive through the full foot and control the descent.'], ARRAY['rowing','single_leg','strength','difficulty_beginner']),
    ('sled_push_drag', 'Sled Push / Sled Drag', 'strength', 'leg drive conditioning', ARRAY['sled'], 4, '20-30 m', NULL::integer, ARRAY['Keep efforts crisp and avoid turning it into an all-out test.'], ARRAY['rowing','conditioning','leg_drive','difficulty_intermediate']),
    ('squat_jump', 'Squat Jump', 'strength', 'plyometric squat', ARRAY['bodyweight'], 3, '5-8', NULL::integer, ARRAY['Land quietly and stop before jump quality drops.'], ARRAY['rowing','power','plyometric','difficulty_advanced']),
    ('burpee', 'Burpee', 'strength', 'full-body conditioning', ARRAY['bodyweight'], 3, '6-10', NULL::integer, ARRAY['Keep reps clean and avoid sloppy fatigue volume.'], ARRAY['conditioning','full_body','difficulty_advanced']),
    ('pendlay_row', 'Pendlay Row', 'strength', 'horizontal pull', ARRAY['barbell'], 4, '8', NULL::integer, ARRAY['Brace hard and reset each rep from the floor.'], ARRAY['rowing','horizontal_pull','posterior_chain','strength','difficulty_advanced']),
    ('bench_pull', 'Bench Pull', 'strength', 'horizontal pull', ARRAY['bench','barbell'], 4, '8', NULL::integer, ARRAY['Pull to the bench without jerking the torso.'], ARRAY['rowing','horizontal_pull','strength','difficulty_intermediate']),
    ('bent_over_barbell_row', 'Bent-Over Barbell Row', 'strength', 'horizontal pull', ARRAY['barbell'], 3, '8-10', NULL::integer, ARRAY['Hold the hinge and avoid heaving the bar.'], ARRAY['rowing','horizontal_pull','posterior_chain','strength','difficulty_intermediate']),
    ('chest_supported_dumbbell_row', 'Chest-Supported Dumbbell Row', 'strength', 'horizontal pull', ARRAY['bench','dumbbells'], 3, '10', NULL::integer, ARRAY['Keep chest supported and pull elbows back.'], ARRAY['rowing','horizontal_pull','strength','difficulty_beginner']),
    ('seated_cable_row', 'Seated Cable Row', 'strength', 'horizontal pull', ARRAY['cable'], 3, '8-12', NULL::integer, ARRAY['Stay tall and finish with shoulder blades.'], ARRAY['rowing','horizontal_pull','strength','difficulty_beginner']),
    ('single_arm_dumbbell_row', 'Single-Arm Dumbbell Row', 'strength', 'horizontal pull', ARRAY['dumbbell'], 3, '8-10/side', NULL::integer, ARRAY['Keep the torso quiet and pull through the elbow.'], ARRAY['rowing','horizontal_pull','strength','difficulty_beginner']),
    ('inverted_row', 'Inverted Row', 'strength', 'horizontal pull', ARRAY['bodyweight','bar'], 3, '8-12', NULL::integer, ARRAY['Keep a straight body line and pull chest to bar.'], ARRAY['rowing','horizontal_pull','bodyweight','strength','difficulty_beginner']),
    ('weighted_pull_up', 'Weighted Pull-Up', 'strength', 'vertical pull', ARRAY['bodyweight','weight'], 3, '6-8', NULL::integer, ARRAY['Use only when strict pull-ups are already solid.'], ARRAY['rowing','vertical_pull','strength','difficulty_advanced']),
    ('pull_up', 'Pull-Up', 'strength', 'vertical pull', ARRAY['bodyweight'], 3, '6-10', NULL::integer, ARRAY['Use full range without swinging.'], ARRAY['rowing','vertical_pull','strength','difficulty_intermediate']),
    ('lat_pulldown', 'Lat Pulldown', 'strength', 'vertical pull', ARRAY['cable'], 3, '8-10', NULL::integer, ARRAY['Pull elbows down and avoid leaning back excessively.'], ARRAY['rowing','vertical_pull','strength','difficulty_beginner']),
    ('push_up', 'Push-Up', 'strength', 'horizontal push', ARRAY['bodyweight'], 3, '10-20', NULL::integer, ARRAY['Keep ribs down and body line straight.'], ARRAY['rowing','push','strength','difficulty_beginner']),
    ('bench_press', 'Bench Press', 'strength', 'horizontal push', ARRAY['barbell','bench'], 4, '8', NULL::integer, ARRAY['Control the eccentric and keep shoulders organized.'], ARRAY['rowing','push','strength','difficulty_intermediate']),
    ('dumbbell_bench_press', 'Dumbbell Bench Press', 'strength', 'horizontal push', ARRAY['dumbbells','bench'], 3, '8-10', NULL::integer, ARRAY['Keep wrists stacked and press evenly.'], ARRAY['rowing','push','strength','difficulty_beginner']),
    ('overhead_press', 'Overhead Press', 'strength', 'vertical push', ARRAY['barbell','dumbbells'], 4, '8', NULL::integer, ARRAY['Brace glutes and ribs before pressing.'], ARRAY['rowing','push','strength','difficulty_intermediate']),
    ('landmine_press', 'Landmine Press', 'strength', 'diagonal push', ARRAY['barbell','landmine'], 3, '8/side', NULL::integer, ARRAY['Press up and forward without shrugging.'], ARRAY['rowing','push','shoulder_health','strength','difficulty_beginner']),
    ('half_kneeling_single_arm_press', 'Half-Kneeling Single-Arm Press', 'strength', 'vertical push', ARRAY['dumbbell','kettlebell'], 3, '8/side', NULL::integer, ARRAY['Stay tall and avoid leaning away from the press.'], ARRAY['rowing','push','core_stability','strength','difficulty_intermediate']),
    ('farmer_carry', 'Farmer Carry', 'strength', 'carry', ARRAY['dumbbells','kettlebells'], 3, NULL::text, 45, ARRAY['Walk tall with quiet ribs and level shoulders.'], ARRAY['rowing','carry','core_stability','strength','difficulty_beginner']),
    ('front_rack_carry', 'Front Rack Carry', 'strength', 'brace carry', ARRAY['kettlebells','dumbbells'], 3, NULL::text, 30, ARRAY['Keep elbows up and ribs stacked.'], ARRAY['rowing','carry','core_stability','strength','difficulty_intermediate']),
    ('suitcase_carry', 'Suitcase Carry', 'core', 'anti-lateral flexion', ARRAY['dumbbell','kettlebell'], 3, NULL::text, 30, ARRAY['Walk tall without leaning toward the load.'], ARRAY['rowing','carry','core_stability','anti_lateral_flexion','difficulty_beginner']),
    ('forearm_plank', 'Forearm Plank', 'core', 'brace', ARRAY['bodyweight'], 3, NULL::text, 60, ARRAY['Brace without holding your breath.'], ARRAY['rowing','core_stability','anti_extension','difficulty_beginner']),
    ('side_plank', 'Side Plank', 'core', 'lateral brace', ARRAY['bodyweight'], 3, NULL::text, 30, ARRAY['Keep hips stacked and body long.'], ARRAY['rowing','core_stability','anti_lateral_flexion','difficulty_beginner']),
    ('dead_bug', 'Dead Bug', 'core', 'anti-extension', ARRAY['bodyweight'], 3, '15/side', NULL::integer, ARRAY['Move slowly while keeping the low back quiet.'], ARRAY['rowing','core_stability','anti_extension','difficulty_beginner']),
    ('bird_dog', 'Bird Dog', 'core', 'anti-rotation', ARRAY['bodyweight'], 3, '10/side', NULL::integer, ARRAY['Reach long without rotating the hips.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_beginner']),
    ('pallof_press', 'Pallof Press', 'core', 'anti-rotation', ARRAY['cable','band'], 3, '12/side', NULL::integer, ARRAY['Resist rotation and keep shoulders relaxed.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_beginner']),
    ('tall_kneeling_pallof_press', 'Tall-Kneeling Pallof Press', 'core', 'anti-rotation', ARRAY['cable','band'], 3, '10/side', NULL::integer, ARRAY['Keep glutes engaged and press straight out.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_beginner']),
    ('ab_wheel_rollout', 'Ab Wheel Rollout', 'core', 'anti-extension', ARRAY['ab wheel'], 3, '10-12', NULL::integer, ARRAY['Shorten range if the low back extends.'], ARRAY['rowing','core_stability','anti_extension','difficulty_advanced']),
    ('hollow_hold', 'Hollow Hold', 'core', 'brace', ARRAY['bodyweight'], 3, NULL::text, 30, ARRAY['Keep low ribs down and scale lever length.'], ARRAY['rowing','core_stability','anti_extension','difficulty_intermediate']),
    ('copenhagen_plank', 'Copenhagen Plank', 'core', 'adductor brace', ARRAY['bench','bodyweight'], 2, NULL::text, 20, ARRAY['Start short-lever if needed and avoid hip sag.'], ARRAY['rowing','core_stability','prehab','difficulty_advanced']),
    ('bear_crawl', 'Bear Crawl', 'core', 'anti-rotation brace', ARRAY['bodyweight'], 3, '20-30 m', NULL::integer, ARRAY['Move slowly and keep hips level.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_intermediate']),
    ('stir_the_pot', 'Stir-the-Pot', 'core', 'anti-extension', ARRAY['stability ball'], 3, '8-12 circles', NULL::integer, ARRAY['Keep circles small enough to maintain trunk position.'], ARRAY['rowing','core_stability','anti_extension','difficulty_intermediate']),
    ('half_kneeling_chop', 'Half-Kneeling Chop', 'core', 'rotation control', ARRAY['cable','band'], 3, '10/side', NULL::integer, ARRAY['Rotate through the upper back with hips steady.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_intermediate']),
    ('half_kneeling_lift', 'Half-Kneeling Lift', 'core', 'rotation control', ARRAY['cable','band'], 3, '10/side', NULL::integer, ARRAY['Control the diagonal path without arching.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_intermediate']),
    ('reverse_crunch', 'Reverse Crunch', 'core', 'posterior pelvic tilt', ARRAY['bodyweight'], 3, '10-15', NULL::integer, ARRAY['Curl the pelvis instead of swinging the legs.'], ARRAY['rowing','core_stability','difficulty_beginner']),
    ('hanging_knee_raise', 'Hanging Knee Raise', 'core', 'trunk flexion control', ARRAY['pull-up bar'], 3, '8-12', NULL::integer, ARRAY['Control the lower and avoid swinging.'], ARRAY['rowing','core_stability','difficulty_intermediate']),
    ('plank_shoulder_tap', 'Plank Shoulder Tap', 'core', 'anti-rotation', ARRAY['bodyweight'], 3, '10/side', NULL::integer, ARRAY['Keep hips quiet as the hand lifts.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_intermediate']),
    ('dead_bug_pullover', 'Dead Bug Pullover', 'core', 'anti-extension', ARRAY['dumbbell','kettlebell'], 3, '8-10', NULL::integer, ARRAY['Move arms without letting ribs flare.'], ARRAY['rowing','core_stability','anti_extension','difficulty_intermediate']),
    ('sculling_sit_up', 'Sculling Sit-Up', 'core', 'trunk endurance', ARRAY['bodyweight'], 3, '10-15', NULL::integer, ARRAY['Use controlled trunk movement; avoid yanking the neck.'], ARRAY['rowing','core_stability','trunk_endurance','difficulty_intermediate']),
    ('seated_pike_compression', 'Seated Pike Compression', 'core', 'hip flexor compression', ARRAY['bodyweight'], 3, '8-12', NULL::integer, ARRAY['Keep the spine long and lift with control.'], ARRAY['core_stability','hip_flexor','difficulty_advanced']),
    ('face_pull', 'Face Pull', 'prehab', 'shoulder/scapular', ARRAY['cable','band'], 3, '15', NULL::integer, ARRAY['Pull toward eye level with light, clean scapular control.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('band_pull_apart', 'Band Pull-Apart', 'prehab', 'shoulder/scapular', ARRAY['band'], 3, '15-20', NULL::integer, ARRAY['Keep ribs quiet and move from the upper back.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('band_shoulder_external_rotation', 'Band Shoulder External Rotation', 'prehab', 'shoulder rotation', ARRAY['band'], 3, '12-15/side', NULL::integer, ARRAY['Keep elbow pinned and rotate without shrugging.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('cable_shoulder_external_rotation', 'Cable Shoulder External Rotation', 'prehab', 'shoulder rotation', ARRAY['cable'], 3, '12-15/side', NULL::integer, ARRAY['Use light load and keep shoulder blade set.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('prone_y_t_w_raise', 'Prone Y-T-W Raise', 'prehab', 'scapular control', ARRAY['bodyweight','light dumbbells'], 2, '8 each', NULL::integer, ARRAY['Move slowly and avoid shrugging.'], ARRAY['rowing','shoulder_health','prehab','difficulty_intermediate']),
    ('scapular_push_up', 'Scapular Push-Up', 'prehab', 'serratus/scapula', ARRAY['bodyweight'], 2, '10-15', NULL::integer, ARRAY['Keep elbows straight and glide shoulder blades.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('scapular_pull_up', 'Scapular Pull-Up', 'prehab', 'scapular depression', ARRAY['pull-up bar'], 2, '6-10', NULL::integer, ARRAY['Move only the shoulder blades; do not bend elbows.'], ARRAY['rowing','shoulder_health','prehab','difficulty_intermediate']),
    ('serratus_wall_slide', 'Serratus Wall Slide', 'prehab', 'serratus/shoulder', ARRAY['wall','band'], 2, '10', NULL::integer, ARRAY['Reach long without arching the low back.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('banded_no_money_drill', 'Banded No-Money Drill', 'prehab', 'external rotation', ARRAY['band'], 2, '12-15', NULL::integer, ARRAY['Keep elbows by sides and rotate gently.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('prone_trap_3_raise', 'Prone Trap-3 Raise', 'prehab', 'lower trap', ARRAY['bench','light dumbbell'], 2, '8-12', NULL::integer, ARRAY['Reach on a diagonal and keep the neck relaxed.'], ARRAY['rowing','shoulder_health','prehab','difficulty_intermediate']),
    ('cuban_rotation', 'Cuban Rotation', 'prehab', 'rotator cuff', ARRAY['light dumbbells','barbell'], 2, '10', NULL::integer, ARRAY['Use very light load and controlled range only.'], ARRAY['shoulder_health','prehab','difficulty_advanced']),
    ('terminal_knee_extension', 'Terminal Knee Extension', 'prehab', 'knee control', ARRAY['band'], 2, '15/side', NULL::integer, ARRAY['Lock in quad control without snapping the knee.'], ARRAY['prehab','knee_control','difficulty_beginner']),
    ('tibialis_raise', 'Tibialis Raise', 'prehab', 'ankle dorsiflexion strength', ARRAY['bodyweight'], 2, '15-20', NULL::integer, ARRAY['Lift toes smoothly and control the lower.'], ARRAY['prehab','ankle','difficulty_beginner']),
    ('eccentric_calf_lowering', 'Eccentric Calf Lowering', 'prehab', 'calf/Achilles', ARRAY['step','bodyweight'], 2, '8-12/side', NULL::integer, ARRAY['Lower slowly and use support for balance.'], ARRAY['prehab','calf','difficulty_intermediate']),
    ('banded_lateral_walk', 'Banded Lateral Walk', 'prehab', 'glute med/hip', ARRAY['band'], 2, '10-15 steps/side', NULL::integer, ARRAY['Keep toes forward and pelvis level.'], ARRAY['rowing','hip','prehab','difficulty_beginner']),
    ('worlds_greatest_stretch', 'World''s Greatest Stretch', 'mobility', 'hip/thoracic', ARRAY['bodyweight'], 1, '10/side', NULL::integer, ARRAY['Move gradually through hip and thoracic range.'], ARRAY['rowing','mobility','warmup','difficulty_beginner']),
    ('cat_cow', 'Cat-Cow', 'mobility', 'spine', ARRAY['bodyweight'], 1, '15', NULL::integer, ARRAY['Move segmentally without forcing end range.'], ARRAY['rowing','mobility','warmup','difficulty_beginner']),
    ('banded_shoulder_pass_through', 'Banded Shoulder Pass-Through', 'mobility', 'shoulder', ARRAY['band'], 1, '20', NULL::integer, ARRAY['Use a wide grip and pain-free range.'], ARRAY['rowing','mobility','shoulder_health','warmup','difficulty_beginner']),
    ('ankle_dorsiflexion_rock_back', 'Ankle Dorsiflexion Rock-Back', 'mobility', 'ankle', ARRAY['bodyweight'], 2, '10-15/side', NULL::integer, ARRAY['Keep heel down and knee tracking over toes.'], ARRAY['rowing','mobility','warmup','difficulty_beginner']),
    ('thoracic_foam_roll_extension', 'Thoracic Foam Roll Extension', 'mobility', 'thoracic spine', ARRAY['foam roller'], 1, NULL::text, 45, ARRAY['Extend through the upper back, not the neck.'], ARRAY['rowing','mobility','thoracic','difficulty_beginner']),
    ('ninety_ninety_hip_switch', '90/90 Hip Switch', 'mobility', 'hip rotation', ARRAY['bodyweight'], 2, '8/side', NULL::integer, ARRAY['Rotate under control without rushing.'], ARRAY['rowing','mobility','hip','difficulty_beginner']),
    ('hip_cars', 'Hip CARs', 'mobility', 'hip control', ARRAY['bodyweight'], 2, '5/side', NULL::integer, ARRAY['Move slowly through controlled range.'], ARRAY['rowing','mobility','hip','difficulty_intermediate']),
    ('shoulder_cars', 'Shoulder CARs', 'mobility', 'shoulder control', ARRAY['bodyweight'], 2, '5/side', NULL::integer, ARRAY['Use pain-free range and keep ribs quiet.'], ARRAY['rowing','mobility','shoulder_health','difficulty_intermediate']),
    ('thoracic_open_book', 'Thoracic Open Book', 'mobility', 'thoracic rotation', ARRAY['bodyweight'], 2, '8/side', NULL::integer, ARRAY['Rotate through the upper back while hips stay stacked.'], ARRAY['rowing','mobility','thoracic','difficulty_beginner']),
    ('quadruped_t_spine_rotation', 'Quadruped T-Spine Rotation', 'mobility', 'thoracic rotation', ARRAY['bodyweight'], 2, '8/side', NULL::integer, ARRAY['Follow the elbow with your eyes and avoid shifting hips.'], ARRAY['rowing','mobility','thoracic','difficulty_beginner']),
    ('deep_squat_pry', 'Deep Squat Pry', 'mobility', 'squat mobility', ARRAY['bodyweight'], 2, NULL::text, 30, ARRAY['Use a comfortable depth and breathe into position.'], ARRAY['rowing','mobility','squat','difficulty_beginner']),
    ('adductor_rockback', 'Adductor Rockback', 'mobility', 'hip/adductor', ARRAY['bodyweight'], 2, '10/side', NULL::integer, ARRAY['Rock back slowly and keep spine neutral.'], ARRAY['rowing','mobility','hip','difficulty_beginner']),
    ('hip_flexor_rock_back', 'Hip Flexor Rock-Back', 'mobility', 'hip flexor', ARRAY['bodyweight'], 2, '10/side', NULL::integer, ARRAY['Move gently and avoid pinching in the front of the hip.'], ARRAY['rowing','mobility','hip','warmup','difficulty_beginner']),
    ('scapular_wall_slide', 'Scapular Wall Slide', 'mobility', 'shoulder/scapular', ARRAY['wall'], 2, '10', NULL::integer, ARRAY['Keep ribs down and slide in pain-free range.'], ARRAY['rowing','mobility','shoulder_health','difficulty_beginner']),
    ('banded_lat_mobilization', 'Banded Lat Mobilization', 'mobility', 'shoulder/lats', ARRAY['band'], 2, NULL::text, 30, ARRAY['Ease into the stretch and keep breathing.'], ARRAY['rowing','mobility','shoulder_health','difficulty_beginner']),
    ('wrist_extension_rocker', 'Wrist Extension Rocker', 'mobility', 'wrist/forearm', ARRAY['bodyweight'], 2, '10-15', NULL::integer, ARRAY['Use gentle pressure and avoid sharp wrist pain.'], ARRAY['rowing','mobility','difficulty_beginner']),
    ('hip_flexor_stretch', 'Hip Flexor Stretch', 'stretching', 'hip flexor', ARRAY['bodyweight'], 1, NULL::text, 30, ARRAY['Tuck pelvis slightly and breathe.'], ARRAY['rowing','stretching','hip','difficulty_beginner']),
    ('hamstring_stretch', 'Hamstring Stretch', 'stretching', 'posterior chain', ARRAY['bodyweight'], 1, NULL::text, 30, ARRAY['Keep the stretch mild and avoid bouncing.'], ARRAY['rowing','stretching','posterior_chain','difficulty_beginner']),
    ('figure_4_glute_stretch', 'Figure-4 Glute Stretch', 'stretching', 'hip/glute', ARRAY['bodyweight'], 1, NULL::text, 30, ARRAY['Relax into the hip without forcing the knee.'], ARRAY['rowing','stretching','hip','difficulty_beginner']),
    ('couch_stretch', 'Couch Stretch', 'stretching', 'hip flexor/quad', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Keep ribs down and adjust distance from the wall as needed.'], ARRAY['rowing','stretching','hip','difficulty_intermediate']),
    ('childs_pose_lat_stretch', 'Child''s Pose Lat Stretch', 'stretching', 'lats/thoracic', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Reach long and breathe into the ribs.'], ARRAY['rowing','stretching','lats','difficulty_beginner']),
    ('pigeon_stretch', 'Pigeon Stretch', 'stretching', 'glute/hip', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Use a regression if the knee feels stressed.'], ARRAY['rowing','stretching','hip','difficulty_intermediate']),
    ('seated_straddle_stretch', 'Seated Straddle Stretch', 'stretching', 'hamstring/adductor', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Sit tall and hinge gently.'], ARRAY['rowing','stretching','hip','difficulty_beginner']),
    ('supine_hamstring_band_stretch', 'Supine Hamstring Band Stretch', 'stretching', 'hamstring', ARRAY['band'], 1, NULL::text, 45, ARRAY['Keep the opposite leg relaxed and stretch mild.'], ARRAY['rowing','stretching','posterior_chain','difficulty_beginner']),
    ('kneeling_adductor_stretch', 'Kneeling Adductor Stretch', 'stretching', 'adductor', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Shift back slowly and stay in comfortable range.'], ARRAY['rowing','stretching','hip','difficulty_beginner']),
    ('lat_prayer_stretch', 'Lat Prayer Stretch', 'stretching', 'lats/thoracic', ARRAY['bench','box'], 1, NULL::text, 45, ARRAY['Reach hips back and breathe into the lats.'], ARRAY['rowing','stretching','lats','difficulty_beginner']),
    ('pec_doorway_stretch', 'Pec Doorway Stretch', 'stretching', 'pec/shoulder', ARRAY['doorway'], 1, NULL::text, 45, ARRAY['Keep shoulder relaxed and avoid numbness or tingling.'], ARRAY['rowing','stretching','shoulder_health','difficulty_beginner']),
    ('calf_wall_stretch', 'Calf Wall Stretch', 'stretching', 'calf/Achilles', ARRAY['wall'], 1, NULL::text, 45, ARRAY['Keep back knee straight and heel down.'], ARRAY['stretching','calf','difficulty_beginner']),
    ('soleus_wall_stretch', 'Soleus Wall Stretch', 'stretching', 'soleus/ankle', ARRAY['wall'], 1, NULL::text, 45, ARRAY['Bend the back knee while keeping heel down.'], ARRAY['stretching','ankle','difficulty_beginner']),
    ('prone_quad_stretch', 'Prone Quad Stretch', 'stretching', 'quad/hip flexor', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Keep hips heavy and avoid arching.'], ARRAY['rowing','stretching','hip','difficulty_beginner']),
    ('supine_spinal_twist', 'Supine Spinal Twist', 'stretching', 'low back/glute', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Let the rotation be easy and breathe slowly.'], ARRAY['rowing','stretching','recovery','difficulty_beginner']),
    ('foam_rolling_quadriceps_lateral_thigh', 'Foam Rolling Quadriceps and Lateral Thigh', 'recovery', 'soft tissue', ARRAY['foam roller'], 1, NULL::text, 60, ARRAY['Use moderate pressure over muscle tissue and avoid sharp pain.'], ARRAY['rowing','recovery','soft_tissue','difficulty_beginner']),
    ('easy_walk', 'Easy Walk', 'recovery', 'general recovery', ARRAY['none'], 1, NULL::text, 1200, ARRAY['Keep it genuinely easy and conversational.'], ARRAY['recovery','circulation','difficulty_beginner']),
    ('diaphragmatic_breathing', 'Diaphragmatic Breathing', 'recovery', 'nervous system downshift', ARRAY['none'], 1, NULL::text, 240, ARRAY['Breathe slowly through the nose when comfortable.'], ARRAY['rowing','recovery','breathing','difficulty_beginner']),
    ('ninety_ninety_breathing', '90/90 Breathing', 'recovery', 'ribcage/pelvis reset', ARRAY['wall'], 1, NULL::text, 240, ARRAY['Keep feet on wall and ribs heavy.'], ARRAY['rowing','recovery','breathing','difficulty_beginner']),
    ('legs_up_the_wall', 'Legs-Up-the-Wall', 'recovery', 'relaxation', ARRAY['wall'], 1, NULL::text, 480, ARRAY['Settle into an easy position and breathe slowly.'], ARRAY['recovery','relaxation','difficulty_beginner']),
    ('foam_roll_lats', 'Foam Roll Lats', 'recovery', 'soft tissue', ARRAY['foam roller'], 1, NULL::text, 60, ARRAY['Use moderate pressure and avoid numbness or tingling.'], ARRAY['rowing','recovery','soft_tissue','lats','difficulty_beginner']),
    ('foam_roll_t_spine', 'Foam Roll T-Spine', 'recovery', 'soft tissue/mobility', ARRAY['foam roller'], 1, NULL::text, 75, ARRAY['Roll the upper back, not the low back.'], ARRAY['rowing','recovery','soft_tissue','thoracic','difficulty_beginner']),
    ('foam_roll_glutes', 'Foam Roll Glutes', 'recovery', 'soft tissue', ARRAY['foam roller'], 1, NULL::text, 60, ARRAY['Use moderate pressure and slow passes.'], ARRAY['rowing','recovery','soft_tissue','hip','difficulty_beginner']),
    ('lacrosse_ball_pec_release', 'Lacrosse Ball Pec Release', 'recovery', 'soft tissue', ARRAY['lacrosse ball','wall'], 1, NULL::text, 60, ARRAY['Use gentle pressure and avoid nerve symptoms.'], ARRAY['rowing','recovery','soft_tissue','shoulder_health','difficulty_beginner']),
    ('lacrosse_ball_foot_roll', 'Lacrosse Ball Foot Roll', 'recovery', 'soft tissue', ARRAY['lacrosse ball'], 1, NULL::text, 60, ARRAY['Roll gently across the foot arch.'], ARRAY['recovery','soft_tissue','difficulty_beginner']),
    ('light_recovery_spin', 'Light Recovery Spin', 'recovery', 'circulation', ARRAY['bike'], 1, NULL::text, 1200, ARRAY['Keep resistance light and effort easy.'], ARRAY['recovery','cross_training','circulation','difficulty_beginner'])
)
INSERT INTO public.support_exercises (
  exercise_key,
  name,
  category,
  movement_pattern,
  equipment,
  default_sets,
  default_reps,
  default_duration_seconds,
  cues,
  contraindications,
  tags,
  status,
  user_id,
  visibility,
  metadata
)
SELECT
  exercise_key,
  name,
  category,
  movement_pattern,
  equipment,
  default_sets,
  default_reps,
  default_duration_seconds,
  cues,
  ARRAY[]::text[],
  tags,
  'published',
  NULL::uuid,
  'standard',
  jsonb_build_object('seed_source', 'expanded_support_work_library_v1', 'difficulty', replace((SELECT tag FROM unnest(tags) AS tag WHERE tag LIKE 'difficulty_%' LIMIT 1), 'difficulty_', ''))
FROM exercise_seed
ON CONFLICT (exercise_key) WHERE user_id IS NULL AND exercise_key IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  equipment = EXCLUDED.equipment,
  default_sets = EXCLUDED.default_sets,
  default_reps = EXCLUDED.default_reps,
  default_duration_seconds = EXCLUDED.default_duration_seconds,
  cues = EXCLUDED.cues,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  visibility = EXCLUDED.visibility,
  metadata = public.support_exercises.metadata || EXCLUDED.metadata,
  updated_at = now();

WITH template_seed(template_key, title, kind, description, estimated_duration_minutes, difficulty, focus, instructions) AS (
  VALUES
    ('standard_strength_pull_v1', 'Strength Pull', 'strength', 'Rowing-support pull session emphasizing posterior chain, upper back, and lats.', 35, 'intermediate', ARRAY['Posterior chain','Horizontal pull','Vertical pull'], ARRAY['Keep 1-2 reps in reserve.', 'Stop if form degrades.', 'Use loads that support rowing, not max testing.']),
    ('standard_strength_push_v1', 'Strength Push', 'strength', 'Upper-body and trunk-support push session for balanced strength.', 30, 'intermediate', ARRAY['Horizontal push','Vertical push','Carry'], ARRAY['Keep pressing controlled.', 'Avoid grinding reps.', 'Pair with easy rowing or non-key days.']),
    ('standard_lower_body_strength_v1', 'Lower Body Strength', 'strength', 'Conservative lower-body strength template for squat and single-leg work.', 35, 'intermediate', ARRAY['Squat','Single leg','Leg drive'], ARRAY['Prioritize range and control.', 'Use moderate load.', 'Do not add plyometrics when already fatigued.']),
    ('standard_posterior_chain_v1', 'Posterior Chain', 'strength', 'Hinge and hip-extension support work for rowing robustness.', 30, 'intermediate', ARRAY['Hinge','Glutes','Hamstrings'], ARRAY['Keep hinge quality high.', 'Avoid maximal loading.', 'Leave the back feeling better, not cooked.']),
    ('standard_core_stability_15_v1', 'Core Stability 15', 'core', 'Short trunk stability session for anti-extension, anti-rotation, and lateral bracing.', 15, 'beginner', ARRAY['Anti-extension','Anti-rotation','Lateral brace'], ARRAY['Move slowly.', 'Keep breathing.', 'Scale duration before quality drops.']),
    ('standard_shoulder_prehab_v1', 'Shoulder Prehab', 'prehab', 'Light scapular and rotator-cuff maintenance for rowing shoulders.', 15, 'beginner', ARRAY['Scapular control','External rotation','Serratus'], ARRAY['Use light resistance.', 'Avoid shrugging.', 'Stay in pain-free range.']),
    ('standard_hip_mobility_v1', 'Hip Mobility', 'mobility', 'Hip and thoracic mobility session for better setup and recovery positions.', 15, 'beginner', ARRAY['Hip rotation','Hip flexor','Thoracic rotation'], ARRAY['Move smoothly.', 'Avoid forcing end range.', 'Use before rowing or on recovery days.']),
    ('standard_dynamic_warm_up_v1', 'Dynamic Warm-Up', 'mobility', 'Short general warm-up before rowing, lifting, or support work.', 10, 'beginner', ARRAY['Warmup','Hip','Thoracic','Shoulder'], ARRAY['Keep it easy and progressive.', 'Focus on positions you will need in the session.']),
    ('standard_recovery_stretch_v1', 'Recovery Stretch', 'stretching', 'Easy post-row or evening stretch sequence.', 12, 'beginner', ARRAY['Hip flexor','Hamstring','Lats','Glutes'], ARRAY['Keep stretches mild.', 'Breathe slowly.', 'Do not force range after hard work.']),
    ('standard_travel_no_equipment_support_v1', 'Travel / No Equipment Support', 'core', 'No-equipment support circuit for trunk, hips, and basic pressing.', 20, 'beginner', ARRAY['No equipment','Core','Single leg'], ARRAY['Keep reps clean.', 'Use this as maintenance, not punishment.', 'Stop before technique turns sloppy.'])
)
INSERT INTO public.support_session_templates (
  template_key,
  title,
  kind,
  description,
  estimated_duration_minutes,
  difficulty,
  focus,
  instructions,
  status,
  user_id,
  visibility,
  metadata
)
SELECT
  template_key,
  title,
  kind,
  description,
  estimated_duration_minutes,
  difficulty,
  focus,
  instructions,
  'published',
  NULL::uuid,
  'standard',
  jsonb_build_object('seed_source', 'expanded_support_work_library_v1')
FROM template_seed
ON CONFLICT (template_key) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  description = EXCLUDED.description,
  estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
  difficulty = EXCLUDED.difficulty,
  focus = EXCLUDED.focus,
  instructions = EXCLUDED.instructions,
  status = EXCLUDED.status,
  visibility = EXCLUDED.visibility,
  metadata = public.support_session_templates.metadata || EXCLUDED.metadata,
  updated_at = now();

WITH templates_to_refresh(template_key) AS (
  VALUES
    ('standard_strength_pull_v1'),
    ('standard_strength_push_v1'),
    ('standard_lower_body_strength_v1'),
    ('standard_posterior_chain_v1'),
    ('standard_core_stability_15_v1'),
    ('standard_shoulder_prehab_v1'),
    ('standard_hip_mobility_v1'),
    ('standard_dynamic_warm_up_v1'),
    ('standard_recovery_stretch_v1'),
    ('standard_travel_no_equipment_support_v1'),
    ('pete_strength_pull_v1'),
    ('pete_strength_push_v1')
)
DELETE FROM public.support_session_template_exercises ste
USING public.support_session_templates st, templates_to_refresh tr
WHERE ste.support_session_template_id = st.id
  AND st.template_key = tr.template_key
  AND st.user_id IS NULL;

WITH exercise_row(template_key, exercise_key, sort_order, sets, reps, duration_seconds, rest_seconds, load_prescription, side, notes) AS (
  VALUES
    ('standard_strength_pull_v1', 'romanian_deadlift', 1, 4, '6-8', NULL::integer, 90, 'moderate, 1-2 reps in reserve', NULL::text, ARRAY['Keep hinge crisp; no max attempts.']),
    ('standard_strength_pull_v1', 'bench_pull', 2, 4, '8', NULL::integer, 75, 'moderate', NULL::text, ARRAY['Clean pull and controlled lower.']),
    ('standard_strength_pull_v1', 'lat_pulldown', 3, 3, '8-10', NULL::integer, 60, 'moderate', NULL::text, ARRAY['Use pull-up if strict reps are solid.']),
    ('standard_strength_pull_v1', 'face_pull', 4, 3, '15', NULL::integer, 45, 'light', NULL::text, ARRAY['Shoulder-health finisher.']),
    ('standard_strength_push_v1', 'dumbbell_bench_press', 1, 3, '8-10', NULL::integer, 75, 'moderate', NULL::text, ARRAY['Controlled pressing.']),
    ('standard_strength_push_v1', 'landmine_press', 2, 3, '8/side', NULL::integer, 60, 'light to moderate', 'per_side', ARRAY['Keep trunk quiet.']),
    ('standard_strength_push_v1', 'push_up', 3, 3, '10-20', NULL::integer, 45, 'bodyweight', NULL::text, ARRAY['Stop before reps get sloppy.']),
    ('standard_strength_push_v1', 'farmer_carry', 4, 3, NULL::text, 45, 45, 'moderate', NULL::text, ARRAY['Walk tall and steady.']),
    ('standard_lower_body_strength_v1', 'front_squat', 1, 4, '6-8', NULL::integer, 90, 'moderate, 1-2 reps in reserve', NULL::text, ARRAY['Use goblet squat if front rack is limiting.']),
    ('standard_lower_body_strength_v1', 'reverse_lunge', 2, 3, '8/side', NULL::integer, 60, 'moderate', 'per_side', ARRAY['Controlled single-leg strength.']),
    ('standard_lower_body_strength_v1', 'step_up', 3, 3, '8/side', NULL::integer, 60, 'moderate', 'per_side', ARRAY['Drive through the full foot.']),
    ('standard_lower_body_strength_v1', 'calf_raise', 4, 3, '12-15', NULL::integer, 45, 'easy to moderate', NULL::text, ARRAY['Controlled full range.']),
    ('standard_posterior_chain_v1', 'dumbbell_romanian_deadlift', 1, 3, '8-10', NULL::integer, 75, 'moderate', NULL::text, ARRAY['Beginner-friendly hinge option.']),
    ('standard_posterior_chain_v1', 'hip_thrust', 2, 3, '8-10', NULL::integer, 60, 'moderate', NULL::text, ARRAY['Finish with glutes.']),
    ('standard_posterior_chain_v1', 'hamstring_curl', 3, 3, '10-12', NULL::integer, 60, 'moderate', NULL::text, ARRAY['Control the eccentric.']),
    ('standard_posterior_chain_v1', 'single_leg_romanian_deadlift', 4, 3, '8/side', NULL::integer, 60, 'light to moderate', 'per_side', ARRAY['Move slowly and keep hips square.']),
    ('standard_core_stability_15_v1', 'dead_bug', 1, 3, '10/side', NULL::integer, 30, NULL::text, 'per_side', ARRAY['Low back stays quiet.']),
    ('standard_core_stability_15_v1', 'bird_dog', 2, 3, '8/side', NULL::integer, 30, NULL::text, 'per_side', ARRAY['Reach long without rotating.']),
    ('standard_core_stability_15_v1', 'side_plank', 3, 3, NULL::text, 30, 30, NULL::text, 'per_side', ARRAY['Scale duration to clean position.']),
    ('standard_core_stability_15_v1', 'pallof_press', 4, 3, '10/side', NULL::integer, 30, 'light to moderate', 'per_side', ARRAY['Resist rotation.']),
    ('standard_shoulder_prehab_v1', 'band_pull_apart', 1, 3, '15-20', NULL::integer, 30, 'light', NULL::text, ARRAY['Move from upper back.']),
    ('standard_shoulder_prehab_v1', 'band_shoulder_external_rotation', 2, 3, '12-15/side', NULL::integer, 30, 'light', 'per_side', ARRAY['Keep elbow pinned.']),
    ('standard_shoulder_prehab_v1', 'serratus_wall_slide', 3, 2, '10', NULL::integer, 30, 'light', NULL::text, ARRAY['Reach without arching.']),
    ('standard_shoulder_prehab_v1', 'prone_y_t_w_raise', 4, 2, '8 each', NULL::integer, 30, 'very light', NULL::text, ARRAY['No shrugging.']),
    ('standard_hip_mobility_v1', 'ninety_ninety_hip_switch', 1, 2, '8/side', NULL::integer, 20, NULL::text, 'per_side', ARRAY['Control the rotation.']),
    ('standard_hip_mobility_v1', 'hip_flexor_rock_back', 2, 2, '10/side', NULL::integer, 20, NULL::text, 'per_side', ARRAY['Stay out of pinching.']),
    ('standard_hip_mobility_v1', 'adductor_rockback', 3, 2, '10/side', NULL::integer, 20, NULL::text, 'per_side', ARRAY['Slow rocks.']),
    ('standard_hip_mobility_v1', 'quadruped_t_spine_rotation', 4, 2, '8/side', NULL::integer, 20, NULL::text, 'per_side', ARRAY['Rotate through upper back.']),
    ('standard_dynamic_warm_up_v1', 'cat_cow', 1, 1, '15', NULL::integer, 10, NULL::text, NULL::text, ARRAY['Easy spine motion.']),
    ('standard_dynamic_warm_up_v1', 'worlds_greatest_stretch', 2, 1, '5/side', NULL::integer, 15, NULL::text, 'per_side', ARRAY['Move gradually.']),
    ('standard_dynamic_warm_up_v1', 'ankle_dorsiflexion_rock_back', 3, 2, '10/side', NULL::integer, 15, NULL::text, 'per_side', ARRAY['Heel stays down.']),
    ('standard_dynamic_warm_up_v1', 'glute_bridge', 4, 2, '12', NULL::integer, 20, NULL::text, NULL::text, ARRAY['Pause briefly at top.']),
    ('standard_dynamic_warm_up_v1', 'banded_shoulder_pass_through', 5, 1, '15', NULL::integer, 15, 'light band', NULL::text, ARRAY['Pain-free shoulder range.']),
    ('standard_recovery_stretch_v1', 'childs_pose_lat_stretch', 1, 1, NULL::text, 45, 10, NULL::text, NULL::text, ARRAY['Slow breathing.']),
    ('standard_recovery_stretch_v1', 'couch_stretch', 2, 1, NULL::text, 45, 10, NULL::text, 'per_side', ARRAY['Mild stretch only.']),
    ('standard_recovery_stretch_v1', 'supine_hamstring_band_stretch', 3, 1, NULL::text, 45, 10, NULL::text, 'per_side', ARRAY['No bouncing.']),
    ('standard_recovery_stretch_v1', 'figure_4_glute_stretch', 4, 1, NULL::text, 45, 10, NULL::text, 'per_side', ARRAY['Relax into the hip.']),
    ('standard_recovery_stretch_v1', 'diaphragmatic_breathing', 5, 1, NULL::text, 180, 0, NULL::text, NULL::text, ARRAY['Finish easy.']),
    ('standard_travel_no_equipment_support_v1', 'dead_bug', 1, 3, '10/side', NULL::integer, 30, NULL::text, 'per_side', ARRAY['Controlled trunk position.']),
    ('standard_travel_no_equipment_support_v1', 'reverse_lunge', 2, 3, '8/side', NULL::integer, 45, 'bodyweight', 'per_side', ARRAY['Stay balanced.']),
    ('standard_travel_no_equipment_support_v1', 'push_up', 3, 3, '8-15', NULL::integer, 45, 'bodyweight', NULL::text, ARRAY['Scale to incline if needed.']),
    ('standard_travel_no_equipment_support_v1', 'side_plank', 4, 2, NULL::text, 30, 30, NULL::text, 'per_side', ARRAY['Clean brace.']),
    ('standard_travel_no_equipment_support_v1', 'thoracic_open_book', 5, 2, '8/side', NULL::integer, 20, NULL::text, 'per_side', ARRAY['Easy rotation.']),
    ('pete_strength_pull_v1', 'romanian_deadlift', 1, 4, '6-8', NULL::integer, 90, 'moderate, 1-2 reps in reserve', NULL::text, ARRAY['Quality hinge pattern; stop before failure.']),
    ('pete_strength_pull_v1', 'bench_pull', 2, 4, '8', NULL::integer, 75, 'moderate', NULL::text, ARRAY['Brace hard and keep the pull controlled.']),
    ('pete_strength_pull_v1', 'lat_pulldown', 3, 3, '8-10', NULL::integer, 60, 'moderate', NULL::text, ARRAY['Use pull-up if appropriate.']),
    ('pete_strength_pull_v1', 'face_pull', 4, 3, '15', NULL::integer, 45, 'light', NULL::text, ARRAY['Light, clean scapular control.']),
    ('pete_strength_push_v1', 'front_squat', 1, 4, '6-8', NULL::integer, 90, 'moderate, 1-2 reps in reserve', NULL::text, ARRAY['Smooth reps; no failed attempts.']),
    ('pete_strength_push_v1', 'dumbbell_bench_press', 2, 4, '8', NULL::integer, 75, 'moderate', NULL::text, ARRAY['Controlled eccentric on each rep.']),
    ('pete_strength_push_v1', 'walking_lunge', 3, 3, '10 steps/leg', NULL::integer, 60, 'bodyweight to moderate', 'alternating', ARRAY['Stay tall and balanced.']),
    ('pete_strength_push_v1', 'ab_wheel_rollout', 4, 3, '10-12', NULL::integer, 45, NULL::text, NULL::text, ARRAY['Brace through the trunk; shorten range if needed.'])
)
INSERT INTO public.support_session_template_exercises (
  support_session_template_id,
  exercise_id,
  sort_order,
  sets,
  reps,
  duration_seconds,
  rest_seconds,
  load_prescription,
  side,
  notes,
  metadata
)
SELECT
  st.id,
  e.id,
  er.sort_order,
  er.sets,
  er.reps,
  er.duration_seconds,
  er.rest_seconds,
  er.load_prescription,
  er.side,
  er.notes,
  jsonb_build_object('seed_source', 'expanded_support_work_library_v1')
FROM exercise_row er
JOIN public.support_session_templates st ON st.template_key = er.template_key
JOIN public.support_exercises e ON e.exercise_key = er.exercise_key AND e.user_id IS NULL
ON CONFLICT (support_session_template_id, exercise_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  sets = EXCLUDED.sets,
  reps = EXCLUDED.reps,
  duration_seconds = EXCLUDED.duration_seconds,
  rest_seconds = EXCLUDED.rest_seconds,
  load_prescription = EXCLUDED.load_prescription,
  side = EXCLUDED.side,
  notes = EXCLUDED.notes,
  metadata = public.support_session_template_exercises.metadata || EXCLUDED.metadata,
  updated_at = now();

UPDATE public.support_exercises
SET status = 'archived',
    metadata = metadata || jsonb_build_object('archived_by_seed', 'expanded_support_work_library_v1'),
    updated_at = now()
WHERE user_id IS NULL
  AND exercise_key IN (
    'legacy_deadlift_or_romanian_deadlift',
    'legacy_pendlay_row_or_bench_pull',
    'legacy_weighted_pull_up_or_lat_pulldown',
    'legacy_face_pulls',
    'legacy_front_squat_or_back_squat',
    'legacy_overhead_press_or_flat_bench_press',
    'legacy_walking_lunges',
    'legacy_ab_wheel_rollouts'
  );
)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.support_exercises
  VALIDATE CONSTRAINT support_exercises_exercise_key_format;

CREATE UNIQUE INDEX IF NOT EXISTS support_exercises_global_key_unique
  ON public.support_exercises (exercise_key)
  WHERE user_id IS NULL AND exercise_key IS NOT NULL;

WITH legacy_key_seed(name, exercise_key) AS (
  VALUES
    ('Deadlift or Romanian Deadlift', 'legacy_deadlift_or_romanian_deadlift'),
    ('Pendlay Row or Bench Pull', 'legacy_pendlay_row_or_bench_pull'),
    ('Weighted Pull-ups or Lat Pulldown', 'legacy_weighted_pull_up_or_lat_pulldown'),
    ('Face Pulls', 'legacy_face_pulls'),
    ('Front Squat or Back Squat', 'legacy_front_squat_or_back_squat'),
    ('Overhead Press or Flat Bench Press', 'legacy_overhead_press_or_flat_bench_press'),
    ('Walking Lunges', 'legacy_walking_lunges'),
    ('Ab Wheel Rollouts', 'legacy_ab_wheel_rollouts')
)
UPDATE public.support_exercises e
SET exercise_key = l.exercise_key,
    metadata = e.metadata || jsonb_build_object('superseded_by_seed', 'expanded_support_work_library_v1'),
    updated_at = now()
FROM legacy_key_seed l
WHERE e.user_id IS NULL
  AND e.name = l.name
  AND e.exercise_key IS NULL;

WITH exercise_seed(
  exercise_key,
  name,
  category,
  movement_pattern,
  equipment,
  default_sets,
  default_reps,
  default_duration_seconds,
  cues,
  tags
) AS (
  VALUES
    ('romanian_deadlift', 'Romanian Deadlift', 'strength', 'hinge', ARRAY['barbell'], 4, '6-8', NULL::integer, ARRAY['Hinge from the hips with a neutral spine.', 'Keep the bar close and stop before form breaks.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_intermediate']),
    ('conventional_deadlift', 'Conventional Deadlift', 'strength', 'hinge', ARRAY['barbell'], 3, '5-6', NULL::integer, ARRAY['Brace before the pull and keep the bar close.', 'Use submaximal loads for support work.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_advanced']),
    ('trap_bar_deadlift', 'Trap Bar Deadlift', 'strength', 'hinge', ARRAY['trap bar'], 3, '5-8', NULL::integer, ARRAY['Push the floor away and keep ribs stacked over pelvis.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_intermediate']),
    ('sumo_deadlift', 'Sumo Deadlift', 'strength', 'hinge', ARRAY['barbell'], 3, '5-6', NULL::integer, ARRAY['Keep knees tracking with toes and brace before each rep.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_advanced']),
    ('dumbbell_romanian_deadlift', 'Dumbbell Romanian Deadlift', 'strength', 'hinge', ARRAY['dumbbells'], 3, '8-10', NULL::integer, ARRAY['Reach hips back and keep the weights close to the legs.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_beginner']),
    ('single_leg_romanian_deadlift', 'Single-Leg Romanian Deadlift', 'strength', 'single-leg hinge', ARRAY['bodyweight','dumbbells'], 3, '8/side', NULL::integer, ARRAY['Move slowly and keep hips square.'], ARRAY['rowing','posterior_chain','hip_hinge','single_leg','strength','difficulty_intermediate']),
    ('good_morning', 'Good Morning', 'strength', 'hinge', ARRAY['barbell'], 3, '8', NULL::integer, ARRAY['Use light loads and keep the hinge controlled.'], ARRAY['rowing','posterior_chain','hip_hinge','strength','difficulty_advanced']),
    ('kettlebell_swing', 'Kettlebell Swing', 'strength', 'hinge power', ARRAY['kettlebell'], 3, '12-15', NULL::integer, ARRAY['Snap from the hips, not the low back.'], ARRAY['rowing','posterior_chain','hip_hinge','power','difficulty_intermediate']),
    ('hip_thrust', 'Hip Thrust', 'strength', 'hip extension', ARRAY['barbell','bench'], 3, '8-10', NULL::integer, ARRAY['Finish with glutes, not low-back extension.'], ARRAY['rowing','posterior_chain','strength','difficulty_intermediate']),
    ('glute_bridge', 'Glute Bridge', 'strength', 'hip extension', ARRAY['bodyweight','band'], 3, '12-15', NULL::integer, ARRAY['Pause briefly at the top with ribs down.'], ARRAY['rowing','posterior_chain','warmup','strength','difficulty_beginner']),
    ('hamstring_curl', 'Hamstring Curl', 'strength', 'knee flexion', ARRAY['machine','stability ball'], 3, '10-12', NULL::integer, ARRAY['Control the eccentric and avoid hip sag.'], ARRAY['rowing','posterior_chain','strength','difficulty_beginner']),
    ('nordic_hamstring_curl', 'Nordic Hamstring Curl', 'strength', 'knee flexion', ARRAY['bodyweight'], 2, '4-6', NULL::integer, ARRAY['Use assistance as needed and avoid forced range.'], ARRAY['rowing','posterior_chain','strength','difficulty_advanced']),
    ('calf_raise', 'Calf Raise', 'strength', 'ankle extension', ARRAY['bodyweight','dumbbells'], 3, '12-15', NULL::integer, ARRAY['Move through a controlled full range.'], ARRAY['rowing','strength','difficulty_beginner']),
    ('front_squat', 'Front Squat', 'strength', 'squat', ARRAY['barbell'], 4, '6-8', NULL::integer, ARRAY['Stay tall and keep elbows lifted.'], ARRAY['rowing','squat','strength','difficulty_intermediate']),
    ('back_squat', 'Back Squat', 'strength', 'squat', ARRAY['barbell'], 4, '6-8', NULL::integer, ARRAY['Brace and keep reps smooth; no grinders.'], ARRAY['rowing','squat','strength','difficulty_advanced']),
    ('goblet_squat', 'Goblet Squat', 'strength', 'squat', ARRAY['kettlebell','dumbbell'], 3, '8-12', NULL::integer, ARRAY['Sit between the hips and keep chest organized.'], ARRAY['rowing','squat','strength','difficulty_beginner']),
    ('leg_press', 'Leg Press', 'strength', 'squat press', ARRAY['machine'], 3, '10', NULL::integer, ARRAY['Use controlled depth and avoid locking out hard.'], ARRAY['rowing','squat','strength','difficulty_beginner']),
    ('bulgarian_split_squat', 'Bulgarian Split Squat', 'strength', 'single-leg squat', ARRAY['dumbbells','bodyweight'], 3, '8/side', NULL::integer, ARRAY['Keep pelvis level and front foot planted.'], ARRAY['rowing','single_leg','squat','strength','difficulty_intermediate']),
    ('walking_lunge', 'Walking Lunge', 'strength', 'lunge', ARRAY['dumbbells','bodyweight'], 3, '10 steps/leg', NULL::integer, ARRAY['Stay tall and step with control.'], ARRAY['rowing','single_leg','strength','difficulty_intermediate']),
    ('reverse_lunge', 'Reverse Lunge', 'strength', 'lunge', ARRAY['dumbbells','bodyweight'], 3, '8/side', NULL::integer, ARRAY['Step back softly and keep the front knee tracking.'], ARRAY['rowing','single_leg','strength','difficulty_beginner']),
    ('lateral_lunge', 'Lateral Lunge', 'strength', 'frontal-plane lunge', ARRAY['bodyweight','dumbbells'], 3, '8/side', NULL::integer, ARRAY['Sit into the hip and keep the trail leg long.'], ARRAY['rowing','single_leg','mobility','strength','difficulty_intermediate']),
    ('step_up', 'Step-Up', 'strength', 'single-leg', ARRAY['box','dumbbells'], 3, '8/side', NULL::integer, ARRAY['Drive through the full foot and control the descent.'], ARRAY['rowing','single_leg','strength','difficulty_beginner']),
    ('sled_push_drag', 'Sled Push / Sled Drag', 'strength', 'leg drive conditioning', ARRAY['sled'], 4, '20-30 m', NULL::integer, ARRAY['Keep efforts crisp and avoid turning it into an all-out test.'], ARRAY['rowing','conditioning','leg_drive','difficulty_intermediate']),
    ('squat_jump', 'Squat Jump', 'strength', 'plyometric squat', ARRAY['bodyweight'], 3, '5-8', NULL::integer, ARRAY['Land quietly and stop before jump quality drops.'], ARRAY['rowing','power','plyometric','difficulty_advanced']),
    ('burpee', 'Burpee', 'strength', 'full-body conditioning', ARRAY['bodyweight'], 3, '6-10', NULL::integer, ARRAY['Keep reps clean and avoid sloppy fatigue volume.'], ARRAY['conditioning','full_body','difficulty_advanced']),
    ('pendlay_row', 'Pendlay Row', 'strength', 'horizontal pull', ARRAY['barbell'], 4, '8', NULL::integer, ARRAY['Brace hard and reset each rep from the floor.'], ARRAY['rowing','horizontal_pull','posterior_chain','strength','difficulty_advanced']),
    ('bench_pull', 'Bench Pull', 'strength', 'horizontal pull', ARRAY['bench','barbell'], 4, '8', NULL::integer, ARRAY['Pull to the bench without jerking the torso.'], ARRAY['rowing','horizontal_pull','strength','difficulty_intermediate']),
    ('bent_over_barbell_row', 'Bent-Over Barbell Row', 'strength', 'horizontal pull', ARRAY['barbell'], 3, '8-10', NULL::integer, ARRAY['Hold the hinge and avoid heaving the bar.'], ARRAY['rowing','horizontal_pull','posterior_chain','strength','difficulty_intermediate']),
    ('chest_supported_dumbbell_row', 'Chest-Supported Dumbbell Row', 'strength', 'horizontal pull', ARRAY['bench','dumbbells'], 3, '10', NULL::integer, ARRAY['Keep chest supported and pull elbows back.'], ARRAY['rowing','horizontal_pull','strength','difficulty_beginner']),
    ('seated_cable_row', 'Seated Cable Row', 'strength', 'horizontal pull', ARRAY['cable'], 3, '8-12', NULL::integer, ARRAY['Stay tall and finish with shoulder blades.'], ARRAY['rowing','horizontal_pull','strength','difficulty_beginner']),
    ('single_arm_dumbbell_row', 'Single-Arm Dumbbell Row', 'strength', 'horizontal pull', ARRAY['dumbbell'], 3, '8-10/side', NULL::integer, ARRAY['Keep the torso quiet and pull through the elbow.'], ARRAY['rowing','horizontal_pull','strength','difficulty_beginner']),
    ('inverted_row', 'Inverted Row', 'strength', 'horizontal pull', ARRAY['bodyweight','bar'], 3, '8-12', NULL::integer, ARRAY['Keep a straight body line and pull chest to bar.'], ARRAY['rowing','horizontal_pull','bodyweight','strength','difficulty_beginner']),
    ('weighted_pull_up', 'Weighted Pull-Up', 'strength', 'vertical pull', ARRAY['bodyweight','weight'], 3, '6-8', NULL::integer, ARRAY['Use only when strict pull-ups are already solid.'], ARRAY['rowing','vertical_pull','strength','difficulty_advanced']),
    ('pull_up', 'Pull-Up', 'strength', 'vertical pull', ARRAY['bodyweight'], 3, '6-10', NULL::integer, ARRAY['Use full range without swinging.'], ARRAY['rowing','vertical_pull','strength','difficulty_intermediate']),
    ('lat_pulldown', 'Lat Pulldown', 'strength', 'vertical pull', ARRAY['cable'], 3, '8-10', NULL::integer, ARRAY['Pull elbows down and avoid leaning back excessively.'], ARRAY['rowing','vertical_pull','strength','difficulty_beginner']),
    ('push_up', 'Push-Up', 'strength', 'horizontal push', ARRAY['bodyweight'], 3, '10-20', NULL::integer, ARRAY['Keep ribs down and body line straight.'], ARRAY['rowing','push','strength','difficulty_beginner']),
    ('bench_press', 'Bench Press', 'strength', 'horizontal push', ARRAY['barbell','bench'], 4, '8', NULL::integer, ARRAY['Control the eccentric and keep shoulders organized.'], ARRAY['rowing','push','strength','difficulty_intermediate']),
    ('dumbbell_bench_press', 'Dumbbell Bench Press', 'strength', 'horizontal push', ARRAY['dumbbells','bench'], 3, '8-10', NULL::integer, ARRAY['Keep wrists stacked and press evenly.'], ARRAY['rowing','push','strength','difficulty_beginner']),
    ('overhead_press', 'Overhead Press', 'strength', 'vertical push', ARRAY['barbell','dumbbells'], 4, '8', NULL::integer, ARRAY['Brace glutes and ribs before pressing.'], ARRAY['rowing','push','strength','difficulty_intermediate']),
    ('landmine_press', 'Landmine Press', 'strength', 'diagonal push', ARRAY['barbell','landmine'], 3, '8/side', NULL::integer, ARRAY['Press up and forward without shrugging.'], ARRAY['rowing','push','shoulder_health','strength','difficulty_beginner']),
    ('half_kneeling_single_arm_press', 'Half-Kneeling Single-Arm Press', 'strength', 'vertical push', ARRAY['dumbbell','kettlebell'], 3, '8/side', NULL::integer, ARRAY['Stay tall and avoid leaning away from the press.'], ARRAY['rowing','push','core_stability','strength','difficulty_intermediate']),
    ('farmer_carry', 'Farmer Carry', 'strength', 'carry', ARRAY['dumbbells','kettlebells'], 3, NULL::text, 45, ARRAY['Walk tall with quiet ribs and level shoulders.'], ARRAY['rowing','carry','core_stability','strength','difficulty_beginner']),
    ('front_rack_carry', 'Front Rack Carry', 'strength', 'brace carry', ARRAY['kettlebells','dumbbells'], 3, NULL::text, 30, ARRAY['Keep elbows up and ribs stacked.'], ARRAY['rowing','carry','core_stability','strength','difficulty_intermediate']),
    ('suitcase_carry', 'Suitcase Carry', 'core', 'anti-lateral flexion', ARRAY['dumbbell','kettlebell'], 3, NULL::text, 30, ARRAY['Walk tall without leaning toward the load.'], ARRAY['rowing','carry','core_stability','anti_lateral_flexion','difficulty_beginner']),
    ('forearm_plank', 'Forearm Plank', 'core', 'brace', ARRAY['bodyweight'], 3, NULL::text, 60, ARRAY['Brace without holding your breath.'], ARRAY['rowing','core_stability','anti_extension','difficulty_beginner']),
    ('side_plank', 'Side Plank', 'core', 'lateral brace', ARRAY['bodyweight'], 3, NULL::text, 30, ARRAY['Keep hips stacked and body long.'], ARRAY['rowing','core_stability','anti_lateral_flexion','difficulty_beginner']),
    ('dead_bug', 'Dead Bug', 'core', 'anti-extension', ARRAY['bodyweight'], 3, '15/side', NULL::integer, ARRAY['Move slowly while keeping the low back quiet.'], ARRAY['rowing','core_stability','anti_extension','difficulty_beginner']),
    ('bird_dog', 'Bird Dog', 'core', 'anti-rotation', ARRAY['bodyweight'], 3, '10/side', NULL::integer, ARRAY['Reach long without rotating the hips.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_beginner']),
    ('pallof_press', 'Pallof Press', 'core', 'anti-rotation', ARRAY['cable','band'], 3, '12/side', NULL::integer, ARRAY['Resist rotation and keep shoulders relaxed.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_beginner']),
    ('tall_kneeling_pallof_press', 'Tall-Kneeling Pallof Press', 'core', 'anti-rotation', ARRAY['cable','band'], 3, '10/side', NULL::integer, ARRAY['Keep glutes engaged and press straight out.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_beginner']),
    ('ab_wheel_rollout', 'Ab Wheel Rollout', 'core', 'anti-extension', ARRAY['ab wheel'], 3, '10-12', NULL::integer, ARRAY['Shorten range if the low back extends.'], ARRAY['rowing','core_stability','anti_extension','difficulty_advanced']),
    ('hollow_hold', 'Hollow Hold', 'core', 'brace', ARRAY['bodyweight'], 3, NULL::text, 30, ARRAY['Keep low ribs down and scale lever length.'], ARRAY['rowing','core_stability','anti_extension','difficulty_intermediate']),
    ('copenhagen_plank', 'Copenhagen Plank', 'core', 'adductor brace', ARRAY['bench','bodyweight'], 2, NULL::text, 20, ARRAY['Start short-lever if needed and avoid hip sag.'], ARRAY['rowing','core_stability','prehab','difficulty_advanced']),
    ('bear_crawl', 'Bear Crawl', 'core', 'anti-rotation brace', ARRAY['bodyweight'], 3, '20-30 m', NULL::integer, ARRAY['Move slowly and keep hips level.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_intermediate']),
    ('stir_the_pot', 'Stir-the-Pot', 'core', 'anti-extension', ARRAY['stability ball'], 3, '8-12 circles', NULL::integer, ARRAY['Keep circles small enough to maintain trunk position.'], ARRAY['rowing','core_stability','anti_extension','difficulty_intermediate']),
    ('half_kneeling_chop', 'Half-Kneeling Chop', 'core', 'rotation control', ARRAY['cable','band'], 3, '10/side', NULL::integer, ARRAY['Rotate through the upper back with hips steady.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_intermediate']),
    ('half_kneeling_lift', 'Half-Kneeling Lift', 'core', 'rotation control', ARRAY['cable','band'], 3, '10/side', NULL::integer, ARRAY['Control the diagonal path without arching.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_intermediate']),
    ('reverse_crunch', 'Reverse Crunch', 'core', 'posterior pelvic tilt', ARRAY['bodyweight'], 3, '10-15', NULL::integer, ARRAY['Curl the pelvis instead of swinging the legs.'], ARRAY['rowing','core_stability','difficulty_beginner']),
    ('hanging_knee_raise', 'Hanging Knee Raise', 'core', 'trunk flexion control', ARRAY['pull-up bar'], 3, '8-12', NULL::integer, ARRAY['Control the lower and avoid swinging.'], ARRAY['rowing','core_stability','difficulty_intermediate']),
    ('plank_shoulder_tap', 'Plank Shoulder Tap', 'core', 'anti-rotation', ARRAY['bodyweight'], 3, '10/side', NULL::integer, ARRAY['Keep hips quiet as the hand lifts.'], ARRAY['rowing','core_stability','anti_rotation','difficulty_intermediate']),
    ('dead_bug_pullover', 'Dead Bug Pullover', 'core', 'anti-extension', ARRAY['dumbbell','kettlebell'], 3, '8-10', NULL::integer, ARRAY['Move arms without letting ribs flare.'], ARRAY['rowing','core_stability','anti_extension','difficulty_intermediate']),
    ('sculling_sit_up', 'Sculling Sit-Up', 'core', 'trunk endurance', ARRAY['bodyweight'], 3, '10-15', NULL::integer, ARRAY['Use controlled trunk movement; avoid yanking the neck.'], ARRAY['rowing','core_stability','trunk_endurance','difficulty_intermediate']),
    ('seated_pike_compression', 'Seated Pike Compression', 'core', 'hip flexor compression', ARRAY['bodyweight'], 3, '8-12', NULL::integer, ARRAY['Keep the spine long and lift with control.'], ARRAY['core_stability','hip_flexor','difficulty_advanced']),
    ('face_pull', 'Face Pull', 'prehab', 'shoulder/scapular', ARRAY['cable','band'], 3, '15', NULL::integer, ARRAY['Pull toward eye level with light, clean scapular control.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('band_pull_apart', 'Band Pull-Apart', 'prehab', 'shoulder/scapular', ARRAY['band'], 3, '15-20', NULL::integer, ARRAY['Keep ribs quiet and move from the upper back.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('band_shoulder_external_rotation', 'Band Shoulder External Rotation', 'prehab', 'shoulder rotation', ARRAY['band'], 3, '12-15/side', NULL::integer, ARRAY['Keep elbow pinned and rotate without shrugging.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('cable_shoulder_external_rotation', 'Cable Shoulder External Rotation', 'prehab', 'shoulder rotation', ARRAY['cable'], 3, '12-15/side', NULL::integer, ARRAY['Use light load and keep shoulder blade set.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('prone_y_t_w_raise', 'Prone Y-T-W Raise', 'prehab', 'scapular control', ARRAY['bodyweight','light dumbbells'], 2, '8 each', NULL::integer, ARRAY['Move slowly and avoid shrugging.'], ARRAY['rowing','shoulder_health','prehab','difficulty_intermediate']),
    ('scapular_push_up', 'Scapular Push-Up', 'prehab', 'serratus/scapula', ARRAY['bodyweight'], 2, '10-15', NULL::integer, ARRAY['Keep elbows straight and glide shoulder blades.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('scapular_pull_up', 'Scapular Pull-Up', 'prehab', 'scapular depression', ARRAY['pull-up bar'], 2, '6-10', NULL::integer, ARRAY['Move only the shoulder blades; do not bend elbows.'], ARRAY['rowing','shoulder_health','prehab','difficulty_intermediate']),
    ('serratus_wall_slide', 'Serratus Wall Slide', 'prehab', 'serratus/shoulder', ARRAY['wall','band'], 2, '10', NULL::integer, ARRAY['Reach long without arching the low back.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('banded_no_money_drill', 'Banded No-Money Drill', 'prehab', 'external rotation', ARRAY['band'], 2, '12-15', NULL::integer, ARRAY['Keep elbows by sides and rotate gently.'], ARRAY['rowing','shoulder_health','prehab','difficulty_beginner']),
    ('prone_trap_3_raise', 'Prone Trap-3 Raise', 'prehab', 'lower trap', ARRAY['bench','light dumbbell'], 2, '8-12', NULL::integer, ARRAY['Reach on a diagonal and keep the neck relaxed.'], ARRAY['rowing','shoulder_health','prehab','difficulty_intermediate']),
    ('cuban_rotation', 'Cuban Rotation', 'prehab', 'rotator cuff', ARRAY['light dumbbells','barbell'], 2, '10', NULL::integer, ARRAY['Use very light load and controlled range only.'], ARRAY['shoulder_health','prehab','difficulty_advanced']),
    ('terminal_knee_extension', 'Terminal Knee Extension', 'prehab', 'knee control', ARRAY['band'], 2, '15/side', NULL::integer, ARRAY['Lock in quad control without snapping the knee.'], ARRAY['prehab','knee_control','difficulty_beginner']),
    ('tibialis_raise', 'Tibialis Raise', 'prehab', 'ankle dorsiflexion strength', ARRAY['bodyweight'], 2, '15-20', NULL::integer, ARRAY['Lift toes smoothly and control the lower.'], ARRAY['prehab','ankle','difficulty_beginner']),
    ('eccentric_calf_lowering', 'Eccentric Calf Lowering', 'prehab', 'calf/Achilles', ARRAY['step','bodyweight'], 2, '8-12/side', NULL::integer, ARRAY['Lower slowly and use support for balance.'], ARRAY['prehab','calf','difficulty_intermediate']),
    ('banded_lateral_walk', 'Banded Lateral Walk', 'prehab', 'glute med/hip', ARRAY['band'], 2, '10-15 steps/side', NULL::integer, ARRAY['Keep toes forward and pelvis level.'], ARRAY['rowing','hip','prehab','difficulty_beginner']),
    ('worlds_greatest_stretch', 'World''s Greatest Stretch', 'mobility', 'hip/thoracic', ARRAY['bodyweight'], 1, '10/side', NULL::integer, ARRAY['Move gradually through hip and thoracic range.'], ARRAY['rowing','mobility','warmup','difficulty_beginner']),
    ('cat_cow', 'Cat-Cow', 'mobility', 'spine', ARRAY['bodyweight'], 1, '15', NULL::integer, ARRAY['Move segmentally without forcing end range.'], ARRAY['rowing','mobility','warmup','difficulty_beginner']),
    ('banded_shoulder_pass_through', 'Banded Shoulder Pass-Through', 'mobility', 'shoulder', ARRAY['band'], 1, '20', NULL::integer, ARRAY['Use a wide grip and pain-free range.'], ARRAY['rowing','mobility','shoulder_health','warmup','difficulty_beginner']),
    ('ankle_dorsiflexion_rock_back', 'Ankle Dorsiflexion Rock-Back', 'mobility', 'ankle', ARRAY['bodyweight'], 2, '10-15/side', NULL::integer, ARRAY['Keep heel down and knee tracking over toes.'], ARRAY['rowing','mobility','warmup','difficulty_beginner']),
    ('thoracic_foam_roll_extension', 'Thoracic Foam Roll Extension', 'mobility', 'thoracic spine', ARRAY['foam roller'], 1, NULL::text, 45, ARRAY['Extend through the upper back, not the neck.'], ARRAY['rowing','mobility','thoracic','difficulty_beginner']),
    ('ninety_ninety_hip_switch', '90/90 Hip Switch', 'mobility', 'hip rotation', ARRAY['bodyweight'], 2, '8/side', NULL::integer, ARRAY['Rotate under control without rushing.'], ARRAY['rowing','mobility','hip','difficulty_beginner']),
    ('hip_cars', 'Hip CARs', 'mobility', 'hip control', ARRAY['bodyweight'], 2, '5/side', NULL::integer, ARRAY['Move slowly through controlled range.'], ARRAY['rowing','mobility','hip','difficulty_intermediate']),
    ('shoulder_cars', 'Shoulder CARs', 'mobility', 'shoulder control', ARRAY['bodyweight'], 2, '5/side', NULL::integer, ARRAY['Use pain-free range and keep ribs quiet.'], ARRAY['rowing','mobility','shoulder_health','difficulty_intermediate']),
    ('thoracic_open_book', 'Thoracic Open Book', 'mobility', 'thoracic rotation', ARRAY['bodyweight'], 2, '8/side', NULL::integer, ARRAY['Rotate through the upper back while hips stay stacked.'], ARRAY['rowing','mobility','thoracic','difficulty_beginner']),
    ('quadruped_t_spine_rotation', 'Quadruped T-Spine Rotation', 'mobility', 'thoracic rotation', ARRAY['bodyweight'], 2, '8/side', NULL::integer, ARRAY['Follow the elbow with your eyes and avoid shifting hips.'], ARRAY['rowing','mobility','thoracic','difficulty_beginner']),
    ('deep_squat_pry', 'Deep Squat Pry', 'mobility', 'squat mobility', ARRAY['bodyweight'], 2, NULL::text, 30, ARRAY['Use a comfortable depth and breathe into position.'], ARRAY['rowing','mobility','squat','difficulty_beginner']),
    ('adductor_rockback', 'Adductor Rockback', 'mobility', 'hip/adductor', ARRAY['bodyweight'], 2, '10/side', NULL::integer, ARRAY['Rock back slowly and keep spine neutral.'], ARRAY['rowing','mobility','hip','difficulty_beginner']),
    ('hip_flexor_rock_back', 'Hip Flexor Rock-Back', 'mobility', 'hip flexor', ARRAY['bodyweight'], 2, '10/side', NULL::integer, ARRAY['Move gently and avoid pinching in the front of the hip.'], ARRAY['rowing','mobility','hip','warmup','difficulty_beginner']),
    ('scapular_wall_slide', 'Scapular Wall Slide', 'mobility', 'shoulder/scapular', ARRAY['wall'], 2, '10', NULL::integer, ARRAY['Keep ribs down and slide in pain-free range.'], ARRAY['rowing','mobility','shoulder_health','difficulty_beginner']),
    ('banded_lat_mobilization', 'Banded Lat Mobilization', 'mobility', 'shoulder/lats', ARRAY['band'], 2, NULL::text, 30, ARRAY['Ease into the stretch and keep breathing.'], ARRAY['rowing','mobility','shoulder_health','difficulty_beginner']),
    ('wrist_extension_rocker', 'Wrist Extension Rocker', 'mobility', 'wrist/forearm', ARRAY['bodyweight'], 2, '10-15', NULL::integer, ARRAY['Use gentle pressure and avoid sharp wrist pain.'], ARRAY['rowing','mobility','difficulty_beginner']),
    ('hip_flexor_stretch', 'Hip Flexor Stretch', 'stretching', 'hip flexor', ARRAY['bodyweight'], 1, NULL::text, 30, ARRAY['Tuck pelvis slightly and breathe.'], ARRAY['rowing','stretching','hip','difficulty_beginner']),
    ('hamstring_stretch', 'Hamstring Stretch', 'stretching', 'posterior chain', ARRAY['bodyweight'], 1, NULL::text, 30, ARRAY['Keep the stretch mild and avoid bouncing.'], ARRAY['rowing','stretching','posterior_chain','difficulty_beginner']),
    ('figure_4_glute_stretch', 'Figure-4 Glute Stretch', 'stretching', 'hip/glute', ARRAY['bodyweight'], 1, NULL::text, 30, ARRAY['Relax into the hip without forcing the knee.'], ARRAY['rowing','stretching','hip','difficulty_beginner']),
    ('couch_stretch', 'Couch Stretch', 'stretching', 'hip flexor/quad', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Keep ribs down and adjust distance from the wall as needed.'], ARRAY['rowing','stretching','hip','difficulty_intermediate']),
    ('childs_pose_lat_stretch', 'Child''s Pose Lat Stretch', 'stretching', 'lats/thoracic', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Reach long and breathe into the ribs.'], ARRAY['rowing','stretching','lats','difficulty_beginner']),
    ('pigeon_stretch', 'Pigeon Stretch', 'stretching', 'glute/hip', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Use a regression if the knee feels stressed.'], ARRAY['rowing','stretching','hip','difficulty_intermediate']),
    ('seated_straddle_stretch', 'Seated Straddle Stretch', 'stretching', 'hamstring/adductor', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Sit tall and hinge gently.'], ARRAY['rowing','stretching','hip','difficulty_beginner']),
    ('supine_hamstring_band_stretch', 'Supine Hamstring Band Stretch', 'stretching', 'hamstring', ARRAY['band'], 1, NULL::text, 45, ARRAY['Keep the opposite leg relaxed and stretch mild.'], ARRAY['rowing','stretching','posterior_chain','difficulty_beginner']),
    ('kneeling_adductor_stretch', 'Kneeling Adductor Stretch', 'stretching', 'adductor', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Shift back slowly and stay in comfortable range.'], ARRAY['rowing','stretching','hip','difficulty_beginner']),
    ('lat_prayer_stretch', 'Lat Prayer Stretch', 'stretching', 'lats/thoracic', ARRAY['bench','box'], 1, NULL::text, 45, ARRAY['Reach hips back and breathe into the lats.'], ARRAY['rowing','stretching','lats','difficulty_beginner']),
    ('pec_doorway_stretch', 'Pec Doorway Stretch', 'stretching', 'pec/shoulder', ARRAY['doorway'], 1, NULL::text, 45, ARRAY['Keep shoulder relaxed and avoid numbness or tingling.'], ARRAY['rowing','stretching','shoulder_health','difficulty_beginner']),
    ('calf_wall_stretch', 'Calf Wall Stretch', 'stretching', 'calf/Achilles', ARRAY['wall'], 1, NULL::text, 45, ARRAY['Keep back knee straight and heel down.'], ARRAY['stretching','calf','difficulty_beginner']),
    ('soleus_wall_stretch', 'Soleus Wall Stretch', 'stretching', 'soleus/ankle', ARRAY['wall'], 1, NULL::text, 45, ARRAY['Bend the back knee while keeping heel down.'], ARRAY['stretching','ankle','difficulty_beginner']),
    ('prone_quad_stretch', 'Prone Quad Stretch', 'stretching', 'quad/hip flexor', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Keep hips heavy and avoid arching.'], ARRAY['rowing','stretching','hip','difficulty_beginner']),
    ('supine_spinal_twist', 'Supine Spinal Twist', 'stretching', 'low back/glute', ARRAY['bodyweight'], 1, NULL::text, 45, ARRAY['Let the rotation be easy and breathe slowly.'], ARRAY['rowing','stretching','recovery','difficulty_beginner']),
    ('foam_rolling_quadriceps_lateral_thigh', 'Foam Rolling Quadriceps and Lateral Thigh', 'recovery', 'soft tissue', ARRAY['foam roller'], 1, NULL::text, 60, ARRAY['Use moderate pressure over muscle tissue and avoid sharp pain.'], ARRAY['rowing','recovery','soft_tissue','difficulty_beginner']),
    ('easy_walk', 'Easy Walk', 'recovery', 'general recovery', ARRAY['none'], 1, NULL::text, 1200, ARRAY['Keep it genuinely easy and conversational.'], ARRAY['recovery','circulation','difficulty_beginner']),
    ('diaphragmatic_breathing', 'Diaphragmatic Breathing', 'recovery', 'nervous system downshift', ARRAY['none'], 1, NULL::text, 240, ARRAY['Breathe slowly through the nose when comfortable.'], ARRAY['rowing','recovery','breathing','difficulty_beginner']),
    ('ninety_ninety_breathing', '90/90 Breathing', 'recovery', 'ribcage/pelvis reset', ARRAY['wall'], 1, NULL::text, 240, ARRAY['Keep feet on wall and ribs heavy.'], ARRAY['rowing','recovery','breathing','difficulty_beginner']),
    ('legs_up_the_wall', 'Legs-Up-the-Wall', 'recovery', 'relaxation', ARRAY['wall'], 1, NULL::text, 480, ARRAY['Settle into an easy position and breathe slowly.'], ARRAY['recovery','relaxation','difficulty_beginner']),
    ('foam_roll_lats', 'Foam Roll Lats', 'recovery', 'soft tissue', ARRAY['foam roller'], 1, NULL::text, 60, ARRAY['Use moderate pressure and avoid numbness or tingling.'], ARRAY['rowing','recovery','soft_tissue','lats','difficulty_beginner']),
    ('foam_roll_t_spine', 'Foam Roll T-Spine', 'recovery', 'soft tissue/mobility', ARRAY['foam roller'], 1, NULL::text, 75, ARRAY['Roll the upper back, not the low back.'], ARRAY['rowing','recovery','soft_tissue','thoracic','difficulty_beginner']),
    ('foam_roll_glutes', 'Foam Roll Glutes', 'recovery', 'soft tissue', ARRAY['foam roller'], 1, NULL::text, 60, ARRAY['Use moderate pressure and slow passes.'], ARRAY['rowing','recovery','soft_tissue','hip','difficulty_beginner']),
    ('lacrosse_ball_pec_release', 'Lacrosse Ball Pec Release', 'recovery', 'soft tissue', ARRAY['lacrosse ball','wall'], 1, NULL::text, 60, ARRAY['Use gentle pressure and avoid nerve symptoms.'], ARRAY['rowing','recovery','soft_tissue','shoulder_health','difficulty_beginner']),
    ('lacrosse_ball_foot_roll', 'Lacrosse Ball Foot Roll', 'recovery', 'soft tissue', ARRAY['lacrosse ball'], 1, NULL::text, 60, ARRAY['Roll gently across the foot arch.'], ARRAY['recovery','soft_tissue','difficulty_beginner']),
    ('light_recovery_spin', 'Light Recovery Spin', 'recovery', 'circulation', ARRAY['bike'], 1, NULL::text, 1200, ARRAY['Keep resistance light and effort easy.'], ARRAY['recovery','cross_training','circulation','difficulty_beginner'])
)
INSERT INTO public.support_exercises (
  exercise_key,
  name,
  category,
  movement_pattern,
  equipment,
  default_sets,
  default_reps,
  default_duration_seconds,
  cues,
  contraindications,
  tags,
  status,
  user_id,
  visibility,
  metadata
)
SELECT
  exercise_key,
  name,
  category,
  movement_pattern,
  equipment,
  default_sets,
  default_reps,
  default_duration_seconds,
  cues,
  ARRAY[]::text[],
  tags,
  'published',
  NULL::uuid,
  'standard',
  jsonb_build_object('seed_source', 'expanded_support_work_library_v1', 'difficulty', replace((SELECT tag FROM unnest(tags) AS tag WHERE tag LIKE 'difficulty_%' LIMIT 1), 'difficulty_', ''))
FROM exercise_seed
ON CONFLICT (exercise_key) WHERE user_id IS NULL AND exercise_key IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  equipment = EXCLUDED.equipment,
  default_sets = EXCLUDED.default_sets,
  default_reps = EXCLUDED.default_reps,
  default_duration_seconds = EXCLUDED.default_duration_seconds,
  cues = EXCLUDED.cues,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  visibility = EXCLUDED.visibility,
  metadata = public.support_exercises.metadata || EXCLUDED.metadata,
  updated_at = now();

WITH template_seed(template_key, title, kind, description, estimated_duration_minutes, difficulty, focus, instructions) AS (
  VALUES
    ('standard_strength_pull_v1', 'Strength Pull', 'strength', 'Rowing-support pull session emphasizing posterior chain, upper back, and lats.', 35, 'intermediate', ARRAY['Posterior chain','Horizontal pull','Vertical pull'], ARRAY['Keep 1-2 reps in reserve.', 'Stop if form degrades.', 'Use loads that support rowing, not max testing.']),
    ('standard_strength_push_v1', 'Strength Push', 'strength', 'Upper-body and trunk-support push session for balanced strength.', 30, 'intermediate', ARRAY['Horizontal push','Vertical push','Carry'], ARRAY['Keep pressing controlled.', 'Avoid grinding reps.', 'Pair with easy rowing or non-key days.']),
    ('standard_lower_body_strength_v1', 'Lower Body Strength', 'strength', 'Conservative lower-body strength template for squat and single-leg work.', 35, 'intermediate', ARRAY['Squat','Single leg','Leg drive'], ARRAY['Prioritize range and control.', 'Use moderate load.', 'Do not add plyometrics when already fatigued.']),
    ('standard_posterior_chain_v1', 'Posterior Chain', 'strength', 'Hinge and hip-extension support work for rowing robustness.', 30, 'intermediate', ARRAY['Hinge','Glutes','Hamstrings'], ARRAY['Keep hinge quality high.', 'Avoid maximal loading.', 'Leave the back feeling better, not cooked.']),
    ('standard_core_stability_15_v1', 'Core Stability 15', 'core', 'Short trunk stability session for anti-extension, anti-rotation, and lateral bracing.', 15, 'beginner', ARRAY['Anti-extension','Anti-rotation','Lateral brace'], ARRAY['Move slowly.', 'Keep breathing.', 'Scale duration before quality drops.']),
    ('standard_shoulder_prehab_v1', 'Shoulder Prehab', 'prehab', 'Light scapular and rotator-cuff maintenance for rowing shoulders.', 15, 'beginner', ARRAY['Scapular control','External rotation','Serratus'], ARRAY['Use light resistance.', 'Avoid shrugging.', 'Stay in pain-free range.']),
    ('standard_hip_mobility_v1', 'Hip Mobility', 'mobility', 'Hip and thoracic mobility session for better setup and recovery positions.', 15, 'beginner', ARRAY['Hip rotation','Hip flexor','Thoracic rotation'], ARRAY['Move smoothly.', 'Avoid forcing end range.', 'Use before rowing or on recovery days.']),
    ('standard_dynamic_warm_up_v1', 'Dynamic Warm-Up', 'mobility', 'Short general warm-up before rowing, lifting, or support work.', 10, 'beginner', ARRAY['Warmup','Hip','Thoracic','Shoulder'], ARRAY['Keep it easy and progressive.', 'Focus on positions you will need in the session.']),
    ('standard_recovery_stretch_v1', 'Recovery Stretch', 'stretching', 'Easy post-row or evening stretch sequence.', 12, 'beginner', ARRAY['Hip flexor','Hamstring','Lats','Glutes'], ARRAY['Keep stretches mild.', 'Breathe slowly.', 'Do not force range after hard work.']),
    ('standard_travel_no_equipment_support_v1', 'Travel / No Equipment Support', 'core', 'No-equipment support circuit for trunk, hips, and basic pressing.', 20, 'beginner', ARRAY['No equipment','Core','Single leg'], ARRAY['Keep reps clean.', 'Use this as maintenance, not punishment.', 'Stop before technique turns sloppy.'])
)
INSERT INTO public.support_session_templates (
  template_key,
  title,
  kind,
  description,
  estimated_duration_minutes,
  difficulty,
  focus,
  instructions,
  status,
  user_id,
  visibility,
  metadata
)
SELECT
  template_key,
  title,
  kind,
  description,
  estimated_duration_minutes,
  difficulty,
  focus,
  instructions,
  'published',
  NULL::uuid,
  'standard',
  jsonb_build_object('seed_source', 'expanded_support_work_library_v1')
FROM template_seed
ON CONFLICT (template_key) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  description = EXCLUDED.description,
  estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
  difficulty = EXCLUDED.difficulty,
  focus = EXCLUDED.focus,
  instructions = EXCLUDED.instructions,
  status = EXCLUDED.status,
  visibility = EXCLUDED.visibility,
  metadata = public.support_session_templates.metadata || EXCLUDED.metadata,
  updated_at = now();

WITH templates_to_refresh(template_key) AS (
  VALUES
    ('standard_strength_pull_v1'),
    ('standard_strength_push_v1'),
    ('standard_lower_body_strength_v1'),
    ('standard_posterior_chain_v1'),
    ('standard_core_stability_15_v1'),
    ('standard_shoulder_prehab_v1'),
    ('standard_hip_mobility_v1'),
    ('standard_dynamic_warm_up_v1'),
    ('standard_recovery_stretch_v1'),
    ('standard_travel_no_equipment_support_v1'),
    ('pete_strength_pull_v1'),
    ('pete_strength_push_v1')
)
DELETE FROM public.support_session_template_exercises ste
USING public.support_session_templates st, templates_to_refresh tr
WHERE ste.support_session_template_id = st.id
  AND st.template_key = tr.template_key
  AND st.user_id IS NULL;

WITH exercise_row(template_key, exercise_key, sort_order, sets, reps, duration_seconds, rest_seconds, load_prescription, side, notes) AS (
  VALUES
    ('standard_strength_pull_v1', 'romanian_deadlift', 1, 4, '6-8', NULL::integer, 90, 'moderate, 1-2 reps in reserve', NULL::text, ARRAY['Keep hinge crisp; no max attempts.']),
    ('standard_strength_pull_v1', 'bench_pull', 2, 4, '8', NULL::integer, 75, 'moderate', NULL::text, ARRAY['Clean pull and controlled lower.']),
    ('standard_strength_pull_v1', 'lat_pulldown', 3, 3, '8-10', NULL::integer, 60, 'moderate', NULL::text, ARRAY['Use pull-up if strict reps are solid.']),
    ('standard_strength_pull_v1', 'face_pull', 4, 3, '15', NULL::integer, 45, 'light', NULL::text, ARRAY['Shoulder-health finisher.']),
    ('standard_strength_push_v1', 'dumbbell_bench_press', 1, 3, '8-10', NULL::integer, 75, 'moderate', NULL::text, ARRAY['Controlled pressing.']),
    ('standard_strength_push_v1', 'landmine_press', 2, 3, '8/side', NULL::integer, 60, 'light to moderate', 'per_side', ARRAY['Keep trunk quiet.']),
    ('standard_strength_push_v1', 'push_up', 3, 3, '10-20', NULL::integer, 45, 'bodyweight', NULL::text, ARRAY['Stop before reps get sloppy.']),
    ('standard_strength_push_v1', 'farmer_carry', 4, 3, NULL::text, 45, 45, 'moderate', NULL::text, ARRAY['Walk tall and steady.']),
    ('standard_lower_body_strength_v1', 'front_squat', 1, 4, '6-8', NULL::integer, 90, 'moderate, 1-2 reps in reserve', NULL::text, ARRAY['Use goblet squat if front rack is limiting.']),
    ('standard_lower_body_strength_v1', 'reverse_lunge', 2, 3, '8/side', NULL::integer, 60, 'moderate', 'per_side', ARRAY['Controlled single-leg strength.']),
    ('standard_lower_body_strength_v1', 'step_up', 3, 3, '8/side', NULL::integer, 60, 'moderate', 'per_side', ARRAY['Drive through the full foot.']),
    ('standard_lower_body_strength_v1', 'calf_raise', 4, 3, '12-15', NULL::integer, 45, 'easy to moderate', NULL::text, ARRAY['Controlled full range.']),
    ('standard_posterior_chain_v1', 'dumbbell_romanian_deadlift', 1, 3, '8-10', NULL::integer, 75, 'moderate', NULL::text, ARRAY['Beginner-friendly hinge option.']),
    ('standard_posterior_chain_v1', 'hip_thrust', 2, 3, '8-10', NULL::integer, 60, 'moderate', NULL::text, ARRAY['Finish with glutes.']),
    ('standard_posterior_chain_v1', 'hamstring_curl', 3, 3, '10-12', NULL::integer, 60, 'moderate', NULL::text, ARRAY['Control the eccentric.']),
    ('standard_posterior_chain_v1', 'single_leg_romanian_deadlift', 4, 3, '8/side', NULL::integer, 60, 'light to moderate', 'per_side', ARRAY['Move slowly and keep hips square.']),
    ('standard_core_stability_15_v1', 'dead_bug', 1, 3, '10/side', NULL::integer, 30, NULL::text, 'per_side', ARRAY['Low back stays quiet.']),
    ('standard_core_stability_15_v1', 'bird_dog', 2, 3, '8/side', NULL::integer, 30, NULL::text, 'per_side', ARRAY['Reach long without rotating.']),
    ('standard_core_stability_15_v1', 'side_plank', 3, 3, NULL::text, 30, 30, NULL::text, 'per_side', ARRAY['Scale duration to clean position.']),
    ('standard_core_stability_15_v1', 'pallof_press', 4, 3, '10/side', NULL::integer, 30, 'light to moderate', 'per_side', ARRAY['Resist rotation.']),
    ('standard_shoulder_prehab_v1', 'band_pull_apart', 1, 3, '15-20', NULL::integer, 30, 'light', NULL::text, ARRAY['Move from upper back.']),
    ('standard_shoulder_prehab_v1', 'band_shoulder_external_rotation', 2, 3, '12-15/side', NULL::integer, 30, 'light', 'per_side', ARRAY['Keep elbow pinned.']),
    ('standard_shoulder_prehab_v1', 'serratus_wall_slide', 3, 2, '10', NULL::integer, 30, 'light', NULL::text, ARRAY['Reach without arching.']),
    ('standard_shoulder_prehab_v1', 'prone_y_t_w_raise', 4, 2, '8 each', NULL::integer, 30, 'very light', NULL::text, ARRAY['No shrugging.']),
    ('standard_hip_mobility_v1', 'ninety_ninety_hip_switch', 1, 2, '8/side', NULL::integer, 20, NULL::text, 'per_side', ARRAY['Control the rotation.']),
    ('standard_hip_mobility_v1', 'hip_flexor_rock_back', 2, 2, '10/side', NULL::integer, 20, NULL::text, 'per_side', ARRAY['Stay out of pinching.']),
    ('standard_hip_mobility_v1', 'adductor_rockback', 3, 2, '10/side', NULL::integer, 20, NULL::text, 'per_side', ARRAY['Slow rocks.']),
    ('standard_hip_mobility_v1', 'quadruped_t_spine_rotation', 4, 2, '8/side', NULL::integer, 20, NULL::text, 'per_side', ARRAY['Rotate through upper back.']),
    ('standard_dynamic_warm_up_v1', 'cat_cow', 1, 1, '15', NULL::integer, 10, NULL::text, NULL::text, ARRAY['Easy spine motion.']),
    ('standard_dynamic_warm_up_v1', 'worlds_greatest_stretch', 2, 1, '5/side', NULL::integer, 15, NULL::text, 'per_side', ARRAY['Move gradually.']),
    ('standard_dynamic_warm_up_v1', 'ankle_dorsiflexion_rock_back', 3, 2, '10/side', NULL::integer, 15, NULL::text, 'per_side', ARRAY['Heel stays down.']),
    ('standard_dynamic_warm_up_v1', 'glute_bridge', 4, 2, '12', NULL::integer, 20, NULL::text, NULL::text, ARRAY['Pause briefly at top.']),
    ('standard_dynamic_warm_up_v1', 'banded_shoulder_pass_through', 5, 1, '15', NULL::integer, 15, 'light band', NULL::text, ARRAY['Pain-free shoulder range.']),
    ('standard_recovery_stretch_v1', 'childs_pose_lat_stretch', 1, 1, NULL::text, 45, 10, NULL::text, NULL::text, ARRAY['Slow breathing.']),
    ('standard_recovery_stretch_v1', 'couch_stretch', 2, 1, NULL::text, 45, 10, NULL::text, 'per_side', ARRAY['Mild stretch only.']),
    ('standard_recovery_stretch_v1', 'supine_hamstring_band_stretch', 3, 1, NULL::text, 45, 10, NULL::text, 'per_side', ARRAY['No bouncing.']),
    ('standard_recovery_stretch_v1', 'figure_4_glute_stretch', 4, 1, NULL::text, 45, 10, NULL::text, 'per_side', ARRAY['Relax into the hip.']),
    ('standard_recovery_stretch_v1', 'diaphragmatic_breathing', 5, 1, NULL::text, 180, 0, NULL::text, NULL::text, ARRAY['Finish easy.']),
    ('standard_travel_no_equipment_support_v1', 'dead_bug', 1, 3, '10/side', NULL::integer, 30, NULL::text, 'per_side', ARRAY['Controlled trunk position.']),
    ('standard_travel_no_equipment_support_v1', 'reverse_lunge', 2, 3, '8/side', NULL::integer, 45, 'bodyweight', 'per_side', ARRAY['Stay balanced.']),
    ('standard_travel_no_equipment_support_v1', 'push_up', 3, 3, '8-15', NULL::integer, 45, 'bodyweight', NULL::text, ARRAY['Scale to incline if needed.']),
    ('standard_travel_no_equipment_support_v1', 'side_plank', 4, 2, NULL::text, 30, 30, NULL::text, 'per_side', ARRAY['Clean brace.']),
    ('standard_travel_no_equipment_support_v1', 'thoracic_open_book', 5, 2, '8/side', NULL::integer, 20, NULL::text, 'per_side', ARRAY['Easy rotation.']),
    ('pete_strength_pull_v1', 'romanian_deadlift', 1, 4, '6-8', NULL::integer, 90, 'moderate, 1-2 reps in reserve', NULL::text, ARRAY['Quality hinge pattern; stop before failure.']),
    ('pete_strength_pull_v1', 'bench_pull', 2, 4, '8', NULL::integer, 75, 'moderate', NULL::text, ARRAY['Brace hard and keep the pull controlled.']),
    ('pete_strength_pull_v1', 'lat_pulldown', 3, 3, '8-10', NULL::integer, 60, 'moderate', NULL::text, ARRAY['Use pull-up if appropriate.']),
    ('pete_strength_pull_v1', 'face_pull', 4, 3, '15', NULL::integer, 45, 'light', NULL::text, ARRAY['Light, clean scapular control.']),
    ('pete_strength_push_v1', 'front_squat', 1, 4, '6-8', NULL::integer, 90, 'moderate, 1-2 reps in reserve', NULL::text, ARRAY['Smooth reps; no failed attempts.']),
    ('pete_strength_push_v1', 'dumbbell_bench_press', 2, 4, '8', NULL::integer, 75, 'moderate', NULL::text, ARRAY['Controlled eccentric on each rep.']),
    ('pete_strength_push_v1', 'walking_lunge', 3, 3, '10 steps/leg', NULL::integer, 60, 'bodyweight to moderate', 'alternating', ARRAY['Stay tall and balanced.']),
    ('pete_strength_push_v1', 'ab_wheel_rollout', 4, 3, '10-12', NULL::integer, 45, NULL::text, NULL::text, ARRAY['Brace through the trunk; shorten range if needed.'])
)
INSERT INTO public.support_session_template_exercises (
  support_session_template_id,
  exercise_id,
  sort_order,
  sets,
  reps,
  duration_seconds,
  rest_seconds,
  load_prescription,
  side,
  notes,
  metadata
)
SELECT
  st.id,
  e.id,
  er.sort_order,
  er.sets,
  er.reps,
  er.duration_seconds,
  er.rest_seconds,
  er.load_prescription,
  er.side,
  er.notes,
  jsonb_build_object('seed_source', 'expanded_support_work_library_v1')
FROM exercise_row er
JOIN public.support_session_templates st ON st.template_key = er.template_key
JOIN public.support_exercises e ON e.exercise_key = er.exercise_key AND e.user_id IS NULL
ON CONFLICT (support_session_template_id, exercise_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  sets = EXCLUDED.sets,
  reps = EXCLUDED.reps,
  duration_seconds = EXCLUDED.duration_seconds,
  rest_seconds = EXCLUDED.rest_seconds,
  load_prescription = EXCLUDED.load_prescription,
  side = EXCLUDED.side,
  notes = EXCLUDED.notes,
  metadata = public.support_session_template_exercises.metadata || EXCLUDED.metadata,
  updated_at = now();

UPDATE public.support_exercises
SET status = 'archived',
    metadata = metadata || jsonb_build_object('archived_by_seed', 'expanded_support_work_library_v1'),
    updated_at = now()
WHERE user_id IS NULL
  AND exercise_key IN (
    'legacy_deadlift_or_romanian_deadlift',
    'legacy_pendlay_row_or_bench_pull',
    'legacy_weighted_pull_up_or_lat_pulldown',
    'legacy_face_pulls',
    'legacy_front_squat_or_back_squat',
    'legacy_overhead_press_or_flat_bench_press',
    'legacy_walking_lunges',
    'legacy_ab_wheel_rollouts'
  );
