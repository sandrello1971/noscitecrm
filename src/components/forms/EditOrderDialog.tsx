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

interface EditOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrderUpdated: () => void
  order: {
    id: string
    order_number: string
    title: string
    description?: string
    status: string
    priority: string
    start_date?: string
    end_date?: string
    estimated_hours?: number
    actual_hours?: number
    total_amount?: number
    progress_percentage?: number
    notes?: string
    company_id?: string
    parent_order_id?: string
    assigned_user_id?: string
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

interface OrderService {
  id?: string // Per servizi esistenti
  temp_id: string // Per tutti i servizi (esistenti e nuovi)
  service_id: string
  quantity: number
  unit_price: number
  notes: string
  is_new?: boolean // Flag per distinguere servizi nuovi da esistenti
}

interface ParentOrder {
  id: string
  title: string
  order_number: string
}

export function EditOrderDialog({ 
  open, 
  onOpenChange, 
  onOrderUpdated, 
  order 
}: EditOrderDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    company_id: '',
    parent_order_id: '',
    assigned_user_id: '',
    status: 'draft',
    priority: 'medium',
    estimated_hours: '',
    actual_hours: '',
    progress_percentage: '0',
    notes: ''
  })
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [companies, setCompanies] = useState<Company[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [parentOrders, setParentOrders] = useState<ParentOrder[]>([])
  const [orderServices, setOrderServices] = useState<OrderService[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { isAdmin, user } = useAuth()

  useEffect(() => {
    if (open && order) {
      // Imposta i dati del form
      setFormData({
        title: order.title || '',
        description: order.description || '',
        company_id: order.company_id || '',
        parent_order_id: order.parent_order_id || '',
        assigned_user_id: order.assigned_user_id || '',
        status: order.status || 'draft',
        priority: order.priority || 'medium',
        estimated_hours: order.estimated_hours?.toString() || '',
        actual_hours: order.actual_hours?.toString() || '',
        progress_percentage: order.progress_percentage?.toString() || '0',
        notes: order.notes || ''
      })
      
      setStartDate(order.start_date ? new Date(order.start_date) : undefined)
      setEndDate(order.end_date ? new Date(order.end_date) : undefined)
      
      loadCompanies()
      loadServices()
      loadParentOrders()
      loadOrderServices()
    } else if (open) {
      // Se non c'è un order, inizializza con servizi vuoti
      setOrderServices([])
    }
  }, [open, order])

  const loadCompanies = async () => {
    try {
      let query = supabase
        .from('crm_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (!isAdmin) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) query = query.eq('user_id', user.id)
      }

      const { data, error } = await query
      if (error) throw error
      setCompanies(data || [])
    } catch (error) {
      console.error('Error loading companies:', error)
    }
  }

  const loadServices = async () => {
    try {
      let query = supabase
        .from('crm_services')
        .select('id, name, code, unit_price')
        .eq('is_active', true)
        .order('name')

      if (!isAdmin) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) query = query.eq('user_id', user.id)
      }

      const { data, error } = await query
      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('Error loading services:', error)
    }
  }

  const loadParentOrders = async () => {
    if (!order) return
    
    try {
      let query = supabase
        .from('crm_orders')
        .select('id, title, order_number')
        .neq('id', order.id) // Non includere se stesso
        .order('order_number')

      if (!isAdmin) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) query = query.eq('user_id', user.id)
      }

      const { data, error } = await query
      if (error) throw error
      setParentOrders(data || [])
    } catch (error) {
      console.error('Error loading parent orders:', error)
    }
  }

  const loadOrderServices = async () => {
    if (!order?.id) return

    try {
      const { data, error } = await supabase
        .from('crm_order_services')
        .select(`
          *,
          crm_services!crm_order_services_service_id_fkey(name, code)
        `)
        .eq('order_id', order.id)

      if (error) throw error

      const mappedServices = data?.map(service => ({
        id: service.id,
        temp_id: service.id, // Usa l'ID esistente come temp_id
        service_id: service.service_id,
        quantity: service.quantity || 1,
        unit_price: service.unit_price || 0,
        notes: service.notes || '',
        is_new: false
      })) || []

      setOrderServices(mappedServices)
    } catch (error) {
      console.error('Error loading order services:', error)
    }
  }

  const addService = () => {
    const newTempId = `new_${Date.now()}`
    setOrderServices(prev => [
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
    setOrderServices(prev => prev.filter(s => s.temp_id !== tempId))
  }

  const updateService = (tempId: string, field: keyof OrderService, value: any) => {
    setOrderServices(prev => prev.map(service => {
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
    return orderServices.reduce((total, service) => {
      return total + (service.quantity * service.unit_price)
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order) return

    if (!formData.title.trim() || !formData.company_id) {
      toast({
        title: "Errore",
        description: "Compila i campi obbligatori (Titolo e Cliente)",
        variant: "destructive"
      })
      return
    }

    // Verifica che ci sia almeno un servizio valido
    const validServices = orderServices.filter(s => s.service_id && s.quantity > 0)
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
      // 1. Aggiorna la commessa
      const { error: orderError } = await supabase
        .from('crm_orders')
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          company_id: formData.company_id,
          parent_order_id: formData.parent_order_id || null,
          assigned_user_id: formData.assigned_user_id || null,
          status: formData.status,
          priority: formData.priority,
          start_date: startDate?.toISOString().split('T')[0] || null,
          end_date: endDate?.toISOString().split('T')[0] || null,
          estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
          actual_hours: formData.actual_hours ? parseFloat(formData.actual_hours) : null,
          total_amount: calculateTotal(),
          progress_percentage: parseInt(formData.progress_percentage),
          notes: formData.notes.trim() || null
        })
        .eq('id', order.id)

      if (orderError) throw orderError

      // 2. Gestisci i servizi
      // Prima elimina tutti i servizi esistenti
      const { error: deleteError } = await supabase
        .from('crm_order_services')
        .delete()
        .eq('order_id', order.id)

      if (deleteError) throw deleteError

      // Poi inserisci tutti i servizi (esistenti e nuovi)
      const servicesToInsert = validServices.map(service => ({
        order_id: order.id,
        service_id: service.service_id,
        quantity: service.quantity,
        unit_price: service.unit_price,
        total_price: service.quantity * service.unit_price,
        notes: service.notes.trim() || null,
        user_id: user?.id || ''
      }))

      const { error: insertError } = await supabase
        .from('crm_order_services')
        .insert(servicesToInsert)

      if (insertError) throw insertError

      toast({
        title: "Successo",
        description: "Commessa aggiornata con successo"
      })

      onOrderUpdated()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error updating order:', error)
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento della commessa",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Commessa - {order.order_number}</DialogTitle>
          <DialogDescription>
            Modifica i dettagli della commessa e i suoi servizi
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informazioni base */}
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
              <Select 
                value={formData.company_id} 
                onValueChange={(value) => updateFormData('company_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un cliente">
                    {formData.company_id && companies.find(c => c.id === formData.company_id)?.name}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              placeholder="Descrizione dettagliata della commessa..."
              rows={3}
            />
          </div>

          {/* Status e Priorità */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => updateFormData('status', value)}
              >  <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Bozza</SelectItem>
                  <SelectItem value="active">Attiva</SelectItem>
                  <SelectItem value="on_hold">In Sospeso</SelectItem>
                  <SelectItem value="completed">Completata</SelectItem>
                  <SelectItem value="cancelled">Annullata</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priorità</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value) => updateFormData('priority', value)}
              >  <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="progress">Progresso (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={formData.progress_percentage}
                onChange={(e) => updateFormData('progress_percentage', e.target.value)}
              />
            </div>
          </div>

          {/* Date e Ore */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Inizio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Seleziona data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Fine</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Seleziona data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated_hours">Ore Stimate</Label>
              <Input
                id="estimated_hours"
                type="number"
                min="0"
                step="0.5"
                value={formData.estimated_hours}
                onChange={(e) => updateFormData('estimated_hours', e.target.value)}
                placeholder="40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actual_hours">Ore Effettive</Label>
              <Input
                id="actual_hours"
                type="number"
                min="0"
                step="0.5"
                value={formData.actual_hours}
                onChange={(e) => updateFormData('actual_hours', e.target.value)}
                placeholder="35"
              />
            </div>
          </div>

          {/* Commessa Padre */}
          <div className="space-y-2">
            <Label htmlFor="parent_order">Commessa Padre (opzionale)</Label>
            <Select 
              value={formData.parent_order_id && formData.parent_order_id !== '' ? formData.parent_order_id : "none"} 
              onValueChange={(value) => updateFormData('parent_order_id', value === "none" ? null : value)}
            >  <SelectTrigger>
                <SelectValue placeholder="Seleziona una commessa padre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna (Commessa principale)</SelectItem>
                {parentOrders.map((parentOrder) => (
                  <SelectItem key={parentOrder.id} value={parentOrder.id}>
                    {parentOrder.order_number} - {parentOrder.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {orderServices.map((service) => (
                <div key={service.temp_id} className="grid grid-cols-12 gap-3 items-end p-3 border rounded-lg">
                  <div className="col-span-5">
                    <Label className="text-sm">Servizio</Label>
                    <Select 
                      value={service.service_id && service.service_id !== '' ? service.service_id : undefined} 
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
                  
                  {/* Note del servizio */}
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
                <Label className="text-sm text-muted-foreground">Totale Commessa</Label>
                <div className="text-2xl font-bold">€{calculateTotal().toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormData('notes', e.target.value)}
              placeholder="Note aggiuntive sulla commessa..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Aggiornamento..." : "Aggiorna Commessa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
