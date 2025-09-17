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

interface AddOpportunityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpportunityAdded?: () => void
}

interface Company {
  id: string
  name: string
}

interface Service {
  id: string
  name: string
  unit_price: number
}

export function AddOpportunityDialog({ open, onOpenChange, onOpportunityAdded }: AddOpportunityDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [expectedCloseDate, setExpectedCloseDate] = useState<Date>()
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    company_id: "",
    service_id: "",
    amount: "",
    win_probability: "50",
    status: "in_attesa" as 'in_attesa' | 'acquisita' | 'persa',
    notes: ""
  })

  useEffect(() => {
    if (open) {
      loadCompanies()
      loadServices()
    }
  }, [open])

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_companies')
        .select('id, name')
        .eq('is_active', true)
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
    setFormData(prev => ({ ...prev, service_id: serviceId }))
    
    const selectedService = services.find(s => s.id === serviceId)
    if (selectedService && selectedService.unit_price) {
      setFormData(prev => ({ ...prev, amount: selectedService.unit_price.toString() }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      const opportunityData = {
        user_id: user.id,
        title: formData.title,
        description: formData.description || null,
        company_id: formData.company_id,
        service_id: formData.service_id,
        amount: parseFloat(formData.amount) || 0,
        win_probability: parseInt(formData.win_probability),
        expected_close_date: expectedCloseDate?.toISOString().split('T')[0] || null,
        notes: formData.notes || null,
        status: formData.status
      }

      const { error } = await supabase
        .from('opportunities')
        .insert([opportunityData])

      if (error) throw error

      toast({
        title: "Opportunità creata",
        description: "L'opportunità è stata creata con successo.",
      })
      
      onOpportunityAdded?.()
      resetForm()
    } catch (error: any) {
      console.error('Error creating opportunity:', error)
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante la creazione dell'opportunità.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      company_id: "",
      service_id: "",
      amount: "",
      win_probability: "50",
      status: "in_attesa" as const,
      notes: ""
    })
    setExpectedCloseDate(undefined)
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuova Opportunità</DialogTitle>
          <DialogDescription>
            Inserisci i dati della nuova opportunità di vendita
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titolo Opportunità *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateFormData("title", e.target.value)}
              placeholder="Sviluppo sito web per azienda X"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_id">Cliente *</Label>
              <Select value={formData.company_id} onValueChange={(value) => updateFormData("company_id", value)}>
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
            
            <div className="space-y-2">
              <Label htmlFor="service_id">Servizio *</Label>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valore (€) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => updateFormData("amount", e.target.value)}
                placeholder="5000.00"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="win_probability">Probabilità di Vittoria (%) *</Label>
              <Select value={formData.win_probability} onValueChange={(value) => updateFormData("win_probability", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10% - Molto bassa</SelectItem>
                  <SelectItem value="25">25% - Bassa</SelectItem>
                  <SelectItem value="50">50% - Media</SelectItem>
                  <SelectItem value="75">75% - Alta</SelectItem>
                  <SelectItem value="90">90% - Molto alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Stato Iniziale</Label>
            <Select value={formData.status} onValueChange={(value: 'in_attesa' | 'acquisita' | 'persa') => updateFormData("status", value)}>
              <SelectTrigger className="bg-background border border-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border border-input shadow-lg z-50">
                <SelectItem value="in_attesa" className="hover:bg-accent">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    In Attesa
                  </div>
                </SelectItem>
                <SelectItem value="acquisita" className="hover:bg-accent">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Acquisita
                  </div>
                </SelectItem>
                <SelectItem value="persa" className="hover:bg-accent">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                    Persa
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data Chiusura Prevista</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expectedCloseDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expectedCloseDate ? format(expectedCloseDate, "dd/MM/yyyy") : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData("description", e.target.value)}
              placeholder="Descrizione dettagliata dell'opportunità..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormData("notes", e.target.value)}
              placeholder="Note aggiuntive, contatti, stato trattativa..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creazione..." : "Crea Opportunità"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}