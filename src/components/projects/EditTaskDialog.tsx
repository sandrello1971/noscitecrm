import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Link2, Trash2, Plus, ArrowRight } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface Task {
  id: string
  name: string
  description?: string
  status: string
  priority: string
  assigned_to_company_id?: string
  assigned_to_group?: string
  estimated_hours: number
  actual_hours: number
  progress_percentage: number
  planned_start_date?: string
  planned_end_date?: string
  start_date?: string
  end_date?: string
  project_id?: string
}

interface Dependency {
  id: string
  predecessor_task_id: string
  successor_task_id: string
  dependency_type: string
  lag_days: number
  task_name?: string
}

interface EditTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  onTaskUpdated?: () => void
}

const DEPENDENCY_TYPES = [
  { value: 'FS', label: 'Fine → Inizio (FS)' },
  { value: 'SS', label: 'Inizio → Inizio (SS)' },
  { value: 'FF', label: 'Fine → Fine (FF)' },
  { value: 'SF', label: 'Inizio → Fine (SF)' },
]

export function EditTaskDialog({ open, onOpenChange, task, onTaskUpdated }: EditTaskDialogProps) {
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [allTasks, setAllTasks] = useState<{ id: string; name: string }[]>([])
  const [predecessors, setPredecessors] = useState<Dependency[]>([])
  const [successors, setSuccessors] = useState<Dependency[]>([])
  const [showAddDependency, setShowAddDependency] = useState(false)
  const [newDep, setNewDep] = useState({ taskId: '', type: 'FS', lag: 0, direction: 'predecessor' as 'predecessor' | 'successor' })
  const [formData, setFormData] = useState({
    name: task.name,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    assigned_to_company_id: task.assigned_to_company_id || '',
    assigned_to_group: task.assigned_to_group || '',
    estimated_hours: task.estimated_hours,
    actual_hours: task.actual_hours,
    progress_percentage: task.progress_percentage,
    planned_start_date: task.planned_start_date ? new Date(task.planned_start_date) : undefined,
    planned_end_date: task.planned_end_date ? new Date(task.planned_end_date) : undefined,
    start_date: task.start_date ? new Date(task.start_date) : undefined,
    end_date: task.end_date ? new Date(task.end_date) : undefined
  })
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadCompanies()
      loadDependencies()
      loadAllTasks()
      setShowAddDependency(false)
      setNewDep({ taskId: '', type: 'FS', lag: 0, direction: 'predecessor' })
      setFormData({
        name: task.name,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        assigned_to_company_id: task.assigned_to_company_id || '',
        assigned_to_group: task.assigned_to_group || '',
        estimated_hours: task.estimated_hours,
        actual_hours: task.actual_hours,
        progress_percentage: task.progress_percentage,
        planned_start_date: task.planned_start_date ? new Date(task.planned_start_date) : undefined,
        planned_end_date: task.planned_end_date ? new Date(task.planned_end_date) : undefined,
        start_date: task.start_date ? new Date(task.start_date) : undefined,
        end_date: task.end_date ? new Date(task.end_date) : undefined
      })
    }
  }, [open, task])

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('crm_companies')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setCompanies(data || [])
  }

  const loadAllTasks = async () => {
    if (!task.project_id) {
      // Get project_id from task
      const { data: taskData } = await supabase
        .from('crm_project_tasks')
        .select('project_id')
        .eq('id', task.id)
        .single()
      
      if (taskData?.project_id) {
        const { data } = await supabase
          .from('crm_project_tasks')
          .select('id, name')
          .eq('project_id', taskData.project_id)
          .neq('id', task.id)
          .order('name')
        setAllTasks(data || [])
      }
    } else {
      const { data } = await supabase
        .from('crm_project_tasks')
        .select('id, name')
        .eq('project_id', task.project_id)
        .neq('id', task.id)
        .order('name')
      setAllTasks(data || [])
    }
  }

  const loadDependencies = async () => {
    // Load predecessors (tasks that must complete before this task)
    const { data: predData } = await supabase
      .from('crm_task_dependencies')
      .select('id, predecessor_task_id, successor_task_id, dependency_type, lag_days')
      .eq('successor_task_id', task.id)

    if (predData) {
      const predsWithNames = await Promise.all(predData.map(async (dep) => {
        const { data: taskData } = await supabase
          .from('crm_project_tasks')
          .select('name')
          .eq('id', dep.predecessor_task_id)
          .single()
        return { ...dep, task_name: taskData?.name || 'Sconosciuto' }
      }))
      setPredecessors(predsWithNames)
    }

    // Load successors (tasks that depend on this task)
    const { data: succData } = await supabase
      .from('crm_task_dependencies')
      .select('id, predecessor_task_id, successor_task_id, dependency_type, lag_days')
      .eq('predecessor_task_id', task.id)

    if (succData) {
      const succsWithNames = await Promise.all(succData.map(async (dep) => {
        const { data: taskData } = await supabase
          .from('crm_project_tasks')
          .select('name')
          .eq('id', dep.successor_task_id)
          .single()
        return { ...dep, task_name: taskData?.name || 'Sconosciuto' }
      }))
      setSuccessors(succsWithNames)
    }
  }

  const addDependency = async () => {
    if (!newDep.taskId) {
      toast({ title: "Errore", description: "Seleziona un'attività", variant: "destructive" })
      return
    }

    try {
      const { data: user } = await supabase.auth.getUser()
      
      const depData = newDep.direction === 'predecessor' 
        ? { predecessor_task_id: newDep.taskId, successor_task_id: task.id }
        : { predecessor_task_id: task.id, successor_task_id: newDep.taskId }

      const { error } = await supabase
        .from('crm_task_dependencies')
        .insert({
          ...depData,
          dependency_type: newDep.type,
          lag_days: newDep.lag,
          user_id: user.user!.id
        })

      if (error) {
        if (error.code === '23505') throw new Error('Questa dipendenza esiste già')
        throw error
      }

      toast({ title: "Dipendenza aggiunta" })
      loadDependencies()
      setShowAddDependency(false)
      setNewDep({ taskId: '', type: 'FS', lag: 0, direction: 'predecessor' })
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" })
    }
  }

  const deleteDependency = async (depId: string) => {
    try {
      const { error } = await supabase
        .from('crm_task_dependencies')
        .delete()
        .eq('id', depId)

      if (error) throw error
      
      toast({ title: "Dipendenza eliminata" })
      loadDependencies()
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast({
        title: "Errore",
        description: "Il nome è obbligatorio",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('crm_project_tasks')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          status: formData.status,
          priority: formData.priority,
          assigned_to_company_id: formData.assigned_to_company_id || null,
          assigned_to_group: formData.assigned_to_group.trim() || null,
          estimated_hours: formData.estimated_hours || 0,
          actual_hours: formData.actual_hours || 0,
          progress_percentage: formData.progress_percentage || 0,
          planned_start_date: formData.planned_start_date?.toISOString().split('T')[0] || null,
          planned_end_date: formData.planned_end_date?.toISOString().split('T')[0] || null,
          start_date: formData.start_date?.toISOString().split('T')[0] || null,
          end_date: formData.end_date?.toISOString().split('T')[0] || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Attività aggiornata con successo"
      })
      onOpenChange(false)
      onTaskUpdated?.()
    } catch (error: any) {
      console.error('Error updating task:', error)
      toast({
        title: "Errore",
        description: `Impossibile aggiornare l'attività: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getTypeLabel = (type: string) => DEPENDENCY_TYPES.find(t => t.value === type)?.label || type

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Attività</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Da fare</SelectItem>
                  <SelectItem value="in_progress">In corso</SelectItem>
                  <SelectItem value="review">In revisione</SelectItem>
                  <SelectItem value="completed">Completata</SelectItem>
                  <SelectItem value="cancelled">Annullata</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorità</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Bassa</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assegna a Azienda</Label>
              <Select 
                value={formData.assigned_to_company_id || "__none__"} 
                onValueChange={(v) => setFormData({ ...formData, assigned_to_company_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nessuna</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group">Oppure a Gruppo</Label>
              <Input
                id="group"
                value={formData.assigned_to_group}
                onChange={(e) => setFormData({ ...formData, assigned_to_group: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated">Ore Stimate</Label>
              <Input
                id="estimated"
                type="number"
                min={0}
                step={0.5}
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual">Ore Effettive</Label>
              <Input
                id="actual"
                type="number"
                min={0}
                step={0.5}
                value={formData.actual_hours}
                onChange={(e) => setFormData({ ...formData, actual_hours: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="progress">Progresso %</Label>
              <Input
                id="progress"
                type="number"
                min={0}
                max={100}
                value={formData.progress_percentage}
                onChange={(e) => setFormData({ ...formData, progress_percentage: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Inizio Pianificato</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.planned_start_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.planned_start_date ? format(formData.planned_start_date, 'dd/MM/yyyy') : 'Seleziona'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.planned_start_date}
                    onSelect={(d) => setFormData({ ...formData, planned_start_date: d })}
                    locale={it}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Fine Pianificata</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.planned_end_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.planned_end_date ? format(formData.planned_end_date, 'dd/MM/yyyy') : 'Seleziona'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.planned_end_date}
                    onSelect={(d) => setFormData({ ...formData, planned_end_date: d })}
                    locale={it}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Inizio Effettivo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.start_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date ? format(formData.start_date, 'dd/MM/yyyy') : 'Seleziona'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.start_date}
                    onSelect={(d) => setFormData({ ...formData, start_date: d })}
                    locale={it}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Fine Effettiva</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.end_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.end_date ? format(formData.end_date, 'dd/MM/yyyy') : 'Seleziona'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.end_date}
                    onSelect={(d) => setFormData({ ...formData, end_date: d })}
                    locale={it}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Dependencies Section */}
          <Separator className="my-4" />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Dipendenze
              </Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddDependency(!showAddDependency)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi
              </Button>
            </div>

            {showAddDependency && (
              <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Direzione</Label>
                    <Select value={newDep.direction} onValueChange={(v: 'predecessor' | 'successor') => setNewDep({ ...newDep, direction: v })}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="predecessor">Predecessore</SelectItem>
                        <SelectItem value="successor">Successore</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={newDep.type} onValueChange={(v) => setNewDep({ ...newDep, type: v })}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPENDENCY_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Attività</Label>
                    <Select value={newDep.taskId} onValueChange={(v) => setNewDep({ ...newDep, taskId: v })}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Seleziona attività" />
                      </SelectTrigger>
                      <SelectContent>
                        {allTasks.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lag (giorni)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={newDep.lag}
                      onChange={(e) => setNewDep({ ...newDep, lag: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddDependency(false)}>
                    Annulla
                  </Button>
                  <Button type="button" size="sm" onClick={addDependency}>
                    Aggiungi
                  </Button>
                </div>
              </div>
            )}

            {/* Predecessors */}
            {predecessors.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Predecessori (devono completarsi prima)</Label>
                {predecessors.map(dep => (
                  <div key={dep.id} className="flex items-center justify-between p-2 border rounded bg-background">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{dep.task_name}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="secondary" className="text-xs">{getTypeLabel(dep.dependency_type)}</Badge>
                      {dep.lag_days !== 0 && (
                        <Badge variant="outline" className="text-xs">
                          {dep.lag_days > 0 ? `+${dep.lag_days}` : dep.lag_days}g
                        </Badge>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteDependency(dep.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Successors */}
            {successors.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Successori (dipendono da questa)</Label>
                {successors.map(dep => (
                  <div key={dep.id} className="flex items-center justify-between p-2 border rounded bg-background">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="text-xs">{getTypeLabel(dep.dependency_type)}</Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{dep.task_name}</span>
                      {dep.lag_days !== 0 && (
                        <Badge variant="outline" className="text-xs">
                          {dep.lag_days > 0 ? `+${dep.lag_days}` : dep.lag_days}g
                        </Badge>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteDependency(dep.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {predecessors.length === 0 && successors.length === 0 && !showAddDependency && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nessuna dipendenza configurata
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvataggio...' : 'Salva'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
