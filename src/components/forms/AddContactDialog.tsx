import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

interface AddContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactAdded?: () => void
}

export function AddContactDialog({ open, onOpenChange, onContactAdded }: AddContactDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    mobile: "",
    position: "",
    department: "",
    company_id: "",
    notes: "",
    is_primary: false,
    is_active: true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // TODO: Implementare chiamata a Supabase
      console.log("Dati contatto:", formData)
      
      toast({
        title: "Contatto creato",
        description: "Il contatto è stato creato con successo.",
      })
      
      onContactAdded?.()
      onOpenChange(false)
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        mobile: "",
        position: "",
        department: "",
        company_id: "",
        notes: "",
        is_primary: false,
        is_active: true
      })
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la creazione del contatto.",
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
          <DialogTitle>Aggiungi Nuovo Contatto</DialogTitle>
          <DialogDescription>
            Inserisci i dati del nuovo contatto aziendale
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nome *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => updateFormData("first_name", e.target.value)}
                placeholder="Mario"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Cognome *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => updateFormData("last_name", e.target.value)}
                placeholder="Rossi"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_id">Azienda</Label>
            <Select value={formData.company_id} onValueChange={(value) => updateFormData("company_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un'azienda" />
              </SelectTrigger>
              <SelectContent>
                {/* TODO: Caricare le aziende da Supabase */}
                <SelectItem value="1">Azienda Esempio 1</SelectItem>
                <SelectItem value="2">Azienda Esempio 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="position">Ruolo</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => updateFormData("position", e.target.value)}
                placeholder="Direttore Commerciale"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Dipartimento</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => updateFormData("department", e.target.value)}
                placeholder="Vendite"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                placeholder="mario.rossi@azienda.it"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateFormData("phone", e.target.value)}
                placeholder="+39 02 1234 5678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile">Cellulare</Label>
            <Input
              id="mobile"
              value={formData.mobile}
              onChange={(e) => updateFormData("mobile", e.target.value)}
              placeholder="+39 123 456 7890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormData("notes", e.target.value)}
              placeholder="Note aggiuntive sul contatto..."
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => updateFormData("is_primary", checked)}
              />
              <Label htmlFor="is_primary">Contatto principale</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => updateFormData("is_active", checked)}
              />
              <Label htmlFor="is_active">Contatto attivo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creazione..." : "Crea Contatto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}