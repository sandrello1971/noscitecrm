-- Create opportunities table for sales forecast
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  service_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  win_probability INTEGER NOT NULL DEFAULT 50 CHECK (win_probability >= 0 AND win_probability <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'cancelled')),
  expected_close_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their opportunities" 
ON public.opportunities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their opportunities" 
ON public.opportunities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their opportunities" 
ON public.opportunities 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their opportunities" 
ON public.opportunities 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_opportunities_updated_at
BEFORE UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key constraints
ALTER TABLE public.opportunities 
ADD CONSTRAINT opportunities_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.crm_companies(id) ON DELETE CASCADE;

ALTER TABLE public.opportunities 
ADD CONSTRAINT opportunities_service_id_fkey 
FOREIGN KEY (service_id) REFERENCES public.crm_services(id) ON DELETE CASCADE;