ALTER TABLE public.workout_logs 
ADD COLUMN IF NOT EXISTS is_benchmark boolean DEFAULT false;
