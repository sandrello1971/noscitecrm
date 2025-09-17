-- Add a temporary column with the new enum type (since table is empty, this will work)
ALTER TABLE public.opportunities ADD COLUMN status_new opportunity_status DEFAULT 'in_attesa'::opportunity_status;

-- Drop the old column and rename the new one (safe since table is empty)
ALTER TABLE public.opportunities DROP COLUMN status;
ALTER TABLE public.opportunities RENAME COLUMN status_new TO status;