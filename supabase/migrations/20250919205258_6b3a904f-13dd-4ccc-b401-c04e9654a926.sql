-- Update RLS policies to allow admins to see all data

-- Companies: Allow admins to view all companies
CREATE POLICY "Admins can view all companies"
ON public.companies
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Contacts: Allow admins to view all contacts
CREATE POLICY "Admins can view all contacts"
ON public.crm_contacts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Services: Allow admins to view all services
CREATE POLICY "Admins can view all services"
ON public.crm_services
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Opportunities: Allow admins to view all opportunities
CREATE POLICY "Admins can view all opportunities"
ON public.opportunities
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Orders: Allow admins to view all orders
CREATE POLICY "Admins can view all orders"
ON public.crm_orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Order Services: Allow admins to view all order services
CREATE POLICY "Admins can view all order services"
ON public.crm_order_services
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Business Data: Allow admins to view all business data
CREATE POLICY "Admins can view all business data"
ON public.monthly_business_data
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Business Targets: Allow admins to view all business targets
CREATE POLICY "Admins can view all business targets"
ON public.business_targets
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Partner Services: Allow admins to view all partner services
CREATE POLICY "Admins can view all partner services"
ON public.partner_services
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service Compositions: Allow admins to view all service compositions
CREATE POLICY "Admins can view all service compositions"
ON public.crm_service_compositions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Documents: Allow admins to view all documents
CREATE POLICY "Admins can view all documents"
ON public.documents
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage all companies data
CREATE POLICY "Admins can manage all companies"
ON public.companies
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage all contacts
CREATE POLICY "Admins can manage all contacts"
ON public.crm_contacts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage all services
CREATE POLICY "Admins can manage all services"
ON public.crm_services
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage all opportunities
CREATE POLICY "Admins can manage all opportunities"
ON public.opportunities
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage all orders
CREATE POLICY "Admins can manage all orders"
ON public.crm_orders
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage all documents
CREATE POLICY "Admins can manage all documents"
ON public.documents
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));