import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

interface AddServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onServiceAdded?: () => void
}

export function AddServiceDialog({ open, onOpenChange, onServiceAdded }: AddServiceDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    service_type: "simple",
    unit_price: "",
    unit_of_measure: "pz",
    is_active: true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // TODO: Implementare chiamata a Supabase
      console.log("Dati servizio:", formData)
      
      toast({
        title: "Servizio creato",
        description: "Il servizio è stato creato con successo.",
      })
      
      onServiceAdded?.()
      onOpenChange(false)
      setFormData({
        code: "",
        name: "",
        description: "",
        service_type: "simple",
        unit_price: "",
        unit_of_measure: "pz",
        is_active: true
      })
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la creazione del servizio.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuovo Servizio</DialogTitle>
          <DialogDescription>
            Inserisci i dati del nuovo servizio nella distinta base
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Composizione Servizio</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Dopo aver creato il servizio composto, potrai definire i servizi che lo compongono.
              </p>
              <Button type="button" variant="outline" size="sm">
                Aggiungi Componenti
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
              {loading ? "Creazione..." : "Crea Servizio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}