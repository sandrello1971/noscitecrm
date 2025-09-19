-- Fix search path for remaining security functions
CREATE OR REPLACE FUNCTION public.is_valid_email(email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' 
    AND char_length(email) <= 254
    AND NOT (email ~* '(disposable|temp|fake|spam|test)');
END;
$$;

CREATE OR REPLACE FUNCTION public.log_admin_access(p_action text, p_table_name text, p_record_id text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id, 
      action, 
      table_name, 
      record_id,
      ip_address
    ) VALUES (
      auth.uid(),
      p_action,
      p_table_name,
      p_record_id,
      inet_client_addr()
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_admin_role_to_user(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find user ID from email (this query only works if user exists)
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = user_email;
  
  IF target_user_id IS NOT NULL THEN
    -- Insert or update admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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