-- CRM Companies (Anagrafica Aziende)
CREATE TABLE public.crm_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  vat_number TEXT,
  tax_code TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'IT',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CRM Contacts (Anagrafica Contatti)
CREATE TABLE public.crm_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.crm_companies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  position TEXT,
  department TEXT,
  notes TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CRM Services (Distinta Base Servizi)
CREATE TABLE public.crm_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL CHECK (service_type IN ('simple', 'composed')),
  unit_price NUMERIC(10,2),
  unit_of_measure TEXT DEFAULT 'pz',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);

-- CRM Service Compositions (Relazioni tra servizi composti e componenti)
CREATE TABLE public.crm_service_compositions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  parent_service_id UUID NOT NULL REFERENCES public.crm_services(id) ON DELETE CASCADE,
  child_service_id UUID NOT NULL REFERENCES public.crm_services(id) ON DELETE CASCADE,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(parent_service_id, child_service_id)
);

-- CRM Orders (Commesse con struttura gerarchica)
CREATE TABLE public.crm_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.crm_companies(id) ON DELETE CASCADE,
  parent_order_id UUID REFERENCES public.crm_orders(id) ON DELETE CASCADE,
  assigned_user_id UUID,
  order_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'on_hold', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date DATE,
  end_date DATE,
  estimated_hours NUMERIC(10,2),
  actual_hours NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(12,2),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, order_number)
);

-- CRM Order Services (Relazione tra commesse e servizi)
CREATE TABLE public.crm_order_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.crm_orders(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.crm_services(id) ON DELETE CASCADE,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2),
  total_price NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all CRM tables
ALTER TABLE public.crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_service_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_order_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for CRM Companies
CREATE POLICY "Users can manage their companies" ON public.crm_companies
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for CRM Contacts
CREATE POLICY "Users can manage their contacts" ON public.crm_contacts
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for CRM Services
CREATE POLICY "Users can manage their services" ON public.crm_services
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for CRM Service Compositions
CREATE POLICY "Users can manage their service compositions" ON public.crm_service_compositions
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for CRM Orders
CREATE POLICY "Users can manage their orders" ON public.crm_orders
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for CRM Order Services
CREATE POLICY "Users can manage their order services" ON public.crm_order_services
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_crm_companies_user_id ON public.crm_companies(user_id);
CREATE INDEX idx_crm_contacts_user_id ON public.crm_contacts(user_id);
CREATE INDEX idx_crm_contacts_company_id ON public.crm_contacts(company_id);
CREATE INDEX idx_crm_services_user_id ON public.crm_services(user_id);
CREATE INDEX idx_crm_service_compositions_parent ON public.crm_service_compositions(parent_service_id);
CREATE INDEX idx_crm_service_compositions_child ON public.crm_service_compositions(child_service_id);
CREATE INDEX idx_crm_orders_user_id ON public.crm_orders(user_id);
CREATE INDEX idx_crm_orders_company_id ON public.crm_orders(company_id);
CREATE INDEX idx_crm_orders_parent ON public.crm_orders(parent_order_id);
CREATE INDEX idx_crm_order_services_order_id ON public.crm_order_services(order_id);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_crm_companies_updated_at
  BEFORE UPDATE ON public.crm_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_services_updated_at
  BEFORE UPDATE ON public.crm_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_orders_updated_at
  BEFORE UPDATE ON public.crm_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_order_services_updated_at
  BEFORE UPDATE ON public.crm_order_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();