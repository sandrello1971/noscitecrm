-- Fix security vulnerability in chat_conversations table
-- Remove the overly permissive policies and replace with secure ones

-- Drop existing policies
DROP POLICY IF EXISTS "Anonymous users can access their chatbot conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anonymous users can update their chatbot conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can manage their own conversations" ON public.chat_conversations;

-- Create a security definer function to validate session ownership
CREATE OR REPLACE FUNCTION public.validate_session_access(conversation_session_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_session_id text;
BEGIN
  -- Get the session ID from the current request context
  -- This should be set by the application when making requests
  request_session_id := current_setting('request.session_id', true);
  
  -- If no session context is set, deny access
  IF request_session_id IS NULL OR request_session_id = '' THEN
    RETURN false;
  END IF;
  
  -- Only allow access if the session IDs match exactly
  RETURN request_session_id = conversation_session_id;
END;
$$;

-- Create secure RLS policies
-- Policy for authenticated users to access their own conversations
CREATE POLICY "Authenticated users can access their own conversations" 
ON public.chat_conversations 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Policy for authenticated users to modify their own conversations
CREATE POLICY "Authenticated users can modify their own conversations" 
ON public.chat_conversations 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for anonymous users with strict session validation
CREATE POLICY "Anonymous users can access their session conversations" 
ON public.chat_conversations 
FOR SELECT 
TO anon
USING (
  user_id IS NULL 
  AND session_id IS NOT NULL 
  AND length(session_id) >= 16 -- Increased minimum length for better security
  AND length(session_id) <= 100
  AND validate_session_access(session_id)
);

-- Policy for anonymous users to update their session conversations
CREATE POLICY "Anonymous users can update their session conversations" 
ON public.chat_conversations 
FOR UPDATE 
TO anon
USING (
  user_id IS NULL 
  AND session_id IS NOT NULL 
  AND length(session_id) >= 16
  AND length(session_id) <= 100
  AND validate_session_access(session_id)
)
WITH CHECK (
  user_id IS NULL 
  AND session_id IS NOT NULL 
  AND length(session_id) >= 16
  AND length(session_id) <= 100
  AND validate_session_access(session_id)
);

-- Policy for anonymous users to create new conversations
CREATE POLICY "Anonymous users can create session conversations" 
ON public.chat_conversations 
FOR INSERT 
TO anon
WITH CHECK (
  user_id IS NULL 
  AND session_id IS NOT NULL 
  AND length(session_id) >= 16
  AND length(session_id) <= 100
  AND validate_session_access(session_id)
);

-- Add index for better performance on session_id queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session_id 
ON public.chat_conversations(session_id) 
WHERE user_id IS NULL;

-- Add a function to clean up old anonymous conversations
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete anonymous conversations older than 30 days
  DELETE FROM public.chat_conversations 
  WHERE user_id IS NULL 
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$;