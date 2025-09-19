-- Add missing admin policies using IF NOT EXISTS pattern

DO $$
BEGIN
    -- Check and create admin policies for various tables
    
    -- Services policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_services' AND policyname = 'Admins can view all services') THEN
        CREATE POLICY "Admins can view all services"
        ON public.crm_services
        FOR SELECT
        USING (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_services' AND policyname = 'Admins can manage all services') THEN
        CREATE POLICY "Admins can manage all services"
        ON public.crm_services
        FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    -- Opportunities policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'opportunities' AND policyname = 'Admins can view all opportunities') THEN
        CREATE POLICY "Admins can view all opportunities"
        ON public.opportunities
        FOR SELECT
        USING (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'opportunities' AND policyname = 'Admins can manage all opportunities') THEN
        CREATE POLICY "Admins can manage all opportunities"
        ON public.opportunities
        FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    -- Orders policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_orders' AND policyname = 'Admins can view all orders') THEN
        CREATE POLICY "Admins can view all orders"
        ON public.crm_orders
        FOR SELECT
        USING (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_orders' AND policyname = 'Admins can manage all orders') THEN
        CREATE POLICY "Admins can manage all orders"
        ON public.crm_orders
        FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    -- Order Services policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_order_services' AND policyname = 'Admins can view all order services') THEN
        CREATE POLICY "Admins can view all order services"
        ON public.crm_order_services
        FOR SELECT
        USING (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_order_services' AND policyname = 'Admins can manage all order services') THEN
        CREATE POLICY "Admins can manage all order services"
        ON public.crm_order_services
        FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    -- Business Data policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monthly_business_data' AND policyname = 'Admins can view all business data') THEN
        CREATE POLICY "Admins can view all business data"
        ON public.monthly_business_data
        FOR SELECT
        USING (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monthly_business_data' AND policyname = 'Admins can manage all business data') THEN
        CREATE POLICY "Admins can manage all business data"
        ON public.monthly_business_data
        FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    -- Business Targets policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_targets' AND policyname = 'Admins can view all business targets') THEN
        CREATE POLICY "Admins can view all business targets"
        ON public.business_targets
        FOR SELECT
        USING (has_role(auth.uid(), 'admin'::app_role));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_targets' AND policyname = 'Admins can manage all business targets') THEN
        CREATE POLICY "Admins can manage all business targets"
        ON public.business_targets
        FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;

END $$;