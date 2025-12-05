import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, CalendarIcon, Clock, Check, X, DollarSign } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface Timesheet {
  id: string
  project_id: string
  task_id?: string
  work_date: string
  hours: number
  activity_type: string
  hourly_rate: number
  total_cost: number
  description?: string
  notes?: string
  status: 'pending' | 'approved' | 'rejected'
  task_name?: string
}

interface Task {
  id: string
  name: string
}

interface ProjectTimesheetsTabProps {
  projectId: string
}

const ACTIVITY_TYPES = [
  { value: 'development', label: 'Sviluppo' },
  { value: 'design', label: 'Design' },
  { value: 'analysis', label: 'Analisi' },
  { value: 'testing', label: 'Testing' },
  { value: 'meeting', label: 'Riunione' },
  { value: 'documentation', label: 'Documentazione' },
  { value: 'support', label: 'Supporto' },
  { value: 'management', label: 'Gestione' },
  { value: 'other', label: 'Altro' }
]

export function ProjectTimesheetsTab({ projectId }: ProjectTimesheetsTabProps) {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [formData, setFormData] = useState({
    task_id: '',
    work_date: new Date(),
    hours: 1,
    activity_type: 'development',
    hourly_rate: 50,
    description: '',
    notes: ''
  })
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [timesheetsRes, tasksRes] = await Promise.all([
        supabase
          .from('crm_project_timesheets')
          .select(`*, crm_project_tasks(name)`)
          .eq('project_id', projectId)
          .order('work_date', { ascending: false }),
        supabase
          .from('crm_project_tasks')
          .select('id, name')
          .eq('project_id', projectId)
          .order('name')
      ])

      if (timesheetsRes.error) throw timesheetsRes.error
      if (tasksRes.error) throw tasksRes.error

      setTimesheets(timesheetsRes.data?.map(t => ({
        ...t,
        status: t.status as Timesheet['status'],
        task_name: t.crm_project_tasks?.name
      })) || [])
      setTasks(tasksRes.data || [])
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i timesheet",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: user } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('crm_project_timesheets')
        .insert({
          project_id: projectId,
          task_id: formData.task_id || null,
          user_id: user.user!.id,
          work_date: formData.work_date.toISOString().split('T')[0],
          hours: formData.hours,
          activity_type: formData.activity_type,
          hourly_rate: formData.hourly_rate,
          description: formData.description.trim() || null,
          notes: formData.notes.trim() || null,
          status: 'pending'
        })

      if (error) throw error

      toast({
        title: "Successo",
        description: "Timesheet registrato"
      })
      setShowAddDialog(false)
      setFormData({
        task_id: '',
        work_date: new Date(),
        hours: 1,
        activity_type: 'development',
        hourly_rate: 50,
        description: '',
        notes: ''
      })
      loadData()
    } catch (error: any) {
      toast({
        title: "Errore",
        description: `Impossibile salvare il timesheet: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600"><Check className="w-3 h-3 mr-1" />Approvato</Badge>
      case 'rejected':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Rifiutato</Badge>
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />In attesa</Badge>
    }
  }

  const getActivityLabel = (type: string) => {
    return ACTIVITY_TYPES.find(t => t.value === type)?.label || type
  }

  // Stats
  const totalHours = timesheets.reduce((sum, t) => sum + t.hours, 0)
  const totalCost = timesheets.reduce((sum, t) => sum + t.total_cost, 0)
  const approvedHours = timesheets.filter(t => t.status === 'approved').reduce((sum, t) => sum + t.hours, 0)

  if (loading) {
    return <div className="p-4">Caricamento timesheet...</div>
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ore Totali</span>
            </div>
            <div className="text-2xl font-bold mt-1">{totalHours}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ore Approvate</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-green-600">{approvedHours}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Costo Totale</span>
            </div>
            <div className="text-2xl font-bold mt-1">€{totalCost.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Registrazioni Timesheet</CardTitle>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuova Registrazione
          </Button>
        </CardHeader>
        <CardContent>
          {timesheets.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nessuna registrazione. Clicca "Nuova Registrazione" per iniziare.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Attività</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ore</TableHead>
                  <TableHead className="text-right">Tariffa</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheets.map(ts => (
                  <TableRow key={ts.id}>
                    <TableCell>{format(new Date(ts.work_date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{ts.task_name || 'Generale'}</div>
                        {ts.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {ts.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getActivityLabel(ts.activity_type)}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{ts.hours}h</TableCell>
                    <TableCell className="text-right">€{ts.hourly_rate}/h</TableCell>
                    <TableCell className="text-right font-medium">€{ts.total_cost.toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(ts.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuova Registrazione Timesheet</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Data Lavoro *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.work_date, 'dd/MM/yyyy', { locale: it })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.work_date}
                    onSelect={(d) => d && setFormData({ ...formData, work_date: d })}
                    locale={it}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Attività (opzionale)</Label>
              <Select value={formData.task_id} onValueChange={(v) => setFormData({ ...formData, task_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona attività" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Generale (nessuna attività)</SelectItem>
                  {tasks.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo Attività *</Label>
                <Select value={formData.activity_type} onValueChange={(v) => setFormData({ ...formData, activity_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hours">Ore *</Label>
                <Input
                  id="hours"
                  type="number"
                  min={0.5}
                  max={24}
                  step={0.5}
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Tariffa Oraria (€)</Label>
              <Input
                id="rate"
                type="number"
                min={0}
                step={1}
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrizione del lavoro svolto"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Note</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Note aggiuntive"
                rows={2}
              />
            </div>

            <div className="bg-muted/50 p-3 rounded">
              <div className="flex justify-between text-sm">
                <span>Costo stimato:</span>
                <span className="font-bold">€{(formData.hours * formData.hourly_rate).toLocaleString()}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Annulla
              </Button>
              <Button type="submit">Registra</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
