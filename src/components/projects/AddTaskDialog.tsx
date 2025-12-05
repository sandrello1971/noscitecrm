import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  parentTaskId?: string
  onTaskAdded?: () => void
}

export function AddTaskDialog({ open, onOpenChange, projectId, parentTaskId, onTaskAdded }: AddTaskDialogProps) {
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigned_to_company_id: '',
    assigned_to_group: '',
    estimated_hours: 0,
    planned_start_date: undefined as Date | undefined,
    planned_end_date: undefined as Date | undefined
  })
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadCompanies()
      setFormData({
        name: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        assigned_to_company_id: '',
        assigned_to_group: '',
        estimated_hours: 0,
        planned_start_date: undefined,
        planned_end_date: undefined
      })
    }
  }, [open])

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('crm_companies')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setCompanies(data || [])
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
      const { data: user } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('crm_project_tasks')
        .insert({
          project_id: projectId,
          parent_task_id: parentTaskId || null,
          user_id: user.user!.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          status: formData.status,
          priority: formData.priority,
          assigned_to_company_id: formData.assigned_to_company_id || null,
          assigned_to_group: formData.assigned_to_group.trim() || null,
          estimated_hours: formData.estimated_hours || 0,
          planned_start_date: formData.planned_start_date?.toISOString().split('T')[0] || null,
          planned_end_date: formData.planned_end_date?.toISOString().split('T')[0] || null
        })

      if (error) throw error

      toast({
        title: "Successo",
        description: "Attività creata con successo"
      })
      onOpenChange(false)
      onTaskAdded?.()
    } catch (error: any) {
      console.error('Error creating task:', error)
      toast({
        title: "Errore",
        description: `Impossibile creare l'attività: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {parentTaskId ? 'Nuova Sotto-Attività' : 'Nuova Attività'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome attività"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrizione dell'attività"
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
                value={formData.assigned_to_company_id} 
                onValueChange={(v) => setFormData({ ...formData, assigned_to_company_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona azienda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessuna</SelectItem>
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
                placeholder="Nome gruppo/team"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Ore Stimate</Label>
            <Input
              id="hours"
              type="number"
              min={0}
              step={0.5}
              value={formData.estimated_hours}
              onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Inizio Pianificata</Label>
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
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Fine Pianificata</Label>
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
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creazione...' : 'Crea Attività'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
