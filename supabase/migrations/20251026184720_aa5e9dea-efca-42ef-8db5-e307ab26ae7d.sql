-- Create travel expenses table
CREATE TABLE public.travel_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_description TEXT NOT NULL,
  departure_location TEXT NOT NULL,
  arrival_location TEXT NOT NULL,
  distance_km NUMERIC NOT NULL,
  travel_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.travel_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own travel expenses" 
ON public.travel_expenses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own travel expenses" 
ON public.travel_expenses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own travel expenses" 
ON public.travel_expenses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own travel expenses" 
ON public.travel_expenses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_travel_expenses_user_date ON public.travel_expenses(user_id, travel_date DESC);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_travel_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_travel_expenses_updated_at
BEFORE UPDATE ON public.travel_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_travel_expenses_updated_at();