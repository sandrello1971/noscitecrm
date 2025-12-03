-- Fix the trigger to prevent duplicate orders from same opportunity
CREATE OR REPLACE FUNCTION public.convert_opportunity_to_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_order_id uuid;
  new_order_number text;
  opp_service record;
  existing_order_count integer;
BEGIN
  -- Only trigger when status changes to 'acquisita'
  IF NEW.status = 'acquisita' AND (OLD.status IS NULL OR OLD.status != 'acquisita') THEN
    
    -- Check if order already exists for this opportunity (by checking notes)
    SELECT COUNT(*) INTO existing_order_count
    FROM public.crm_orders
    WHERE notes LIKE '%da opportunità: ' || NEW.title || '%'
      AND company_id = NEW.company_id
      AND user_id = NEW.user_id;
    
    -- Skip if order already exists
    IF existing_order_count > 0 THEN
      RAISE LOG 'Order already exists for opportunity %, skipping creation', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Generate order number based on timestamp
    new_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || substring(gen_random_uuid()::text, 1, 8);
    
    -- Create the order from opportunity
    INSERT INTO public.crm_orders (
      id,
      order_number,
      title,
      description,
      company_id,
      user_id,
      status,
      total_amount,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      new_order_number,
      NEW.title,
      NEW.description,
      NEW.company_id,
      NEW.user_id,
      'active',
      NEW.amount,
      'Creata automaticamente da opportunità: ' || NEW.title,
      now(),
      now()
    )
    RETURNING id INTO new_order_id;
    
    -- Copy opportunity services to order services
    FOR opp_service IN 
      SELECT * FROM public.opportunity_services WHERE opportunity_id = NEW.id
    LOOP
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
      VALUES (
        gen_random_uuid(),
        new_order_id,
        opp_service.service_id,
        opp_service.quantity,
        opp_service.unit_price,
        opp_service.total_price,
        opp_service.notes,
        opp_service.user_id,
        now(),
        now()
      );
    END LOOP;
    
    RAISE LOG 'Order % created from opportunity %', new_order_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;