-- Fix RLS policies for crm_companies to allow admin access
DROP POLICY "Users can manage their companies" ON public.crm_companies;

CREATE POLICY "Users can manage their companies" 
ON public.crm_companies 
FOR ALL 
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));