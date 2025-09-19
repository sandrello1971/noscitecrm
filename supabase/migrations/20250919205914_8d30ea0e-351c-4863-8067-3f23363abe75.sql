-- Remove duplicate admin policies since they're now included in the main user policies

DROP POLICY IF EXISTS "Admins can view all companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can manage all companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can view all contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Admins can manage all contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Admins can view all services" ON public.crm_services;
DROP POLICY IF EXISTS "Admins can manage all services" ON public.crm_services;
DROP POLICY IF EXISTS "Admins can view all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Admins can manage all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.crm_orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.crm_orders;
DROP POLICY IF EXISTS "Admins can view all order services" ON public.crm_order_services;
DROP POLICY IF EXISTS "Admins can manage all order services" ON public.crm_order_services;
DROP POLICY IF EXISTS "Admins can view all business data" ON public.monthly_business_data;
DROP POLICY IF EXISTS "Admins can manage all business data" ON public.monthly_business_data;
DROP POLICY IF EXISTS "Admins can view all business targets" ON public.business_targets;
DROP POLICY IF EXISTS "Admins can manage all business targets" ON public.business_targets;