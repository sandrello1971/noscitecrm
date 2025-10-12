-- Tabella per la cronologia delle scansioni di biglietti da visita
CREATE TABLE IF NOT EXISTS public.business_card_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  extracted_data JSONB NOT NULL DEFAULT '{}',
  corrected_data JSONB,
  ocr_confidence NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella per le impostazioni OCR (solo admin)
CREATE TABLE IF NOT EXISTS public.ocr_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'ita',
  quality_threshold NUMERIC(5,2) DEFAULT 60.0,
  auto_create_company BOOLEAN DEFAULT true,
  auto_create_contact BOOLEAN DEFAULT true,
  field_mappings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_business_card_scans_user_id ON public.business_card_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_business_card_scans_company_id ON public.business_card_scans(company_id);
CREATE INDEX IF NOT EXISTS idx_business_card_scans_created_at ON public.business_card_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_settings_user_id ON public.ocr_settings(user_id);

-- Trigger per aggiornare updated_at
CREATE TRIGGER update_business_card_scans_updated_at
  BEFORE UPDATE ON public.business_card_scans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ocr_settings_updated_at
  BEFORE UPDATE ON public.ocr_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies per business_card_scans
ALTER TABLE public.business_card_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their scans"
  ON public.business_card_scans FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their scans"
  ON public.business_card_scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their scans"
  ON public.business_card_scans FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their scans"
  ON public.business_card_scans FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- RLS Policies per ocr_settings
ALTER TABLE public.ocr_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their OCR settings"
  ON public.ocr_settings FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage OCR settings"
  ON public.ocr_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
