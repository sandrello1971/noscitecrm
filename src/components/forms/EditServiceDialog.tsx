import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { X, Plus } from "lucide-react"

interface EditServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: any
  onServiceUpdated?: () => void
}

export function EditServiceDialog({ open, onOpenChange, service, onServiceUpdated }: EditServiceDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [partners, setPartners] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    service_type: "simple",
    unit_price: "",
    unit_of_measure: "pz",
    partner_id: "",
    is_active: true
  })
  const [components, setComponents] = useState<Array<{
    service_id: string
    quantity: number
    temp_id: string
  }>>([])

  useEffect(() => {
    if (service && open) {
      setFormData({
        code: service.code || "",
        name: service.name || "",
        description: service.description || "",
        service_type: service.service_type || "simple",
        unit_price: service.unit_price?.toString() || "",
        unit_of_measure: service.unit_of_measure || "pz",
        partner_id: service.partner_id || "",
        is_active: service.is_active !== undefined ? service.is_active : true
      })
    }
  }, [service, open])

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch partners
      const { data: partnersData } = await supabase
        .from('crm_companies')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_partner', true)
        .eq('is_active', true)
        .order('name')
      
      if (partnersData) setPartners(partnersData)

      // Fetch existing services for composition (excluding current service)
      const { data: servicesData } = await supabase
        .from('crm_services')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .neq('id', service?.id)
        .order('name')
      
      if (servicesData) setServices(servicesData)
    }
    
    if (open) fetchData()
  }, [open, service?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      const { error } = await supabase
        .from('crm_services')
        .update({
          code: formData.code,
          name: formData.name,
          description: formData.description || null,
          service_type: formData.service_type,
          unit_price: formData.unit_price ? parseFloat(formData.unit_price) : null,
          unit_of_measure: formData.unit_of_measure,
          partner_id: formData.partner_id === "no-partner" ? null : formData.partner_id || null,
          is_active: formData.is_active,
        })
        .eq('id', service.id)

      if (error) throw error
      
      toast({
        title: "Servizio aggiornato",
        description: "Il servizio è stato aggiornato con successo.",
      })
      
      onServiceUpdated?.()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento del servizio.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addComponent = () => {
    const newComponent = {
      service_id: "",
      quantity: 1,
      temp_id: Date.now().toString()
    }
    setComponents(prev => [...prev, newComponent])
  }

  const removeComponent = (tempId: string) => {
    setComponents(prev => prev.filter(c => c.temp_id !== tempId))
  }

  const updateComponent = (tempId: string, field: string, value: any) => {
    setComponents(prev => prev.map(c => 
      c.temp_id === tempId ? { ...c, [field]: value } : c
    ))
  }

  if (!service) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Modifica Servizio</DialogTitle>
          <DialogDescription>
            Modifica i dati del servizio
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Codice Servizio *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => updateFormData("code", e.target.value)}
                placeholder="SRV001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_type">Tipo Servizio *</Label>
              <Select value={formData.service_type} onValueChange={(value) => updateFormData("service_type", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Servizio Semplice</SelectItem>
                  <SelectItem value="composed">Servizio Composto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome Servizio *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateFormData("name", e.target.value)}
              placeholder="Consulenza IT"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner_id">Partner</Label>
            <Select value={formData.partner_id} onValueChange={(value) => updateFormData("partner_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un partner (opzionale)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-partner">Nessun partner</SelectItem>
                {partners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData("description", e.target.value)}
              placeholder="Descrizione dettagliata del servizio..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_price">Prezzo Unitario (€)</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => updateFormData("unit_price", e.target.value)}
                placeholder="100.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_of_measure">Unità di Misura</Label>
              <Select value={formData.unit_of_measure} onValueChange={(value) => updateFormData("unit_of_measure", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pz">Pezzo</SelectItem>
                  <SelectItem value="h">Ora</SelectItem>
                  <SelectItem value="gg">Giorno</SelectItem>
                  <SelectItem value="mese">Mese</SelectItem>
                  <SelectItem value="anno">Anno</SelectItem>
                  <SelectItem value="kg">Chilogrammo</SelectItem>
                  <SelectItem value="m">Metro</SelectItem>
                  <SelectItem value="m2">Metro Quadrato</SelectItem>
                  <SelectItem value="m3">Metro Cubo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.service_type === "composed" && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
              <div>
                <h4 className="font-medium mb-2">Composizione Servizio</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Definisci i servizi che compongono questo servizio composto.
                </p>
              </div>
              
              {components.map((component) => (
                <div key={component.temp_id} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Servizio</Label>
                    <Select 
                      value={component.service_id} 
                      onValueChange={(value) => updateComponent(component.temp_id, "service_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un servizio" />
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
                  <div className="w-24">
                    <Label>Quantità</Label>
                    <Input
                      type="number"
                      min="1"
                      value={component.quantity}
                      onChange={(e) => updateComponent(component.temp_id, "quantity", parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeComponent(component.temp_id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addComponent}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Componente
              </Button>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => updateFormData("is_active", checked)}
            />
            <Label htmlFor="is_active">Servizio attivo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Aggiornamento..." : "Aggiorna Servizio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}