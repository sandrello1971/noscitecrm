import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { format, differenceInDays, addDays, startOfWeek, eachDayOfInterval, isWeekend, isSameDay, isWithinInterval } from "date-fns"
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
}

interface ProjectGanttTabProps {
  projectId: string
}

export function ProjectGanttTab({ projectId }: ProjectGanttTabProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadTasks()
  }, [projectId])

  const loadTasks = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('crm_project_tasks')
        .select('id, name, status, planned_start_date, planned_end_date, start_date, end_date, progress_percentage, parent_task_id')
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagramma di Gantt</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Header - Weeks */}
          <div className="flex border-b sticky top-0 bg-background z-10">
            <div className="w-64 flex-shrink-0 p-2 border-r font-medium text-sm bg-muted/50">
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
            <div className="w-64 flex-shrink-0 border-r" />
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
          {tasks.filter(t => !t.parent_task_id).map(task => {
            const bar = getTaskBar(task)
            const childTasks = tasks.filter(t => t.parent_task_id === task.id)

            return (
              <div key={task.id}>
                {/* Parent Task */}
                <div className="flex border-b hover:bg-muted/30">
                  <div className="w-64 flex-shrink-0 p-2 border-r">
                    <div className="font-medium text-sm truncate">{task.name}</div>
                    <Badge variant="outline" className="text-xs mt-1">
                      {task.progress_percentage}%
                    </Badge>
                  </div>
                  <div className="flex-1 relative h-12">
                    {/* Grid */}
                    <div className="absolute inset-0 flex">
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
                        className={`absolute top-2 h-8 rounded ${getStatusColor(task.status)} opacity-80`}
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
                  return (
                    <div key={child.id} className="flex border-b hover:bg-muted/30 bg-muted/10">
                      <div className="w-64 flex-shrink-0 p-2 border-r pl-6">
                        <div className="text-sm truncate text-muted-foreground">↳ {child.name}</div>
                        <Badge variant="outline" className="text-xs mt-1">
                          {child.progress_percentage}%
                        </Badge>
                      </div>
                      <div className="flex-1 relative h-10">
                        <div className="absolute inset-0 flex">
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
        <div className="flex gap-4 p-4 border-t text-sm">
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
        </div>
      </CardContent>
    </Card>
  )
}
