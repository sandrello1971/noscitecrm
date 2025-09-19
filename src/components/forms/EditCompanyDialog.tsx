import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { useToast, toast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface EditCompanyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company: any
  onCompanyUpdated?: () => void
}

export function EditCompanyDialog({ open, onOpenChange, company, onCompanyUpdated }: EditCompanyDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    vat_number: "",
    fiscal_code: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    province: "",
    postal_code: "",
    country: "Italia",
    description: "",
    is_active: true,
    is_partner: false
  })

  useEffect(() => {
    if (company && open) {
      setFormData({
        name: company.name || "",
        vat_number: company.vat_number || "",
        fiscal_code: company.fiscal_code || "",
        email: company.email || "",
        phone: company.phone || "",
        website: company.website || "",
        address: company.address || "",
        city: company.city || "",
        province: company.province || "",
        postal_code: company.postal_code || "",
        country: company.country || "Italia",
        description: company.description || "",
        is_active: company.is_active !== undefined ? company.is_active : true,
        is_partner: company.is_partner !== undefined ? company.is_partner : false
      })
    }
  }, [company, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      const { error } = await supabase
        .from('crm_companies')
        .update({
          name: formData.name,
          vat_number: formData.vat_number || null,
          fiscal_code: formData.fiscal_code || null,
          email: formData.email || null,
          phone: formData.phone || null,
          website: formData.website || null,
          address: formData.address || null,
          city: formData.city || null,
          province: formData.province || null,
          postal_code: formData.postal_code || null,
          country: formData.country,
          description: formData.description || null,
          is_active: formData.is_active,
          is_partner: formData.is_partner,
        })
        .eq('id', company.id)

      if (error) throw error
      
      toast({
        title: "Azienda aggiornata",
        description: "L'azienda è stata aggiornata con successo.",
      })
      
      onCompanyUpdated?.()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dell'azienda.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!company) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Modifica Azienda</DialogTitle>
          <DialogDescription>
            Modifica i dati dell'azienda
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
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
                placeholder="IT12345678901"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fiscal_code">Codice Fiscale</Label>
              <Input
                id="fiscal_code"
                value={formData.fiscal_code}
                onChange={(e) => updateFormData("fiscal_code", e.target.value)}
                placeholder="Codice fiscale"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                placeholder="email@azienda.it"
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
              placeholder="Via, Numero civico"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Città</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => updateFormData("city", e.target.value)}
                placeholder="Città"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="province">Provincia</Label>
              <Input
                id="province"
                value={formData.province}
                onChange={(e) => updateFormData("province", e.target.value)}
                placeholder="Provincia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">CAP</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) => updateFormData("postal_code", e.target.value)}
                placeholder="12345"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Note</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData("description", e.target.value)}
              placeholder="Note aggiuntive..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => updateFormData("is_active", checked)}
              />
              <Label htmlFor="is_active">Azienda attiva</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="is_partner"
                checked={formData.is_partner}
                onCheckedChange={(checked) => updateFormData("is_partner", checked)}
              />
              <Label htmlFor="is_partner">È un partner</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Aggiornamento..." : "Aggiorna Azienda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}