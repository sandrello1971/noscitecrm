-- Create user_profiles table for additional user data
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name text,
    last_name text,
    phone text,
    preferences jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_profiles if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'user_profiles' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can manage their own profile"
ON public.user_profiles
FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updating updated_at on user_profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_user_profiles_updated_at'
    ) THEN
        CREATE TRIGGER update_user_profiles_updated_at
            BEFORE UPDATE ON public.user_profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;