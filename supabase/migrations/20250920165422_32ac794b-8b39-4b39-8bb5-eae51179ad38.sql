-- Fix suppliers table RLS policies to prevent public access to contact data

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can view suppliers" ON public.suppliers;

-- Ensure RLS is enabled
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create secure policies that require authentication
CREATE POLICY "Authenticated users can view suppliers" 
ON public.suppliers 
FOR SELECT 
TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage suppliers" 
ON public.suppliers 
FOR ALL 
TO authenticated 
USING (auth.uid() IS NOT NULL) 
WITH CHECK (auth.uid() IS NOT NULL);

-- Revoke any public access
REVOKE ALL ON public.suppliers FROM anon;
REVOKE ALL ON public.suppliers FROM public;