-- Remove the automatic trigger that creates projects from orders
-- Projects should be created manually via button in the order dialog

DROP TRIGGER IF EXISTS auto_create_crm_project_on_order_status ON public.crm_orders;
DROP FUNCTION IF EXISTS public.auto_create_crm_project_from_order() CASCADE;