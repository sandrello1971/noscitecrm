-- Create enum type for opportunity status
CREATE TYPE opportunity_status AS ENUM ('in_attesa', 'acquisita', 'persa');

-- First, update existing data to use valid enum values
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

-- Now change the column type
ALTER TABLE public.opportunities 
ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.opportunities 
ALTER COLUMN status TYPE opportunity_status USING status::opportunity_status;

-- Set the new default
ALTER TABLE public.opportunities 
ALTER COLUMN status SET DEFAULT 'in_attesa'::opportunity_status;

-- Create function to automatically convert opportunity to order when status becomes 'acquisita'
CREATE OR REPLACE FUNCTION public.convert_opportunity_to_order()
RETURNS TRIGGER AS $$
DECLARE
  new_order_number TEXT;
  order_count INTEGER;
BEGIN
  -- Only proceed if status changed to 'acquisita'
  IF NEW.status::text = 'acquisita' AND (OLD.status IS NULL OR OLD.status::text != 'acquisita') THEN
    
    -- Generate order number
    SELECT COUNT(*) INTO order_count FROM public.crm_orders WHERE user_id = NEW.user_id;
    new_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD((order_count + 1)::TEXT, 4, '0');
    
    -- Create the order from the opportunity
    INSERT INTO public.crm_orders (
      user_id,
      company_id,
      title,
      description,
      order_number,
      total_amount,
      status,
      start_date,
      notes,
      created_at,
      updated_at
    ) VALUES (
      NEW.user_id,
      NEW.company_id,
      NEW.title,
      NEW.description,
      new_order_number,
      NEW.amount,
      'draft'::text,
      COALESCE(NEW.expected_close_date, CURRENT_DATE),
      COALESCE(NEW.notes, '') || ' (Convertito da opportunità: ' || NEW.title || ')',
      NOW(),
      NOW()
    );
    
    -- Add the service to the order
    WITH new_order AS (
      SELECT id FROM public.crm_orders WHERE order_number = new_order_number AND user_id = NEW.user_id
    )
    INSERT INTO public.crm_order_services (
      user_id,
      order_id,
      service_id,
      quantity,
      unit_price,
      total_price,
      created_at,
      updated_at
    ) 
    SELECT 
      NEW.user_id,
      new_order.id,
      NEW.service_id,
      1,
      NEW.amount,
      NEW.amount,
      NOW(),
      NOW()
    FROM new_order;
    
    -- Log the conversion
    RAISE NOTICE 'Opportunità % convertita automaticamente in commessa %', NEW.title, new_order_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create trigger for automatic conversion
CREATE TRIGGER opportunity_to_order_conversion
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW 
  EXECUTE FUNCTION public.convert_opportunity_to_order();