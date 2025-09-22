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
import { useAuth } from "@/contexts/AuthContext"

interface AddContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactAdded?: () => void
}

interface Company {
  id: string
  name: string
}

export function AddContactDialog({ open, onOpenChange, onContactAdded }: AddContactDialogProps) {
  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
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

  useEffect(() => {
    if (open) {
      loadCompanies()
    }
  }, [open])

  const loadCompanies = async () => {
    try {
      let query = supabase
        .from('crm_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (!isAdmin) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          query = query.eq('user_id', user.id)
        }
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading companies:', error)
        throw error
      }

      setCompanies(data || [])
    } catch (error) {
      console.error('Error loading companies:', error)
      toast({
        title: "Errore",
        description: "Impossibile caricare le aziende",
        variant: "destructive"
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Utente non autenticato")

      const { data, error } = await supabase
        .from('crm_contacts')
        .insert({
          user_id: user.id,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          mobile: formData.mobile.trim() || null,
          position: formData.position.trim() || null,
          department: formData.department.trim() || null,
          company_id: formData.company_id === "none" ? null : formData.company_id || null,
          notes: formData.notes.trim() || null,
          is_primary: formData.is_primary,
          is_active: formData.is_active
        })
        .select()

      if (error) throw error
      
      toast({
        title: "Contatto creato",
        description: "Il contatto è stato creato con successo.",
      })
      
      onContactAdded?.()
      resetForm()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error creating contact:', error)
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante la creazione del contatto.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
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
                <SelectValue placeholder="Seleziona un'azienda (opzionale)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna azienda</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
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
                placeholder="+39 123 456 7890"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile">Cellulare</Label>
            <Input
              id="mobile"
              value={formData.mobile}
              onChange={(e) => updateFormData("mobile", e.target.value)}
              placeholder="+39 333 123 4567"
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

          <div className="flex items-center space-x-2">
            <Switch
              id="is_primary"
              checked={formData.is_primary}
              onCheckedChange={(checked) => updateFormData("is_primary", checked)}
            />
            <Label htmlFor="is_primary">Contatto principale dell'azienda</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => updateFormData("is_active", checked)}
            />
            <Label htmlFor="is_active">Contatto attivo</Label>
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
