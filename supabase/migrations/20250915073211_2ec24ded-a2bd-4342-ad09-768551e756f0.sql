-- Add is_partner flag to crm_companies
ALTER TABLE public.crm_companies 
ADD COLUMN is_partner boolean NOT NULL DEFAULT false;

-- Create partner_services table to link partners with services they can provide
CREATE TABLE public.partner_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  partner_company_id uuid NOT NULL,
  service_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(partner_company_id, service_id)
);

-- Enable RLS on partner_services
ALTER TABLE public.partner_services ENABLE ROW LEVEL SECURITY;

-- Create policies for partner_services
CREATE POLICY "Users can manage their partner services"
ON public.partner_services
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add partner_id to crm_services to track which partner provides the service
ALTER TABLE public.crm_services 
ADD COLUMN partner_id uuid;

-- Add foreign key constraints
ALTER TABLE public.partner_services
ADD CONSTRAINT fk_partner_services_partner 
FOREIGN KEY (partner_company_id) REFERENCES public.crm_companies(id) ON DELETE CASCADE;

ALTER TABLE public.partner_services
ADD CONSTRAINT fk_partner_services_service 
FOREIGN KEY (service_id) REFERENCES public.crm_services(id) ON DELETE CASCADE;

ALTER TABLE public.crm_services
ADD CONSTRAINT fk_services_partner 
FOREIGN KEY (partner_id) REFERENCES public.crm_companies(id) ON DELETE SET NULL;