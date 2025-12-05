import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GripVertical } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { format, differenceInDays, addDays, startOfWeek, eachDayOfInterval, isWeekend, isSameDay } from "date-fns"
import { it } from "date-fns/locale"

interface Task {
  id: string
  name: string
  status: string
  planned_start_date?: string
  planned_end_date?: string
  start_date?: string
  end_date?: string
  progress_percentage: number
  parent_task_id?: string
  sort_order: number
}

interface ProjectGanttTabProps {
  projectId: string
}

export function ProjectGanttTab({ projectId }: ProjectGanttTabProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadTasks()
  }, [projectId])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('crm_project_tasks')
        .select('id, name, status, planned_start_date, planned_end_date, start_date, end_date, progress_percentage, parent_task_id, sort_order')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setTasks(data || [])
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare le attività",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTask(null)
    setDragOverTaskId(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }

  const handleDragOver = (e: React.DragEvent, task: Task) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    // Only allow drop on tasks with same parent (or both root level)
    if (draggedTask && draggedTask.parent_task_id === task.parent_task_id && draggedTask.id !== task.id) {
      setDragOverTaskId(task.id)
    }
  }

  const handleDragLeave = () => {
    setDragOverTaskId(null)
  }

  const handleDrop = async (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault()
    setDragOverTaskId(null)
    
    if (!draggedTask || draggedTask.id === targetTask.id) return
    if (draggedTask.parent_task_id !== targetTask.parent_task_id) return

    // Get tasks with same parent
    const siblingTasks = tasks.filter(t => t.parent_task_id === draggedTask.parent_task_id)
    const draggedIndex = siblingTasks.findIndex(t => t.id === draggedTask.id)
    const targetIndex = siblingTasks.findIndex(t => t.id === targetTask.id)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Reorder
    const newSiblings = [...siblingTasks]
    newSiblings.splice(draggedIndex, 1)
    newSiblings.splice(targetIndex, 0, draggedTask)

    // Update sort_order in database
    try {
      const updates = newSiblings.map((task, index) => ({
        id: task.id,
        sort_order: index
      }))

      for (const update of updates) {
        await supabase
          .from('crm_project_tasks')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id)
      }

      // Optimistic update
      const newTasks = tasks.map(t => {
        const updated = updates.find(u => u.id === t.id)
        return updated ? { ...t, sort_order: updated.sort_order } : t
      }).sort((a, b) => a.sort_order - b.sort_order)

      setTasks(newTasks)

      toast({
        title: "Ordine aggiornato",
        description: "L'ordine delle attività è stato modificato"
      })
    } catch (error: any) {
      console.error('Error reordering tasks:', error)
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'ordine",
        variant: "destructive"
      })
      loadTasks() // Reload to restore correct order
    }
  }

  // Calculate date range
  const { dateRange, startDate, endDate } = useMemo(() => {
    const today = new Date()
    let minDate = today
    let maxDate = addDays(today, 30)

    tasks.forEach(task => {
      const taskStart = task.planned_start_date ? new Date(task.planned_start_date) : task.start_date ? new Date(task.start_date) : null
      const taskEnd = task.planned_end_date ? new Date(task.planned_end_date) : task.end_date ? new Date(task.end_date) : null

      if (taskStart && taskStart < minDate) minDate = taskStart
      if (taskEnd && taskEnd > maxDate) maxDate = taskEnd
    })

    // Extend range for better visualization
    minDate = addDays(startOfWeek(minDate, { locale: it }), -7)
    maxDate = addDays(maxDate, 7)

    const range = eachDayOfInterval({ start: minDate, end: maxDate })
    return { dateRange: range, startDate: minDate, endDate: maxDate }
  }, [tasks])

  const getTaskBar = (task: Task) => {
    const taskStart = task.planned_start_date ? new Date(task.planned_start_date) : task.start_date ? new Date(task.start_date) : null
    const taskEnd = task.planned_end_date ? new Date(task.planned_end_date) : task.end_date ? new Date(task.end_date) : null

    if (!taskStart || !taskEnd) return null

    const totalDays = differenceInDays(endDate, startDate)
    const startOffset = differenceInDays(taskStart, startDate)
    const duration = differenceInDays(taskEnd, taskStart) + 1

    const leftPercent = (startOffset / totalDays) * 100
    const widthPercent = (duration / totalDays) * 100

    return { leftPercent, widthPercent }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500'
      case 'review': return 'bg-yellow-500'
      case 'cancelled': return 'bg-red-500'
      default: return 'bg-muted-foreground'
    }
  }

  if (loading) {
    return <div className="p-4">Caricamento Gantt...</div>
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Nessuna attività con date pianificate. Aggiungi attività con date per visualizzare il Gantt.
        </CardContent>
      </Card>
    )
  }

  // Group dates by week/month for header
  const weeks: { start: Date; days: Date[] }[] = []
  let currentWeek: Date[] = []
  let weekStart: Date | null = null

  dateRange.forEach((day, index) => {
    if (day.getDay() === 1 || index === 0) {
      if (currentWeek.length > 0 && weekStart) {
        weeks.push({ start: weekStart, days: [...currentWeek] })
      }
      currentWeek = [day]
      weekStart = day
    } else {
      currentWeek.push(day)
    }
  })
  if (currentWeek.length > 0 && weekStart) {
    weeks.push({ start: weekStart, days: [...currentWeek] })
  }

  const parentTasks = tasks.filter(t => !t.parent_task_id)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Diagramma di Gantt</span>
          <span className="text-xs font-normal text-muted-foreground">
            Trascina le attività per riordinarle
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Header - Weeks */}
          <div className="flex border-b sticky top-0 bg-background z-10">
            <div className="w-72 flex-shrink-0 p-2 border-r font-medium text-sm bg-muted/50">
              Attività
            </div>
            <div className="flex-1 flex">
              {weeks.map((week, i) => (
                <div 
                  key={i} 
                  className="text-center text-xs font-medium border-r bg-muted/50 py-1"
                  style={{ width: `${(week.days.length / dateRange.length) * 100}%` }}
                >
                  {format(week.start, 'dd MMM', { locale: it })}
                </div>
              ))}
            </div>
          </div>

          {/* Header - Days */}
          <div className="flex border-b">
            <div className="w-72 flex-shrink-0 border-r" />
            <div className="flex-1 flex">
              {dateRange.map((day, i) => (
                <div 
                  key={i}
                  className={`text-center text-xs border-r py-1 ${isWeekend(day) ? 'bg-muted/30' : ''} ${isSameDay(day, new Date()) ? 'bg-primary/10' : ''}`}
                  style={{ width: `${100 / dateRange.length}%` }}
                >
                  {format(day, 'd')}
                </div>
              ))}
            </div>
          </div>

          {/* Tasks */}
          {parentTasks.map(task => {
            const bar = getTaskBar(task)
            const childTasks = tasks.filter(t => t.parent_task_id === task.id)
            const isDragOver = dragOverTaskId === task.id

            return (
              <div key={task.id}>
                {/* Parent Task */}
                <div 
                  className={`flex border-b transition-colors cursor-move ${
                    isDragOver ? 'bg-primary/20 border-primary' : 'hover:bg-muted/30'
                  } ${draggedTask?.id === task.id ? 'opacity-50' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, task)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, task)}
                >
                  <div className="w-72 flex-shrink-0 p-2 border-r flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{task.name}</div>
                      <Badge variant="outline" className="text-xs mt-1">
                        {task.progress_percentage}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex-1 relative h-12">
                    {/* Grid */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {dateRange.map((day, i) => (
                        <div 
                          key={i}
                          className={`border-r ${isWeekend(day) ? 'bg-muted/30' : ''} ${isSameDay(day, new Date()) ? 'bg-primary/10' : ''}`}
                          style={{ width: `${100 / dateRange.length}%` }}
                        />
                      ))}
                    </div>
                    {/* Bar */}
                    {bar && (
                      <div 
                        className={`absolute top-2 h-8 rounded ${getStatusColor(task.status)} opacity-80 pointer-events-none`}
                        style={{ 
                          left: `${bar.leftPercent}%`, 
                          width: `${bar.widthPercent}%`,
                          minWidth: '4px'
                        }}
                      >
                        {/* Progress */}
                        <div 
                          className="h-full bg-white/30 rounded-l"
                          style={{ width: `${task.progress_percentage}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Child Tasks */}
                {childTasks.map(child => {
                  const childBar = getTaskBar(child)
                  const isChildDragOver = dragOverTaskId === child.id
                  
                  return (
                    <div 
                      key={child.id} 
                      className={`flex border-b bg-muted/10 cursor-move transition-colors ${
                        isChildDragOver ? 'bg-primary/20 border-primary' : 'hover:bg-muted/30'
                      } ${draggedTask?.id === child.id ? 'opacity-50' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, child)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, child)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, child)}
                    >
                      <div className="w-72 flex-shrink-0 p-2 border-r pl-6 flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate text-muted-foreground">↳ {child.name}</div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {child.progress_percentage}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-1 relative h-10">
                        <div className="absolute inset-0 flex pointer-events-none">
                          {dateRange.map((day, i) => (
                            <div 
                              key={i}
                              className={`border-r ${isWeekend(day) ? 'bg-muted/30' : ''}`}
                              style={{ width: `${100 / dateRange.length}%` }}
                            />
                          ))}
                        </div>
                        {childBar && (
                          <div 
                            className={`absolute top-2 h-6 rounded ${getStatusColor(child.status)} opacity-70 pointer-events-none`}
                            style={{ 
                              left: `${childBar.leftPercent}%`, 
                              width: `${childBar.widthPercent}%`,
                              minWidth: '4px'
                            }}
                          >
                            <div 
                              className="h-full bg-white/30 rounded-l"
                              style={{ width: `${child.progress_percentage}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 p-4 border-t text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted-foreground" />
            <span>Da fare</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span>In corso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500" />
            <span>In revisione</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span>Completato</span>
          </div>
          <div className="flex items-center gap-2 ml-auto text-muted-foreground">
            <GripVertical className="h-4 w-4" />
            <span>Trascina per riordinare</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
