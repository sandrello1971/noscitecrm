-- Function to sync opportunity updates to related order
CREATE OR REPLACE FUNCTION public.sync_opportunity_to_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  related_order_id uuid;
BEGIN
  -- Only sync if the opportunity is already 'acquisita' (has a related order)
  IF NEW.status = 'acquisita' THEN
    -- Find the related order by matching notes pattern and company
    SELECT id INTO related_order_id
    FROM public.crm_orders
    WHERE notes LIKE '%da opportunità: ' || OLD.title || '%'
      AND company_id = OLD.company_id
      AND user_id = OLD.user_id
    LIMIT 1;
    
    -- If order exists, update it
    IF related_order_id IS NOT NULL THEN
      UPDATE public.crm_orders
      SET 
        title = NEW.title,
        description = NEW.description,
        company_id = NEW.company_id,
        total_amount = NEW.amount,
        notes = 'Creata automaticamente da opportunità: ' || NEW.title,
        updated_at = now()
      WHERE id = related_order_id;
      
      -- Sync services: delete old and insert new
      DELETE FROM public.crm_order_services WHERE order_id = related_order_id;
      
      INSERT INTO public.crm_order_services (
        id,
        order_id,
        service_id,
        quantity,
        unit_price,
        total_price,
        notes,
        user_id,
        created_at,
        updated_at
      )
      SELECT 
        gen_random_uuid(),
        related_order_id,
        os.service_id,
        os.quantity,
        os.unit_price,
        os.total_price,
        os.notes,
        os.user_id,
        now(),
        now()
      FROM public.opportunity_services os
      WHERE os.opportunity_id = NEW.id;
      
      RAISE LOG 'Order % synced from opportunity %', related_order_id, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for opportunity updates
DROP TRIGGER IF EXISTS sync_opportunity_updates_to_order ON public.opportunities;
CREATE TRIGGER sync_opportunity_updates_to_order
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_opportunity_to_order();