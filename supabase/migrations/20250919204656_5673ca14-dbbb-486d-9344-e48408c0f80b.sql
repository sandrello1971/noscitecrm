-- Fix search path security issues in existing functions
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = auth.uid() 
  ORDER BY CASE WHEN role = 'admin' THEN 1 ELSE 2 END 
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create audit logging for security events
CREATE TABLE IF NOT EXISTS public.role_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid NOT NULL,
  target_user_id uuid NOT NULL,
  old_role app_role,
  new_role app_role NOT NULL,
  change_reason text,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view role change audits
CREATE POLICY "Admins can view role change audits"
ON public.role_change_audit
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs
CREATE POLICY "System can insert role change audits"
ON public.role_change_audit
FOR INSERT
WITH CHECK (true);

-- Function to validate role changes and prevent self-modification
CREATE OR REPLACE FUNCTION public.validate_role_change(
  p_target_user_id uuid,
  p_new_role app_role,
  p_change_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_user_role app_role;
  target_current_role app_role;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Prevent self-modification
  IF current_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Users cannot modify their own roles for security reasons';
  END IF;
  
  -- Get current user role
  SELECT role INTO current_user_role
  FROM public.user_roles
  WHERE user_id = current_user_id
  ORDER BY CASE WHEN role = 'admin' THEN 1 ELSE 2 END
  LIMIT 1;
  
  -- Only admins can change roles
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can modify user roles';
  END IF;
  
  -- Get target user's current role for audit
  SELECT role INTO target_current_role
  FROM public.user_roles
  WHERE user_id = p_target_user_id
  ORDER BY CASE WHEN role = 'admin' THEN 1 ELSE 2 END
  LIMIT 1;
  
  -- Log the role change attempt
  INSERT INTO public.role_change_audit (
    changed_by,
    target_user_id,
    old_role,
    new_role,
    change_reason,
    ip_address
  ) VALUES (
    current_user_id,
    p_target_user_id,
    target_current_role,
    p_new_role,
    p_change_reason,
    inet_client_addr()
  );
  
  RETURN true;
END;
$$;

-- Create secure role update function
CREATE OR REPLACE FUNCTION public.update_user_role_secure(
  p_target_user_id uuid,
  p_new_role app_role,
  p_change_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate the role change
  IF NOT public.validate_role_change(p_target_user_id, p_new_role, p_change_reason) THEN
    RAISE EXCEPTION 'Role change validation failed';
  END IF;
  
  -- Delete existing roles for the user
  DELETE FROM public.user_roles WHERE user_id = p_target_user_id;
  
  -- Insert new role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_target_user_id, p_new_role);
END;
$$;