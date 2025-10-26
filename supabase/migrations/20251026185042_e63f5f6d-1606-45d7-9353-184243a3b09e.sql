-- Add reimbursement rate column to travel_expenses
ALTER TABLE public.travel_expenses 
ADD COLUMN reimbursement_rate_per_km NUMERIC(10,4) DEFAULT 0.50;

-- Update the column to be NOT NULL with a default
ALTER TABLE public.travel_expenses 
ALTER COLUMN reimbursement_rate_per_km SET NOT NULL;