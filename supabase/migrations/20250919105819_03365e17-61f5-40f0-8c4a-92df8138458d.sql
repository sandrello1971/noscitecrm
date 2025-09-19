-- Remove the overly broad "Users can manage their own profile" policy
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.user_profiles;

-- Create more specific and secure policies for user_profiles table

-- Policy 1: Users can only SELECT their own profile data
CREATE POLICY "Users can view only their own profile" 
ON public.user_profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Policy 2: Users can only INSERT their own profile (during registration)
CREATE POLICY "Users can create only their own profile" 
ON public.user_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Policy 3: Users can only UPDATE their own profile data
CREATE POLICY "Users can update only their own profile" 
ON public.user_profiles 
FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Policy 4: Users can only DELETE their own profile
CREATE POLICY "Users can delete only their own profile" 
ON public.user_profiles 
FOR DELETE 
USING (auth.uid() = id);

-- Keep the admin policy as is (it's properly scoped to SELECT only)
-- "Admins can view all profiles" policy already exists and is secure