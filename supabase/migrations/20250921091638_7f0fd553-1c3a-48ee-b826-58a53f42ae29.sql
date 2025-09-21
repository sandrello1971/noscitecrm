-- Add user_id column to suppliers table for user-specific access control
ALTER TABLE public.suppliers 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Set user_id for existing suppliers (if any) to prevent data loss
-- This assigns them to the first admin user, or you can adjust as needed
UPDATE public.suppliers 
SET user_id = (
  SELECT ur.user_id 
  FROM public.user_roles ur 
  WHERE ur.role = 'admin' 
  LIMIT 1
) 
WHERE user_id IS NULL;

-- Make user_id NOT NULL after setting values
ALTER TABLE public.suppliers 
ALTER COLUMN user_id SET NOT NULL;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;

-- Create secure user-specific RLS policies
CREATE POLICY "Users can view their own suppliers" 
ON public.suppliers 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create their own suppliers" 
ON public.suppliers 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suppliers" 
ON public.suppliers 
FOR UPDATE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own suppliers" 
ON public.suppliers 
FOR DELETE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));