-- Add missing UPDATE and DELETE policies for contact_messages table
-- This ensures proper admin-only access for data management

-- Add UPDATE policy for admin-only access
CREATE POLICY "Super secure admin update contact messages" 
ON public.contact_messages 
FOR UPDATE 
USING (
  (auth.uid() IS NOT NULL) AND 
  (auth.email() IS NOT NULL) AND 
  has_role(auth.uid(), 'admin'::app_role) AND 
  (EXISTS ( 
    SELECT 1
    FROM user_roles
    WHERE (user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role)
  ))
);

-- Add DELETE policy for admin-only access  
CREATE POLICY "Super secure admin delete contact messages" 
ON public.contact_messages 
FOR DELETE 
USING (
  (auth.uid() IS NOT NULL) AND 
  (auth.email() IS NOT NULL) AND 
  has_role(auth.uid(), 'admin'::app_role) AND 
  (EXISTS ( 
    SELECT 1
    FROM user_roles
    WHERE (user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role)
  ))
);

-- Add additional audit logging for sensitive operations
CREATE OR REPLACE FUNCTION public.log_contact_message_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access to contact messages for security auditing
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values,
      ip_address
    ) VALUES (
      auth.uid(),
      TG_OP || '_CONTACT_MESSAGE',
      'contact_messages',
      COALESCE(NEW.id::text, OLD.id::text),
      CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
      CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
      inet_client_addr()
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create trigger for audit logging on contact messages
DROP TRIGGER IF EXISTS log_contact_message_changes ON public.contact_messages;
CREATE TRIGGER log_contact_message_changes
  AFTER UPDATE OR DELETE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_contact_message_access();