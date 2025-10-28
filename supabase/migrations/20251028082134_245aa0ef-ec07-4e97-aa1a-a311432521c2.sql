-- Add diaria (daily allowance) field to travel_expenses table
ALTER TABLE travel_expenses 
ADD COLUMN requires_diaria boolean NOT NULL DEFAULT false;