-- Aggiunge riferimento alla commessa per le spese di viaggio
ALTER TABLE public.travel_expenses 
ADD COLUMN order_id uuid REFERENCES public.crm_orders(id) ON DELETE SET NULL;