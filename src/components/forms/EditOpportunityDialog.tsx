import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Plus, X } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"

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
    user_id?: string
  } | null
}

interface Company {
  id: string
  name: string
}

interface Service {
  id: string
  name: string
  code: string
  unit_price?: number
}

interface OpportunityService {
  id?: string // Per servizi esistenti
  temp_id: string // Per tutti i servizi (esistenti e nuovi)
  service_id: string
  quantity: number
  unit_price: number
  notes: string
  is_new?: boolean // Flag per distinguere servizi nuovi da esistenti
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
    win_probability: '50',
    status: 'in_attesa',
    notes: ''
  })
  const [expectedCloseDate, setExpectedCloseDate] = useState<Date>()
  const [companies, setCompanies] = useState<Company[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [opportunityServices, setOpportunityServices] = useState<OpportunityService[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    if (open && opportunity) {
      // Carica prima companies e services, poi imposta i dati del form
      const loadData = async () => {
        await Promise.all([
          loadCompanies(),
          loadServices(),
          loadOpportunityServices()
        ])
        
        // Imposta i dati del form dopo aver caricato le aziende
        setFormData({
          title: opportunity.title || '',
          description: opportunity.description || '',
          company_id: opportunity.company_id || '',
          win_probability: opportunity.win_probability?.toString() || '50',
          status: opportunity.status || 'in_attesa',
          notes: opportunity.notes || ''
        })
        setExpectedCloseDate(
          opportunity.expected_close_date ? new Date(opportunity.expected_close_date) : undefined
        )
      }
      
      loadData()
    }
  }, [open, opportunity])

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
        .select('id, name, code, unit_price')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('Error loading services:', error)
    }
  }

  const loadOpportunityServices = async () => {
    if (!opportunity?.id) return

    try {
      const { data, error } = await supabase
        .from('opportunity_services')
        .select(`
          *,
          crm_services(name, code)
        `)
        .eq('opportunity_id', opportunity.id)

      if (error) throw error

      const mappedServices = data?.map(service => ({
        id: service.id,
        temp_id: service.id, // Usa l'ID esistente come temp_id
        service_id: service.service_id,
        quantity: service.quantity,
        unit_price: service.unit_price,
        notes: service.notes || '',
        is_new: false
      })) || []

      setOpportunityServices(mappedServices)
    } catch (error) {
      console.error('Error loading opportunity services:', error)
    }
  }

  const addService = () => {
    const newTempId = `new_${Date.now()}`
    setOpportunityServices(prev => [
      ...prev,
      {
        temp_id: newTempId,
        service_id: "",
        quantity: 1,
        unit_price: 0,
        notes: "",
        is_new: true
      }
    ])
  }

  const removeService = (tempId: string) => {
    setOpportunityServices(prev => prev.filter(s => s.temp_id !== tempId))
  }

  const updateService = (tempId: string, field: keyof OpportunityService, value: any) => {
    setOpportunityServices(prev => prev.map(service => {
      if (service.temp_id === tempId) {
        const updatedService = { ...service, [field]: value }
        
        // Se cambio il servizio, aggiorna automaticamente il prezzo unitario
        if (field === 'service_id') {
          const selectedService = services.find(s => s.id === value)
          if (selectedService?.unit_price) {
            updatedService.unit_price = selectedService.unit_price
          }
        }
        
        return updatedService
      }
      return service
    }))
  }

  const calculateTotal = () => {
    return opportunityServices.reduce((total, service) => {
      return total + (service.quantity * service.unit_price)
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opportunity) return

    if (!formData.title.trim() || !formData.company_id) {
      toast({
        title: "Errore",
        description: "Compila i campi obbligatori (Titolo e Cliente)",
        variant: "destructive"
      })
      return
    }

    // Verifica che ci sia almeno un servizio valido
    const validServices = opportunityServices.filter(s => s.service_id && s.quantity > 0)
    if (validServices.length === 0) {
      toast({
        title: "Errore",
        description: "Aggiungi almeno un servizio valido",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      // 1. Aggiorna l'opportunità
      const { error: opportunityError } = await supabase
        .from('opportunities')
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          company_id: formData.company_id,
          amount: calculateTotal(),
          win_probability: parseInt(formData.win_probability),
          status: formData.status as 'in_attesa' | 'acquisita' | 'persa',
          expected_close_date: expectedCloseDate?.toISOString().split('T')[0] || null,
          notes: formData.notes.trim() || null
        })
        .eq('id', opportunity.id)

      if (opportunityError) throw opportunityError

      // 2. Gestisci i servizi
      // Prima elimina tutti i servizi esistenti
      const { error: deleteError } = await supabase
        .from('opportunity_services')
        .delete()
        .eq('opportunity_id', opportunity.id)

      if (deleteError) throw deleteError

      // Poi inserisci tutti i servizi (esistenti e nuovi)
      const servicesToInsert = validServices.map(service => ({
        opportunity_id: opportunity.id,
        service_id: service.service_id,
        quantity: service.quantity,
        unit_price: service.unit_price,
        total_price: service.quantity * service.unit_price,
        notes: service.notes.trim() || null,
        user_id: user?.id || opportunity.user_id
      }))

      const { error: insertError } = await supabase
        .from('opportunity_services')
        .insert(servicesToInsert)

      if (insertError) throw insertError

      toast({
        title: "Successo",
        description: "Opportunità aggiornata con successo"
      })

      onOpportunityUpdated()
      onOpenChange(false)
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
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Opportunità</DialogTitle>
          <DialogDescription>
            Modifica i dettagli dell'opportunità di vendita e i suoi servizi
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Titolo *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateFormData('title', e.target.value)}
              placeholder="Es. Sviluppo sito web aziendale"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Cliente *</Label>
              <Select value={formData.company_id} onValueChange={(value) => updateFormData('company_id', value)}>
                <SelectTrigger>
                  <SelectValue>
                    {formData.company_id 
                      ? companies.find(c => c.id === formData.company_id)?.name 
                      : "Seleziona un cliente"
                    }
                  </SelectValue>
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
              <Label htmlFor="win_probability">Probabilità di Successo (%)</Label>
              <Input
                id="win_probability"
                type="number"
                min="0"
                max="100"
                value={formData.win_probability}
                onChange={(e) => updateFormData('win_probability', e.target.value)}
              />
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

          {/* Sezione Servizi */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base font-medium">Servizi *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addService}>
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi Servizio
              </Button>
            </div>
            
            <div className="space-y-3">
              {opportunityServices.map((service) => (
                <div key={service.temp_id} className="grid grid-cols-12 gap-3 items-end p-3 border rounded-lg">
                  <div className="col-span-5">
                    <Label className="text-sm">Servizio</Label>
                    <Select 
                      value={service.service_id} 
                      onValueChange={(value) => updateService(service.temp_id, "service_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona servizio" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((serviceItem) => (
                          <SelectItem key={serviceItem.id} value={serviceItem.id}>
                            {serviceItem.code} - {serviceItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="col-span-2">
                    <Label className="text-sm">Quantità</Label>
                    <Input
                      type="number"
                      min="1"
                      step="0.001"
                      value={service.quantity}
                      onChange={(e) => updateService(service.temp_id, "quantity", parseFloat(e.target.value) || 1)}
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label className="text-sm">Prezzo Unitario</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={service.unit_price}
                      onChange={(e) => updateService(service.temp_id, "unit_price", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label className="text-sm">Totale</Label>
                    <div className="h-10 px-3 py-2 border rounded-md bg-muted text-sm">
                      €{(service.quantity * service.unit_price).toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeService(service.temp_id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Note del servizio (riga separata) */}
                  <div className="col-span-12">
                    <Label className="text-sm">Note (opzionale)</Label>
                    <Input
                      placeholder="Note specifiche per questo servizio..."
                      value={service.notes}
                      onChange={(e) => updateService(service.temp_id, "notes", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Totale generale */}
            <div className="flex justify-end">
              <div className="text-right">
                <Label className="text-sm text-muted-foreground">Totale Opportunità</Label>
                <div className="text-2xl font-bold">€{calculateTotal().toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormData('notes', e.target.value)}
              placeholder="Note aggiuntive sull'opportunità..."
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
