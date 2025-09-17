-- Add a temporary column with the new enum type (enum already exists)
ALTER TABLE public.opportunities ADD COLUMN status_new opportunity_status DEFAULT 'in_attesa'::opportunity_status;

-- Update the new column based on existing values
UPDATE public.opportunities 
SET status_new = CASE 
  WHEN status = 'open' THEN 'in_attesa'::opportunity_status
  WHEN status = 'won' THEN 'acquisita'::opportunity_status
  WHEN status = 'lost' THEN 'persa'::opportunity_status
  WHEN status = 'qualified' THEN 'in_attesa'::opportunity_status
  WHEN status = 'proposal' THEN 'in_attesa'::opportunity_status
  WHEN status = 'negotiation' THEN 'in_attesa'::opportunity_status
  ELSE 'in_attesa'::opportunity_status
END;

-- Drop the old column and rename the new one
ALTER TABLE public.opportunities DROP COLUMN status;
ALTER TABLE public.opportunities RENAME COLUMN status_new TO status;

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