-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS opportunity_to_order_conversion ON public.opportunities;

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.convert_opportunity_to_order();

-- Drop existing enum if exists  
DROP TYPE IF EXISTS opportunity_status CASCADE;

-- Create the enum type
CREATE TYPE opportunity_status AS ENUM ('in_attesa', 'acquisita', 'persa');

-- Update existing data first
UPDATE public.opportunities 
SET status = CASE 
  WHEN status = 'open' THEN 'in_attesa'
  WHEN status = 'won' THEN 'acquisita'
  WHEN status = 'lost' THEN 'persa'
  WHEN status = 'qualified' THEN 'in_attesa'
  WHEN status = 'proposal' THEN 'in_attesa'
  WHEN status = 'negotiation' THEN 'in_attesa'
  ELSE 'in_attesa'
END;

-- Alter column type
ALTER TABLE public.opportunities ALTER COLUMN status TYPE opportunity_status USING status::opportunity_status;
ALTER TABLE public.opportunities ALTER COLUMN status SET DEFAULT 'in_attesa'::opportunity_status;

-- Create the conversion function
CREATE OR REPLACE FUNCTION public.convert_opportunity_to_order()
RETURNS TRIGGER AS $$
DECLARE
  new_order_number TEXT;
  order_count INTEGER;
BEGIN
  -- Check if status changed to 'acquisita'
  IF NEW.status = 'acquisita'::opportunity_status AND 
     (OLD.status IS NULL OR OLD.status <> 'acquisita'::opportunity_status) THEN
    
    -- Generate order number
    SELECT COUNT(*) INTO order_count FROM public.crm_orders WHERE user_id = NEW.user_id;
    new_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD((order_count + 1)::TEXT, 4, '0');
    
    -- Create the order
    INSERT INTO public.crm_orders (
      user_id,
      company_id,
      title,
      description,
      order_number,
      total_amount,
      status,
      start_date,
      notes
    ) VALUES (
      NEW.user_id,
      NEW.company_id,
      NEW.title,
      NEW.description,
      new_order_number,
      NEW.amount,
      'draft',
      COALESCE(NEW.expected_close_date, CURRENT_DATE),
      COALESCE(NEW.notes, '') || ' (Convertito da opportunità: ' || NEW.title || ')'
    );
    
    -- Add service to order
    INSERT INTO public.crm_order_services (
      user_id,
      order_id,
      service_id,
      quantity,
      unit_price,
      total_price
    ) 
    SELECT 
      NEW.user_id,
      o.id,
      NEW.service_id,
      1,
      NEW.amount,
      NEW.amount
    FROM public.crm_orders o 
    WHERE o.order_number = new_order_number AND o.user_id = NEW.user_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create the trigger
CREATE TRIGGER opportunity_to_order_conversion
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW 
  EXECUTE FUNCTION public.convert_opportunity_to_order();