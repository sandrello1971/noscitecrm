import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface EditOpportunityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpportunityUpdated: () => void
  opportunity: {
    id: string
    title: string
    description?: string
    amount: number
    win_probability: number
    status: string
    expected_close_date?: string
    notes?: string
    company_id?: string
    service_id?: string
  } | null
}

interface Company {
  id: string
  name: string
}

interface Service {
  id: string
  name: string
  unit_price?: number
}

export function EditOpportunityDialog({ 
  open, 
  onOpenChange, 
  onOpportunityUpdated, 
  opportunity 
}: EditOpportunityDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    company_id: '',
    service_id: '',
    amount: '',
    win_probability: '50',
    status: 'in_attesa',
    notes: ''
  })
  const [expectedCloseDate, setExpectedCloseDate] = useState<Date>()
  const [companies, setCompanies] = useState<Company[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && opportunity) {
      setFormData({
        title: opportunity.title || '',
        description: opportunity.description || '',
        company_id: opportunity.company_id || '',
        service_id: opportunity.service_id || '',
        amount: opportunity.amount?.toString() || '',
        win_probability: opportunity.win_probability?.toString() || '50',
        status: opportunity.status || 'in_attesa',
        notes: opportunity.notes || ''
      })
      setExpectedCloseDate(
        opportunity.expected_close_date ? new Date(opportunity.expected_close_date) : undefined
      )
      loadCompanies()
      loadServices()
    }
  }, [open, opportunity])

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')

      if (error) throw error
      setCompanies(data || [])
    } catch (error) {
      console.error('Error loading companies:', error)
    }
  }

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_services')
        .select('id, name, unit_price')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('Error loading services:', error)
    }
  }

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    setFormData(prev => ({
      ...prev,
      service_id: serviceId,
      amount: service?.unit_price?.toString() || prev.amount
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opportunity) return

    if (!formData.title.trim() || !formData.company_id || !formData.service_id || !formData.amount) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('opportunities')
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          company_id: formData.company_id,
          service_id: formData.service_id,
          amount: parseFloat(formData.amount),
          win_probability: parseInt(formData.win_probability),
          status: formData.status as 'in_attesa' | 'acquisita' | 'persa',
          expected_close_date: expectedCloseDate?.toISOString().split('T')[0] || null,
          notes: formData.notes.trim() || null
        })
        .eq('id', opportunity.id)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Opportunità aggiornata con successo"
      })

      onOpportunityUpdated()
    } catch (error: any) {
      console.error('Error updating opportunity:', error)
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento dell'opportunità",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!opportunity) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Opportunità</DialogTitle>
          <DialogDescription>
            Modifica i dettagli dell'opportunità di vendita
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titolo *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateFormData('title', e.target.value)}
                placeholder="Es. Sviluppo sito web aziendale"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Cliente *</Label>
              <Select value={formData.company_id} onValueChange={(value) => updateFormData('company_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              placeholder="Descrizione dettagliata dell'opportunità..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service">Servizio *</Label>
              <Select value={formData.service_id} onValueChange={handleServiceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un servizio" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valore (€) *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => updateFormData('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="probability">Probabilità di successo (%)</Label>
              <Select value={formData.win_probability} onValueChange={(value) => updateFormData('win_probability', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((prob) => (
                    <SelectItem key={prob} value={prob.toString()}>
                      {prob}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => updateFormData('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_attesa">In Attesa</SelectItem>
                  <SelectItem value="acquisita">Acquisita</SelectItem>
                  <SelectItem value="persa">Persa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data di chiusura prevista</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expectedCloseDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expectedCloseDate ? format(expectedCloseDate, "dd/MM/yyyy") : "Seleziona una data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expectedCloseDate}
                  onSelect={setExpectedCloseDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormData('notes', e.target.value)}
              placeholder="Note aggiuntive..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Aggiornamento..." : "Aggiorna Opportunità"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}