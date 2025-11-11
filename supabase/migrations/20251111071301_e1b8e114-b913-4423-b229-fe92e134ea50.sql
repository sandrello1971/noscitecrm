-- Create storage bucket for travel expense attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('travel-expense-attachments', 'travel-expense-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Add columns to travel_expenses table for attachments and status
ALTER TABLE public.travel_expenses 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS attachment_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_travel_expenses_status ON public.travel_expenses(status);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_user_status ON public.travel_expenses(user_id, status);

-- RLS policies for storage bucket
CREATE POLICY "Users can upload their own expense attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'travel-expense-attachments' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own expense attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'travel-expense-attachments' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own expense attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'travel-expense-attachments' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all expense attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'travel-expense-attachments' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Function to finalize expense (update status and set timestamp)
CREATE OR REPLACE FUNCTION public.finalize_travel_expense(expense_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.travel_expenses
  SET 
    status = 'submitted',
    submitted_at = NOW(),
    finalized_at = NOW()
  WHERE id = expense_id
    AND user_id = auth.uid()
    AND status = 'draft';
END;
$$;