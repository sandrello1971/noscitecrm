import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GripVertical, Link2, Trash2, Plus } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { format, differenceInDays, addDays, startOfWeek, eachDayOfInterval, isWeekend, isSameDay } from "date-fns"
import { it } from "date-fns/locale"
import { AddDependencyDialog } from "./AddDependencyDialog"
import { DependencyLines } from "./DependencyLines"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

interface Dependency {
  id: string
  predecessor_task_id: string
  successor_task_id: string
  dependency_type: 'FS' | 'SS' | 'FF' | 'SF'
  lag_days: number
  predecessor_task?: { name: string }
  successor_task?: { name: string }
}

interface ProjectGanttTabProps {
  projectId: string
}

const DEPENDENCY_TYPE_LABELS: Record<string, string> = {
  'FS': 'Fine → Inizio',
  'SS': 'Inizio → Inizio', 
  'FF': 'Fine → Fine',
  'SF': 'Inizio → Fine'
}

export function ProjectGanttTab({ projectId }: ProjectGanttTabProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [addDependencyOpen, setAddDependencyOpen] = useState(false)
  const [selectedTaskForDependency, setSelectedTaskForDependency] = useState<string | undefined>()
  const [taskPositions, setTaskPositions] = useState<Map<string, { top: number; left: number; right: number; height: number }>>(new Map())
  const ganttContainerRef = useRef<HTMLDivElement>(null)
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('crm_project_tasks')
        .select('id, name, status, planned_start_date, planned_end_date, start_date, end_date, progress_percentage, parent_task_id, sort_order')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })

      if (tasksError) throw tasksError
      setTasks(tasksData || [])

      // Load dependencies
      const taskIds = (tasksData || []).map(t => t.id)
      if (taskIds.length > 0) {
        const { data: depsData, error: depsError } = await supabase
          .from('crm_task_dependencies')
          .select(`
            id,
            predecessor_task_id,
            successor_task_id,
            dependency_type,
            lag_days
          `)
          .or(`predecessor_task_id.in.(${taskIds.join(',')}),successor_task_id.in.(${taskIds.join(',')})`)

        if (depsError) throw depsError
        setDependencies((depsData || []) as Dependency[])
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Calculate task bar positions after render
  const updateTaskPositions = useCallback(() => {
    if (!ganttContainerRef.current) return
    
    const containerRect = ganttContainerRef.current.getBoundingClientRect()
    const positions = new Map<string, { top: number; left: number; right: number; height: number }>()
    
    taskRefs.current.forEach((element, taskId) => {
      if (element) {
        const rect = element.getBoundingClientRect()
        positions.set(taskId, {
          top: rect.top - containerRect.top,
          left: rect.left - containerRect.left,
          right: rect.right - containerRect.left,
          height: rect.height
        })
      }
    })
    
    setTaskPositions(positions)
  }, [])

  useEffect(() => {
    // Update positions after tasks are rendered
    const timer = setTimeout(updateTaskPositions, 100)
    return () => clearTimeout(timer)
  }, [tasks, updateTaskPositions])

  useEffect(() => {
    window.addEventListener('resize', updateTaskPositions)
    return () => window.removeEventListener('resize', updateTaskPositions)
  }, [updateTaskPositions])

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
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

    const siblingTasks = tasks.filter(t => t.parent_task_id === draggedTask.parent_task_id)
    const draggedIndex = siblingTasks.findIndex(t => t.id === draggedTask.id)
    const targetIndex = siblingTasks.findIndex(t => t.id === targetTask.id)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newSiblings = [...siblingTasks]
    newSiblings.splice(draggedIndex, 1)
    newSiblings.splice(targetIndex, 0, draggedTask)

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
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'ordine",
        variant: "destructive"
      })
      loadData()
    }
  }

  const deleteDependency = async (depId: string) => {
    try {
      const { error } = await supabase
        .from('crm_task_dependencies')
        .delete()
        .eq('id', depId)

      if (error) throw error

      setDependencies(prev => prev.filter(d => d.id !== depId))
      toast({
        title: "Dipendenza eliminata",
        description: "La dipendenza è stata rimossa"
      })
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la dipendenza",
        variant: "destructive"
      })
    }
  }

  const openAddDependency = (taskId?: string) => {
    setSelectedTaskForDependency(taskId)
    setAddDependencyOpen(true)
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

  const getTaskDependencies = (taskId: string) => {
    const predecessors = dependencies.filter(d => d.successor_task_id === taskId)
    const successors = dependencies.filter(d => d.predecessor_task_id === taskId)
    return { predecessors, successors }
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
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Diagramma di Gantt</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openAddDependency()}>
                <Link2 className="h-4 w-4 mr-1" />
                Aggiungi Dipendenza
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[1000px] relative" ref={ganttContainerRef}>
            {/* Dependency Lines */}
            <DependencyLines
              tasks={tasks}
              dependencies={dependencies}
              taskPositions={taskPositions}
              startDate={startDate}
              endDate={endDate}
              dateRange={dateRange}
            />

            {/* Header - Weeks */}
            <div className="flex border-b sticky top-0 bg-background z-10">
              <div className="w-80 flex-shrink-0 p-2 border-r font-medium text-sm bg-muted/50">
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
              <div className="w-80 flex-shrink-0 border-r" />
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
              const { predecessors, successors } = getTaskDependencies(task.id)
              const hasDependencies = predecessors.length > 0 || successors.length > 0

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
                    <div className="w-80 flex-shrink-0 p-2 border-r flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{task.name}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {task.progress_percentage}%
                          </Badge>
                          {hasDependencies && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-5 px-1">
                                  <Link2 className="h-3 w-3 text-primary" />
                                  <span className="text-xs ml-1">{predecessors.length + successors.length}</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-64">
                                {predecessors.length > 0 && (
                                  <>
                                    <DropdownMenuLabel className="text-xs">Predecessori</DropdownMenuLabel>
                                    {predecessors.map(dep => {
                                      const predTask = tasks.find(t => t.id === dep.predecessor_task_id)
                                      return (
                                        <DropdownMenuItem key={dep.id} className="flex justify-between">
                                          <span className="text-xs truncate flex-1">
                                            {predTask?.name} ({DEPENDENCY_TYPE_LABELS[dep.dependency_type]})
                                            {dep.lag_days !== 0 && ` ${dep.lag_days > 0 ? '+' : ''}${dep.lag_days}g`}
                                          </span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0 ml-2"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              deleteDependency(dep.id)
                                            }}
                                          >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </DropdownMenuItem>
                                      )
                                    })}
                                  </>
                                )}
                                {successors.length > 0 && (
                                  <>
                                    {predecessors.length > 0 && <DropdownMenuSeparator />}
                                    <DropdownMenuLabel className="text-xs">Successori</DropdownMenuLabel>
                                    {successors.map(dep => {
                                      const succTask = tasks.find(t => t.id === dep.successor_task_id)
                                      return (
                                        <DropdownMenuItem key={dep.id} className="flex justify-between">
                                          <span className="text-xs truncate flex-1">
                                            {succTask?.name} ({DEPENDENCY_TYPE_LABELS[dep.dependency_type]})
                                            {dep.lag_days !== 0 && ` ${dep.lag_days > 0 ? '+' : ''}${dep.lag_days}g`}
                                          </span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0 ml-2"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              deleteDependency(dep.id)
                                            }}
                                          >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </DropdownMenuItem>
                                      )
                                    })}
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openAddDependency(task.id)}>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Aggiungi dipendenza
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                      {!hasDependencies && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => openAddDependency(task.id)}
                            >
                              <Link2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Aggiungi dipendenza</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex-1 relative h-12">
                      <div className="absolute inset-0 flex pointer-events-none">
                        {dateRange.map((day, i) => (
                          <div 
                            key={i}
                            className={`border-r ${isWeekend(day) ? 'bg-muted/30' : ''} ${isSameDay(day, new Date()) ? 'bg-primary/10' : ''}`}
                            style={{ width: `${100 / dateRange.length}%` }}
                          />
                        ))}
                      </div>
                      {bar && (
                        <div 
                          ref={(el) => {
                            if (el) taskRefs.current.set(task.id, el)
                          }}
                          className={`absolute top-2 h-8 rounded ${getStatusColor(task.status)} opacity-80`}
                          style={{ 
                            left: `${bar.leftPercent}%`, 
                            width: `${bar.widthPercent}%`,
                            minWidth: '4px'
                          }}
                        >
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
                    const childDeps = getTaskDependencies(child.id)
                    const childHasDeps = childDeps.predecessors.length > 0 || childDeps.successors.length > 0
                    
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
                        <div className="w-80 flex-shrink-0 p-2 border-r pl-6 flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate text-muted-foreground">↳ {child.name}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {child.progress_percentage}%
                              </Badge>
                              {childHasDeps && (
                                <Badge variant="secondary" className="text-xs">
                                  <Link2 className="h-3 w-3 mr-1" />
                                  {childDeps.predecessors.length + childDeps.successors.length}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => openAddDependency(child.id)}
                              >
                                <Link2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Aggiungi dipendenza</TooltipContent>
                          </Tooltip>
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
                              ref={(el) => {
                                if (el) taskRefs.current.set(child.id, el)
                              }}
                              className={`absolute top-2 h-6 rounded ${getStatusColor(child.status)} opacity-70`}
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
            <div className="flex items-center gap-2 border-l pl-4">
              <Link2 className="h-4 w-4 text-primary" />
              <span>Dipendenza</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }} />
              <span>Con ritardo/anticipo</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddDependencyDialog
        open={addDependencyOpen}
        onOpenChange={setAddDependencyOpen}
        projectId={projectId}
        tasks={tasks}
        preselectedSuccessorId={selectedTaskForDependency}
        onDependencyAdded={loadData}
      />
    </TooltipProvider>
  )
}
