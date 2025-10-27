-- Aggiungi campi per l'automobile alla tabella travel_expenses
ALTER TABLE travel_expenses 
ADD COLUMN vehicle_plate text,
ADD COLUMN vehicle_model text;