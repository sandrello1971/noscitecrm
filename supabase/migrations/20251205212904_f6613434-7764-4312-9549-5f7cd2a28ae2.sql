-- Create table for task dependencies with MS Project-style relationship types
CREATE TABLE public.crm_task_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  predecessor_task_id UUID NOT NULL REFERENCES public.crm_project_tasks(id) ON DELETE CASCADE,
  successor_task_id UUID NOT NULL REFERENCES public.crm_project_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'FS' CHECK (dependency_type IN ('FS', 'SS', 'FF', 'SF')),
  lag_days INTEGER NOT NULL DEFAULT 0, -- Positive = delay, Negative = lead time
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate dependencies
  UNIQUE(predecessor_task_id, successor_task_id),
  -- Prevent self-referencing
  CHECK (predecessor_task_id != successor_task_id)
);

-- Enable RLS
ALTER TABLE public.crm_task_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage dependencies for tasks in their projects
CREATE POLICY "Users can manage task dependencies"
ON public.crm_task_dependencies
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM crm_project_tasks pt
    JOIN crm_projects p ON pt.project_id = p.id
    WHERE pt.id = crm_task_dependencies.predecessor_task_id
    AND (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM crm_project_tasks pt
    JOIN crm_projects p ON pt.project_id = p.id
    WHERE pt.id = crm_task_dependencies.predecessor_task_id
    AND (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Create index for faster lookups
CREATE INDEX idx_task_dependencies_predecessor ON public.crm_task_dependencies(predecessor_task_id);
CREATE INDEX idx_task_dependencies_successor ON public.crm_task_dependencies(successor_task_id);

-- Add comment for documentation
COMMENT ON TABLE public.crm_task_dependencies IS 'Task dependencies with MS Project-style relationship types (FS, SS, FF, SF)';
COMMENT ON COLUMN public.crm_task_dependencies.dependency_type IS 'FS=Finish-to-Start, SS=Start-to-Start, FF=Finish-to-Finish, SF=Start-to-Finish';
COMMENT ON COLUMN public.crm_task_dependencies.lag_days IS 'Delay in days (positive) or lead time (negative) between linked tasks';