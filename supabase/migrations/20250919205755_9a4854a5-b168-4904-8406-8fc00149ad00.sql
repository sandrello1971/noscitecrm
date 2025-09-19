-- Update existing user policies to also allow admin access

-- Companies policies - update to allow both user access and admin access
DROP POLICY IF EXISTS "Users can view their companies" ON public.companies;
CREATE POLICY "Users can view their companies" 
ON public.companies 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update their companies" ON public.companies;
CREATE POLICY "Users can update their companies" 
ON public.companies 
FOR UPDATE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete their companies" ON public.companies;
CREATE POLICY "Users can delete their companies" 
ON public.companies 
FOR DELETE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Opportunities policies - update to allow both user access and admin access
DROP POLICY IF EXISTS "Users can view their opportunities" ON public.opportunities;
CREATE POLICY "Users can view their opportunities" 
ON public.opportunities 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update their opportunities" ON public.opportunities;
CREATE POLICY "Users can update their opportunities" 
ON public.opportunities 
FOR UPDATE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete their opportunities" ON public.opportunities;
CREATE POLICY "Users can delete their opportunities" 
ON public.opportunities 
FOR DELETE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Update user policies for other tables to include admin access
-- Contacts
DROP POLICY IF EXISTS "Users can manage their contacts" ON public.crm_contacts;
CREATE POLICY "Users can manage their contacts" 
ON public.crm_contacts 
FOR ALL 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Services
DROP POLICY IF EXISTS "Users can manage their services" ON public.crm_services;
CREATE POLICY "Users can manage their services" 
ON public.crm_services 
FOR ALL 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Orders
DROP POLICY IF EXISTS "Users can manage their orders" ON public.crm_orders;
CREATE POLICY "Users can manage their orders" 
ON public.crm_orders 
FOR ALL 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Order Services
DROP POLICY IF EXISTS "Users can manage their order services" ON public.crm_order_services;
CREATE POLICY "Users can manage their order services" 
ON public.crm_order_services 
FOR ALL 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Business data policies
DROP POLICY IF EXISTS "Users can view their company data" ON public.monthly_business_data;
CREATE POLICY "Users can view their company data" 
ON public.monthly_business_data 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM companies 
  WHERE companies.id = monthly_business_data.company_id 
  AND (companies.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

DROP POLICY IF EXISTS "Users can create data for their companies" ON public.monthly_business_data;
CREATE POLICY "Users can create data for their companies" 
ON public.monthly_business_data 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM companies 
  WHERE companies.id = monthly_business_data.company_id 
  AND (companies.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

DROP POLICY IF EXISTS "Users can update data for their companies" ON public.monthly_business_data;
CREATE POLICY "Users can update data for their companies" 
ON public.monthly_business_data 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM companies 
  WHERE companies.id = monthly_business_data.company_id 
  AND (companies.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

DROP POLICY IF EXISTS "Users can delete data for their companies" ON public.monthly_business_data;
CREATE POLICY "Users can delete data for their companies" 
ON public.monthly_business_data 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM companies 
  WHERE companies.id = monthly_business_data.company_id 
  AND (companies.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

-- Business targets policies
DROP POLICY IF EXISTS "Users can view their company targets" ON public.business_targets;
CREATE POLICY "Users can view their company targets" 
ON public.business_targets 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM companies 
  WHERE companies.id = business_targets.company_id 
  AND (companies.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

DROP POLICY IF EXISTS "Users can create targets for their companies" ON public.business_targets;
CREATE POLICY "Users can create targets for their companies" 
ON public.business_targets 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM companies 
  WHERE companies.id = business_targets.company_id 
  AND (companies.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

DROP POLICY IF EXISTS "Users can update targets for their companies" ON public.business_targets;
CREATE POLICY "Users can update targets for their companies" 
ON public.business_targets 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM companies 
  WHERE companies.id = business_targets.company_id 
  AND (companies.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

DROP POLICY IF EXISTS "Users can delete targets for their companies" ON public.business_targets;
CREATE POLICY "Users can delete targets for their companies" 
ON public.business_targets 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM companies 
  WHERE companies.id = business_targets.company_id 
  AND (companies.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));