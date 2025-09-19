-- Check and create missing admin policies for viewing all data

-- Contacts: Allow admins to view all contacts (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can view all contacts"
    ON public.crm_contacts
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Services: Allow admins to view all services (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can view all services"
    ON public.crm_services
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Opportunities: Allow admins to view all opportunities (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can view all opportunities"
    ON public.opportunities
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Orders: Allow admins to view all orders (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can view all orders"
    ON public.crm_orders
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Order Services: Allow admins to view all order services (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can view all order services"
    ON public.crm_order_services
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Business Data: Allow admins to view all business data (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can view all business data"
    ON public.monthly_business_data
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Business Targets: Allow admins to view all business targets (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can view all business targets"
    ON public.business_targets
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Partner Services: Allow admins to view all partner services (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can view all partner services"
    ON public.partner_services
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Service Compositions: Allow admins to view all service compositions (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can view all service compositions"
    ON public.crm_service_compositions
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Allow admins to manage all companies data (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can manage all companies"
    ON public.companies
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Allow admins to manage all contacts (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can manage all contacts"
    ON public.crm_contacts
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Allow admins to manage all services (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can manage all services"
    ON public.crm_services
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Allow admins to manage all opportunities (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can manage all opportunities"
    ON public.opportunities
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;

-- Allow admins to manage all orders (if not exists)
DO $$ BEGIN
    CREATE POLICY "Admins can manage all orders"
    ON public.crm_orders
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, skip
    NULL;
END $$;