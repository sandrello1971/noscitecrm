import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Combobox } from "@/components/ui/combobox"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useItalianCities } from "@/hooks/useItalianCities"

interface AddCompanyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompanyAdded?: () => void
}

export function AddCompanyDialog({ open, onOpenChange, onCompanyAdded }: AddCompanyDialogProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    vat_number: "",
    tax_code: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    province: "",
    postal_code: "",
    country: "IT",
    notes: "",
    is_active: true,
    is_partner: false
  })

  const { 
    provinces, 
    cities, 
    postalCodes, 
    loading, 
    getCitiesByProvince, 
    searchCities, 
    getPostalCodesByCity 
  } = useItalianCities()

  // Quando cambia la provincia, carica le città
  useEffect(() => {
    if (formData.province) {
      getCitiesByProvince(formData.province)
      // Reset città e CAP quando cambia provincia
      setFormData(prev => ({ ...prev, city: "", postal_code: "" }))
    }
  }, [formData.province, getCitiesByProvince])

  // Quando cambia la città, carica i CAP
  useEffect(() => {
    if (formData.city && formData.province) {
      getPostalCodesByCity(formData.city, formData.province)
      // Se c'è un solo CAP, selezionalo automaticamente
      setTimeout(() => {
        if (postalCodes.length === 1) {
          setFormData(prev => ({ ...prev, postal_code: postalCodes[0] }))
        }
      }, 100)
    }
  }, [formData.city, formData.province, getPostalCodesByCity])

  // Quando cambiano i CAP disponibili, aggiorna automaticamente se c'è un solo risultato
  useEffect(() => {
    if (postalCodes.length === 1 && !formData.postal_code) {
      setFormData(prev => ({ ...prev, postal_code: postalCodes[0] }))
    }
  }, [postalCodes, formData.postal_code])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      const { data, error } = await supabase
        .from('crm_companies')
        .insert([{
          user_id: user.id,
          name: formData.name,
          vat_number: formData.vat_number || null,
          tax_code: formData.tax_code || null,
          email: formData.email || null,
          phone: formData.phone || null,
          website: formData.website || null,
          address: formData.address || null,
          city: formData.city || null,
          province: formData.province || null,
          postal_code: formData.postal_code || null,
          country: formData.country,
          notes: formData.notes || null,
          is_active: formData.is_active,
          is_partner: formData.is_partner,
        }])

      if (error) throw error
      
      toast({
        title: "Azienda creata",
        description: "L'azienda è stata creata con successo.",
      })
      
      onCompanyAdded?.()
      onOpenChange(false)
      setFormData({
        name: "",
        vat_number: "",
        tax_code: "",
        email: "",
        phone: "",
        website: "",
        address: "",
        city: "",
        province: "",
        postal_code: "",
        country: "IT",
        notes: "",
        is_active: true,
        is_partner: false
      })
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la creazione dell'azienda.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuova Azienda</DialogTitle>
          <DialogDescription>
            Inserisci i dati della nuova azienda cliente
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Azienda *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData("name", e.target.value)}
                placeholder="Nome dell'azienda"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat_number">Partita IVA</Label>
              <Input
                id="vat_number"
                value={formData.vat_number}
                onChange={(e) => updateFormData("vat_number", e.target.value)}
                placeholder="12345678901"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tax_code">Codice Fiscale</Label>
              <Input
                id="tax_code"
                value={formData.tax_code}
                onChange={(e) => updateFormData("tax_code", e.target.value)}
                placeholder="RSSMRA80A01H501U"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                placeholder="info@azienda.it"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateFormData("phone", e.target.value)}
                placeholder="+39 123 456 7890"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Sito Web</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => updateFormData("website", e.target.value)}
                placeholder="https://www.azienda.it"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Indirizzo</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => updateFormData("address", e.target.value)}
              placeholder="Via Roma, 123"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="province">Provincia</Label>
              <Combobox
                options={provinces.map(p => ({ value: p.code, label: `${p.name} (${p.code})` }))}
                value={formData.province}
                onValueChange={(value) => updateFormData("province", value)}
                placeholder="Seleziona provincia..."
                searchPlaceholder="Cerca provincia..."
                emptyText="Nessuna provincia trovata."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Paese</Label>
              <Select value={formData.country} onValueChange={(value) => updateFormData("country", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IT">Italia</SelectItem>
                  <SelectItem value="FR">Francia</SelectItem>
                  <SelectItem value="DE">Germania</SelectItem>
                  <SelectItem value="ES">Spagna</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Città</Label>
              <Combobox
                options={cities.map(c => ({ value: c.city_name, label: c.city_name }))}
                value={formData.city}
                onValueChange={(value) => updateFormData("city", value)}
                placeholder={formData.province ? "Seleziona città..." : "Prima seleziona una provincia"}
                searchPlaceholder="Cerca città..."
                emptyText="Nessuna città trovata."
                disabled={!formData.province}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">CAP</Label>
              {postalCodes.length <= 1 ? (
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) => updateFormData("postal_code", e.target.value)}
                  placeholder={formData.city ? "CAP automatico..." : "Seleziona prima una città"}
                  disabled={!formData.city}
                />
              ) : (
                <Select
                  value={formData.postal_code}
                  onValueChange={(value) => updateFormData("postal_code", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona CAP..." />
                  </SelectTrigger>
                  <SelectContent>
                    {postalCodes.map(code => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormData("notes", e.target.value)}
              placeholder="Note aggiuntive sull'azienda..."
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_partner"
              checked={formData.is_partner}
              onCheckedChange={(checked) => updateFormData("is_partner", checked)}
            />
            <Label htmlFor="is_partner">Partner</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => updateFormData("is_active", checked)}
            />
            <Label htmlFor="is_active">Azienda attiva</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creazione..." : "Crea Azienda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}