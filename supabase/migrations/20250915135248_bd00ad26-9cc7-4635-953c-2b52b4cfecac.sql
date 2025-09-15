-- Add email column to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN email text;

-- Update the handle_new_user function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Update existing user profile with current user's email if missing
UPDATE public.user_profiles 
SET email = (
  SELECT email 
  FROM auth.users 
  WHERE auth.users.id = user_profiles.id
)
WHERE email IS NULL;