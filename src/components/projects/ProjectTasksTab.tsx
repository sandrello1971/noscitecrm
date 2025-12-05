import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  Building2,
  Clock,
  CheckCircle,
  Circle,
  AlertCircle,
  XCircle,
  ChevronRight,
  ChevronDown
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { AddTaskDialog } from "./AddTaskDialog"
import { EditTaskDialog } from "./EditTaskDialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { format } from "date-fns"
import { it } from "date-fns/locale"

interface Task {
  id: string
  project_id: string
  parent_task_id?: string
  name: string
  description?: string
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to_user_id?: string
  assigned_to_company_id?: string
  assigned_to_group?: string
  start_date?: string
  end_date?: string
  planned_start_date?: string
  planned_end_date?: string
  estimated_hours: number
  actual_hours: number
  progress_percentage: number
  sort_order: number
  children?: Task[]
  assigned_company_name?: string
}

interface ProjectTasksTabProps {
  projectId: string
  onTasksChange?: () => void
}

export function ProjectTasksTab({ projectId, onTasksChange }: ProjectTasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [parentTaskId, setParentTaskId] = useState<string | undefined>()
  const { toast } = useToast()

  const loadTasks = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('crm_project_tasks')
        .select(`
          *,
          crm_companies(name)
        `)
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })

      if (error) throw error

      // Build tree structure
      const taskMap = new Map<string, Task>()
      const rootTasks: Task[] = []

      data?.forEach(task => {
        taskMap.set(task.id, { 
          ...task, 
          status: task.status as Task['status'],
          priority: task.priority as Task['priority'],
          children: [],
          assigned_company_name: task.crm_companies?.name
        })
      })

      taskMap.forEach(task => {
        if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
          taskMap.get(task.parent_task_id)!.children!.push(task)
        } else {
          rootTasks.push(task)
        }
      })

      setTasks(rootTasks)
    } catch (error: any) {
      console.error('Error loading tasks:', error)
      toast({
        title: "Errore",
        description: "Impossibile caricare le attività",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [projectId])

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const handleAddTask = (parentId?: string) => {
    setParentTaskId(parentId)
    setShowAddDialog(true)
  }

  const handleEditTask = (task: Task) => {
    setSelectedTask(task)
    setShowEditDialog(true)
  }

  const handleDeleteTask = (task: Task) => {
    setSelectedTask(task)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!selectedTask) return

    try {
      const { error } = await supabase
        .from('crm_project_tasks')
        .delete()
        .eq('id', selectedTask.id)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Attività eliminata"
      })
      loadTasks()
      onTasksChange?.()
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'attività",
        variant: "destructive"
      })
    } finally {
      setShowDeleteDialog(false)
      setSelectedTask(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo': return <Circle className="h-4 w-4 text-muted-foreground" />
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />
      case 'review': return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Circle className="h-4 w-4" />
    }
  }

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
      'low': { variant: 'secondary', label: 'Bassa' },
      'medium': { variant: 'outline', label: 'Media' },
      'high': { variant: 'default', label: 'Alta' },
      'urgent': { variant: 'destructive', label: 'Urgente' }
    }
    const { variant, label } = config[priority] || config.medium
    return <Badge variant={variant} className="text-xs">{label}</Badge>
  }

  const renderTask = (task: Task, level: number = 0) => {
    const hasChildren = task.children && task.children.length > 0
    const isExpanded = expandedTasks.has(task.id)

    return (
      <div key={task.id}>
        <div 
          className={`flex items-center gap-2 p-3 border-b hover:bg-muted/50 ${level > 0 ? 'bg-muted/20' : ''}`}
          style={{ paddingLeft: `${12 + level * 24}px` }}
        >
          {/* Expand/Collapse */}
          <div className="w-6">
            {hasChildren ? (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(task.id)}>
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : null}
          </div>

          {/* Status */}
          {getStatusIcon(task.status)}

          {/* Task Name */}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{task.name}</div>
            {task.description && (
              <div className="text-xs text-muted-foreground truncate">{task.description}</div>
            )}
          </div>

          {/* Assignee */}
          <div className="w-32 text-sm text-muted-foreground truncate">
            {task.assigned_company_name ? (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {task.assigned_company_name}
              </span>
            ) : task.assigned_to_group ? (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {task.assigned_to_group}
              </span>
            ) : '-'}
          </div>

          {/* Priority */}
          <div className="w-20">
            {getPriorityBadge(task.priority)}
          </div>

          {/* Progress */}
          <div className="w-24">
            <div className="flex items-center gap-2">
              <Progress value={task.progress_percentage} className="h-2 flex-1" />
              <span className="text-xs w-8">{task.progress_percentage}%</span>
            </div>
          </div>

          {/* Hours */}
          <div className="w-20 text-xs text-muted-foreground text-right">
            {task.actual_hours}/{task.estimated_hours}h
          </div>

          {/* Dates */}
          <div className="w-24 text-xs text-muted-foreground">
            {task.planned_end_date 
              ? format(new Date(task.planned_end_date), 'dd MMM', { locale: it })
              : '-'
            }
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAddTask(task.id)}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditTask(task)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTask(task)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {task.children!.map(child => renderTask(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="p-4">Caricamento attività...</div>
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Attività del Progetto</CardTitle>
        <Button onClick={() => handleAddTask()}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova Attività
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b bg-muted/50 text-sm font-medium">
          <div className="w-6" />
          <div className="w-4" />
          <div className="flex-1">Nome</div>
          <div className="w-32">Assegnato a</div>
          <div className="w-20">Priorità</div>
          <div className="w-24">Progresso</div>
          <div className="w-20 text-right">Ore</div>
          <div className="w-24">Scadenza</div>
          <div className="w-24">Azioni</div>
        </div>

        {/* Tasks */}
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nessuna attività. Clicca "Nuova Attività" per iniziare.
          </div>
        ) : (
          tasks.map(task => renderTask(task))
        )}
      </CardContent>

      {/* Dialogs */}
      <AddTaskDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        projectId={projectId}
        parentTaskId={parentTaskId}
        onTaskAdded={() => {
          loadTasks()
          onTasksChange?.()
        }}
      />

      {selectedTask && (
        <EditTaskDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          task={selectedTask}
          onTaskUpdated={() => {
            loadTasks()
            onTasksChange?.()
          }}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare l'attività?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione eliminerà anche tutte le sotto-attività. Non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
