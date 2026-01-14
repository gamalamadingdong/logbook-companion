-- Create table to store user integration settings (like Google Sheets ID)
CREATE TABLE IF NOT EXISTS public.user_integrations (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    google_sheet_id TEXT,
    last_export_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see only their own integration settings
CREATE POLICY "Users can view own integrations" 
ON public.user_integrations FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Policy: Users can insert/update their own integration settings
CREATE POLICY "Users can upsert own integrations" 
ON public.user_integrations FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations" 
ON public.user_integrations FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);
