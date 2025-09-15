import { useState } from "react"
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

interface AddOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrderAdded?: () => void
}

export function AddOrderDialog({ open, onOpenChange, onOrderAdded }: AddOrderDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [formData, setFormData] = useState({
    order_number: "",
    title: "",
    description: "",
    company_id: "",
    parent_order_id: "",
    assigned_user_id: "",
    status: "draft",
    priority: "medium",
    estimated_hours: "",
    total_amount: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // TODO: Implementare chiamata a Supabase
      const orderData = {
        ...formData,
        start_date: startDate?.toISOString().split('T')[0],
        end_date: endDate?.toISOString().split('T')[0]
      }
      console.log("Dati commessa:", orderData)
      
      toast({
        title: "Commessa creata",
        description: "La commessa è stata creata con successo.",
      })
      
      onOrderAdded?.()
      onOpenChange(false)
      setFormData({
        order_number: "",
        title: "",
        description: "",
        company_id: "",
        parent_order_id: "",
        assigned_user_id: "",
        status: "draft",
        priority: "medium",
        estimated_hours: "",
        total_amount: ""
      })
      setStartDate(undefined)
      setEndDate(undefined)
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la creazione della commessa.",
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuova Commessa</DialogTitle>
          <DialogDescription>
            Inserisci i dati della nuova commessa di lavoro
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order_number">Numero Commessa *</Label>
              <Input
                id="order_number"
                value={formData.order_number}
                onChange={(e) => updateFormData("order_number", e.target.value)}
                placeholder="COM-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_id">Azienda Cliente *</Label>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Titolo Commessa *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateFormData("title", e.target.value)}
              placeholder="Sviluppo sito web aziendale"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData("description", e.target.value)}
              placeholder="Descrizione dettagliata della commessa..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent_order_id">Commessa Padre (opzionale)</Label>
            <Select value={formData.parent_order_id} onValueChange={(value) => updateFormData("parent_order_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona una commessa padre" />
              </SelectTrigger>
                <SelectContent>
                  {/* TODO: Caricare le commesse da Supabase */}
                  <SelectItem value="none">Nessuna (Commessa principale)</SelectItem>
                  <SelectItem value="1">COM-001 - Progetto principale</SelectItem>
                  <SelectItem value="2">COM-002 - Altro progetto</SelectItem>
                </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Stato</Label>
              <Select value={formData.status} onValueChange={(value) => updateFormData("status", value)}>
                <SelectTrigger>
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
              <Select value={formData.priority} onValueChange={(value) => updateFormData("priority", value)}>
                <SelectTrigger>
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
          </div>

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
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
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
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="pointer-events-auto"
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
                step="0.5"
                value={formData.estimated_hours}
                onChange={(e) => updateFormData("estimated_hours", e.target.value)}
                placeholder="40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_amount">Importo Totale (€)</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                value={formData.total_amount}
                onChange={(e) => updateFormData("total_amount", e.target.value)}
                placeholder="5000.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned_user_id">Assegnato a</Label>
            <Select value={formData.assigned_user_id} onValueChange={(value) => updateFormData("assigned_user_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un utente" />
              </SelectTrigger>
                <SelectContent>
                  {/* TODO: Caricare gli utenti da Supabase */}
                  <SelectItem value="none">Nessuno</SelectItem>
                  <SelectItem value="1">Mario Rossi</SelectItem>
                  <SelectItem value="2">Luigi Bianchi</SelectItem>
                </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creazione..." : "Crea Commessa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}