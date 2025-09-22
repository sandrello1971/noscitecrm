import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface Contact {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  mobile?: string
  position?: string
  department?: string
  company_id?: string
  notes?: string
  is_primary: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  user_id: string
  company?: {
    id: string
    name: string
  }
}

interface Company {
  id: string
  name: string
}

interface EditContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact | null
  onContactUpdated?: () => void
}

interface FormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  mobile: string
  position: string
  department: string
  company_id: string
  notes: string
  is_primary: boolean
  is_active: boolean
}

export function EditContactDialog({ open, onOpenChange, contact, onContactUpdated }: EditContactDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [formData, setFormData] = useState<FormData>({
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

  // Carica le aziende disponibili
  useEffect(() => {
    const loadCompanies = async () => {
      if (!user?.id) return

      try {
        const { data, error } = await supabase
          .from('crm_companies')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('name')

        if (error) throw error
        setCompanies(data || [])
      } catch (error) {
        console.error('Error loading companies:', error)
      }
    }

    if (open) {
      loadCompanies()
    }
  }, [open, user?.id])

  // Popola il form quando si apre il dialog o cambia il contatto
  useEffect(() => {
    if (contact && open) {
      setFormData({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        mobile: contact.mobile || "",
        position: contact.position || "",
        department: contact.department || "",
        company_id: contact.company_id || "",
        notes: contact.notes || "",
        is_primary: contact.is_primary || false,
        is_active: contact.is_active
      })
    }
  }, [contact, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contact || !user?.id) return

    // Validazione base
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast({
        title: "Errore",
        description: "Nome e cognome sono obbligatori.",
        variant: "destructive",
      })
      return
    }

    // Validazione email se presente
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      toast({
        title: "Errore",
        description: "Inserisci un indirizzo email valido.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('crm_contacts')
        .update({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          mobile: formData.mobile.trim() || null,
          position: formData.position.trim() || null,
          department: formData.department.trim() || null,
          company_id: formData.company_id || null,
          notes: formData.notes.trim() || null,
          is_primary: formData.is_primary,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id)

      if (error) throw error
      
      toast({
        title: "Contatto aggiornato",
        description: "Il contatto è stato aggiornato con successo.",
      })
      
      onContactUpdated?.()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error updating contact:', error)
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'aggiornamento del contatto.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!contact) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Contatto</DialogTitle>
          <DialogDescription>
            Modifica i dati del contatto aziendale
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
                <SelectItem value="">Nessuna azienda</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateFormData("email", e.target.value)}
              placeholder="mario.rossi@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateFormData("phone", e.target.value)}
                placeholder="+39 02 1234567"
              />
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="position">Posizione/Ruolo</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => updateFormData("position", e.target.value)}
                placeholder="Manager, Developer, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Reparto</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => updateFormData("department", e.target.value)}
                placeholder="IT, Sales, Marketing, etc."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormData("notes", e.target.value)}
              placeholder="Note aggiuntive sul contatto..."
              className="min-h-[80px]"
            />
          </div>

          <div className="flex flex-col space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => updateFormData("is_primary", checked)}
              />
              <Label htmlFor="is_primary" className="text-sm font-normal">
                Contatto principale dell'azienda
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => updateFormData("is_active", checked)}
              />
              <Label htmlFor="is_active" className="text-sm font-normal">
                Contatto attivo
              </Label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvataggio..." : "Salva Modifiche"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
