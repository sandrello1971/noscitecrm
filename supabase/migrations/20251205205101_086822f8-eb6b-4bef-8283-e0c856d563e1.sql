-- Elimina tutti i dati di test dalle tabelle transazioni bancarie
DELETE FROM public.bank_transactions;
DELETE FROM public.bank_statements;

-- Opzionale: rimuovi la policy RLS permissiva
DROP POLICY IF EXISTS "Users can view bank transactions" ON public.bank_transactions;