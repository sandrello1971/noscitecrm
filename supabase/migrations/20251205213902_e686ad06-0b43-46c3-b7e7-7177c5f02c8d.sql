-- Function to detect cycles in task dependencies
CREATE OR REPLACE FUNCTION public.check_dependency_cycle(
  p_predecessor_id UUID,
  p_successor_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_cycle BOOLEAN := FALSE;
  v_visited UUID[];
  v_to_visit UUID[];
  v_current UUID;
BEGIN
  -- If predecessor equals successor, it's a direct cycle
  IF p_predecessor_id = p_successor_id THEN
    RETURN TRUE;
  END IF;

  -- BFS to detect cycles: start from successor and see if we can reach predecessor
  v_to_visit := ARRAY[p_successor_id];
  v_visited := ARRAY[]::UUID[];

  WHILE array_length(v_to_visit, 1) > 0 LOOP
    v_current := v_to_visit[1];
    v_to_visit := v_to_visit[2:array_length(v_to_visit, 1)];

    -- Skip if already visited
    IF v_current = ANY(v_visited) THEN
      CONTINUE;
    END IF;

    -- Mark as visited
    v_visited := array_append(v_visited, v_current);

    -- Check if we reached the predecessor (cycle detected)
    IF v_current = p_predecessor_id THEN
      RETURN TRUE;
    END IF;

    -- Add all successors of current task to visit queue
    SELECT array_agg(successor_task_id) INTO v_to_visit
    FROM (
      SELECT DISTINCT successor_task_id 
      FROM crm_task_dependencies 
      WHERE predecessor_task_id = v_current
      AND successor_task_id != ALL(v_visited)
      UNION ALL
      SELECT UNNEST(v_to_visit)
    ) sub;

    IF v_to_visit IS NULL THEN
      v_to_visit := ARRAY[]::UUID[];
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$;

-- Trigger function to validate dependency before insert
CREATE OR REPLACE FUNCTION public.validate_task_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for cycles
  IF check_dependency_cycle(NEW.predecessor_task_id, NEW.successor_task_id) THEN
    RAISE EXCEPTION 'Dipendenza ciclica rilevata. Non è possibile creare questa dipendenza perché creerebbe un ciclo.';
  END IF;

  -- Verify both tasks are in the same project
  IF NOT EXISTS (
    SELECT 1 FROM crm_project_tasks t1
    JOIN crm_project_tasks t2 ON t1.project_id = t2.project_id
    WHERE t1.id = NEW.predecessor_task_id AND t2.id = NEW.successor_task_id
  ) THEN
    RAISE EXCEPTION 'Le attività devono appartenere allo stesso progetto';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for dependency validation
DROP TRIGGER IF EXISTS validate_dependency_trigger ON crm_task_dependencies;
CREATE TRIGGER validate_dependency_trigger
  BEFORE INSERT ON crm_task_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION validate_task_dependency();

-- Function to recalculate task dates based on dependencies
CREATE OR REPLACE FUNCTION public.recalculate_task_dates(p_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep RECORD;
  v_predecessor RECORD;
  v_new_start DATE;
  v_new_end DATE;
  v_duration INTEGER;
  v_task RECORD;
BEGIN
  -- Get current task info
  SELECT * INTO v_task FROM crm_project_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Calculate task duration (use planned dates)
  v_duration := COALESCE(
    v_task.planned_end_date - v_task.planned_start_date,
    v_task.estimated_hours / 8, -- Assume 8 hours per day
    1 -- Default 1 day
  );
  IF v_duration < 0 THEN v_duration := 1; END IF;

  -- Find the latest constraint from all predecessors
  v_new_start := NULL;
  v_new_end := NULL;

  FOR v_dep IN 
    SELECT d.*, d.dependency_type as dep_type, d.lag_days
    FROM crm_task_dependencies d
    WHERE d.successor_task_id = p_task_id
  LOOP
    -- Get predecessor dates
    SELECT 
      COALESCE(planned_start_date, start_date) as pred_start,
      COALESCE(planned_end_date, end_date) as pred_end
    INTO v_predecessor
    FROM crm_project_tasks 
    WHERE id = v_dep.predecessor_task_id;

    IF v_predecessor.pred_start IS NULL AND v_predecessor.pred_end IS NULL THEN
      CONTINUE;
    END IF;

    -- Calculate constraint based on dependency type
    CASE v_dep.dep_type
      WHEN 'FS' THEN
        -- Finish to Start: successor starts after predecessor ends
        IF v_predecessor.pred_end IS NOT NULL THEN
          v_new_start := GREATEST(
            COALESCE(v_new_start, '1900-01-01'::DATE),
            v_predecessor.pred_end + v_dep.lag_days + 1
          );
        END IF;
      WHEN 'SS' THEN
        -- Start to Start: successor starts after predecessor starts
        IF v_predecessor.pred_start IS NOT NULL THEN
          v_new_start := GREATEST(
            COALESCE(v_new_start, '1900-01-01'::DATE),
            v_predecessor.pred_start + v_dep.lag_days
          );
        END IF;
      WHEN 'FF' THEN
        -- Finish to Finish: successor ends after predecessor ends
        IF v_predecessor.pred_end IS NOT NULL THEN
          v_new_end := GREATEST(
            COALESCE(v_new_end, '1900-01-01'::DATE),
            v_predecessor.pred_end + v_dep.lag_days
          );
        END IF;
      WHEN 'SF' THEN
        -- Start to Finish: successor ends after predecessor starts
        IF v_predecessor.pred_start IS NOT NULL THEN
          v_new_end := GREATEST(
            COALESCE(v_new_end, '1900-01-01'::DATE),
            v_predecessor.pred_start + v_dep.lag_days
          );
        END IF;
    END CASE;
  END LOOP;

  -- Apply calculated dates
  IF v_new_start IS NOT NULL AND v_new_start != '1900-01-01'::DATE THEN
    -- Update start date and calculate end date based on duration
    UPDATE crm_project_tasks
    SET 
      planned_start_date = v_new_start,
      planned_end_date = CASE 
        WHEN v_new_end IS NOT NULL AND v_new_end != '1900-01-01'::DATE THEN v_new_end
        ELSE v_new_start + v_duration
      END,
      updated_at = now()
    WHERE id = p_task_id
    AND (planned_start_date IS NULL OR planned_start_date < v_new_start);
  ELSIF v_new_end IS NOT NULL AND v_new_end != '1900-01-01'::DATE THEN
    -- Update end date and calculate start date based on duration
    UPDATE crm_project_tasks
    SET 
      planned_end_date = v_new_end,
      planned_start_date = CASE
        WHEN planned_start_date IS NULL THEN v_new_end - v_duration
        ELSE planned_start_date
      END,
      updated_at = now()
    WHERE id = p_task_id
    AND (planned_end_date IS NULL OR planned_end_date < v_new_end);
  END IF;
END;
$$;

-- Function to cascade date recalculation to all successors
CREATE OR REPLACE FUNCTION public.cascade_recalculate_dates(p_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_successor_id UUID;
  v_processed UUID[] := ARRAY[]::UUID[];
  v_queue UUID[] := ARRAY[p_task_id];
  v_current UUID;
BEGIN
  WHILE array_length(v_queue, 1) > 0 LOOP
    v_current := v_queue[1];
    v_queue := v_queue[2:array_length(v_queue, 1)];

    IF v_current = ANY(v_processed) THEN
      CONTINUE;
    END IF;

    v_processed := array_append(v_processed, v_current);

    -- Recalculate this task's dates
    PERFORM recalculate_task_dates(v_current);

    -- Add all successors to queue
    FOR v_successor_id IN
      SELECT DISTINCT successor_task_id 
      FROM crm_task_dependencies 
      WHERE predecessor_task_id = v_current
    LOOP
      IF NOT v_successor_id = ANY(v_processed) THEN
        v_queue := array_append(v_queue, v_successor_id);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Trigger to recalculate dates when dependency is added
CREATE OR REPLACE FUNCTION public.after_dependency_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Recalculate successor and its dependents
    PERFORM cascade_recalculate_dates(NEW.successor_task_id);
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS after_dependency_change_trigger ON crm_task_dependencies;
CREATE TRIGGER after_dependency_change_trigger
  AFTER INSERT OR UPDATE ON crm_task_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION after_dependency_change();

-- Trigger to cascade date changes when a task's dates change
CREATE OR REPLACE FUNCTION public.after_task_date_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only cascade if planned dates actually changed
  IF (OLD.planned_start_date IS DISTINCT FROM NEW.planned_start_date) OR
     (OLD.planned_end_date IS DISTINCT FROM NEW.planned_end_date) THEN
    -- Recalculate all successors
    PERFORM cascade_recalculate_dates(NEW.id);
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS after_task_date_change_trigger ON crm_project_tasks;
CREATE TRIGGER after_task_date_change_trigger
  AFTER UPDATE ON crm_project_tasks
  FOR EACH ROW
  WHEN (OLD.planned_start_date IS DISTINCT FROM NEW.planned_start_date OR 
        OLD.planned_end_date IS DISTINCT FROM NEW.planned_end_date)
  EXECUTE FUNCTION after_task_date_change();