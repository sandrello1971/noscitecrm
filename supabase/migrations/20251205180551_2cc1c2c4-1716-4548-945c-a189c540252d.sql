-- CRM Projects table (linked to orders/commesse)
CREATE TABLE public.crm_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.crm_orders(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  start_date date,
  end_date date,
  planned_start_date date,
  planned_end_date date,
  budget numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  planned_value numeric DEFAULT 0,
  earned_value numeric DEFAULT 0,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- CRM Project tasks/activities
CREATE TABLE public.crm_project_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.crm_projects(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES public.crm_project_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'completed', 'cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to_user_id uuid,
  assigned_to_company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  assigned_to_group text,
  start_date date,
  end_date date,
  planned_start_date date,
  planned_end_date date,
  estimated_hours numeric DEFAULT 0,
  actual_hours numeric DEFAULT 0,
  planned_cost numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  depends_on uuid[] DEFAULT '{}',
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- CRM Project timesheets
CREATE TABLE public.crm_project_timesheets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.crm_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.crm_project_tasks(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  work_date date NOT NULL,
  hours numeric NOT NULL CHECK (hours > 0 AND hours <= 24),
  activity_type text NOT NULL CHECK (activity_type IN ('development', 'design', 'analysis', 'testing', 'meeting', 'documentation', 'support', 'management', 'other')),
  hourly_rate numeric DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- CRM Project documents
CREATE TABLE public.crm_project_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.crm_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.crm_project_tasks(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  document_type text NOT NULL CHECK (document_type IN ('project_plan', 'meeting_minutes', 'report', 'timesheet', 'specification', 'contract', 'deliverable', 'other')),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer NOT NULL,
  file_type text NOT NULL,
  version integer DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_project_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_project_documents ENABLE ROW LEVEL SECURITY;

-- CRM Projects policies
CREATE POLICY "Users can manage their CRM projects" ON public.crm_projects
  FOR ALL USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- CRM Tasks policies
CREATE POLICY "Users can manage tasks in their CRM projects" ON public.crm_project_tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.crm_projects WHERE crm_projects.id = crm_project_tasks.project_id 
            AND (crm_projects.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.crm_projects WHERE crm_projects.id = crm_project_tasks.project_id 
            AND (crm_projects.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
  );

-- CRM Timesheets policies
CREATE POLICY "Users can manage CRM timesheets" ON public.crm_project_timesheets
  FOR ALL USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.crm_projects WHERE crm_projects.id = crm_project_timesheets.project_id 
            AND (crm_projects.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.crm_projects WHERE crm_projects.id = crm_project_timesheets.project_id 
            AND (crm_projects.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
  );

-- CRM Documents policies
CREATE POLICY "Users can manage CRM project documents" ON public.crm_project_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.crm_projects WHERE crm_projects.id = crm_project_documents.project_id 
            AND (crm_projects.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.crm_projects WHERE crm_projects.id = crm_project_documents.project_id 
            AND (crm_projects.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
  );

-- Create storage bucket for CRM project documents
INSERT INTO storage.buckets (id, name, public) VALUES ('crm-project-documents', 'crm-project-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for CRM project documents
CREATE POLICY "Users can upload CRM project documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'crm-project-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view CRM project documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'crm-project-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete CRM project documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'crm-project-documents' AND auth.uid() IS NOT NULL);

-- Trigger to auto-create CRM project when order status changes to 'in_progress'
CREATE OR REPLACE FUNCTION public.auto_create_crm_project_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    IF NOT EXISTS (SELECT 1 FROM public.crm_projects WHERE order_id = NEW.id) THEN
      INSERT INTO public.crm_projects (
        order_id,
        user_id,
        name,
        description,
        status,
        planned_start_date,
        planned_end_date,
        budget
      ) VALUES (
        NEW.id,
        NEW.user_id,
        NEW.title,
        NEW.description,
        'planning',
        NEW.start_date,
        NEW.end_date,
        COALESCE(NEW.total_amount, 0)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS auto_create_crm_project_on_order_status ON public.crm_orders;
CREATE TRIGGER auto_create_crm_project_on_order_status
  AFTER UPDATE ON public.crm_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_crm_project_from_order();

-- Indexes for performance
CREATE INDEX idx_crm_projects_order_id ON public.crm_projects(order_id);
CREATE INDEX idx_crm_projects_user_id ON public.crm_projects(user_id);
CREATE INDEX idx_crm_project_tasks_project_id ON public.crm_project_tasks(project_id);
CREATE INDEX idx_crm_project_tasks_parent_task_id ON public.crm_project_tasks(parent_task_id);
CREATE INDEX idx_crm_project_timesheets_project_id ON public.crm_project_timesheets(project_id);
CREATE INDEX idx_crm_project_timesheets_task_id ON public.crm_project_timesheets(task_id);
CREATE INDEX idx_crm_project_timesheets_work_date ON public.crm_project_timesheets(work_date);
CREATE INDEX idx_crm_project_documents_project_id ON public.crm_project_documents(project_id);