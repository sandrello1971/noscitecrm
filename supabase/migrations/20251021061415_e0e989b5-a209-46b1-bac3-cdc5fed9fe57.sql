-- Create table to store OneDrive tokens
CREATE TABLE IF NOT EXISTS public.onedrive_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.onedrive_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view and update their own tokens
CREATE POLICY "Users can manage their own OneDrive tokens"
ON public.onedrive_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_onedrive_tokens_updated_at
BEFORE UPDATE ON public.onedrive_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();