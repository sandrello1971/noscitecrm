import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Plus, TrendingUp, DollarSign, Target, BarChart3, CheckCircle, XCircle, Clock, Edit, Trash2 } from "lucide-react"
import { AddOpportunityDialog } from "@/components/forms/AddOpportunityDialog"
import { EditOpportunityDialog } from "@/components/forms/EditOpportunityDialog"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface OpportunityService {
  id: string
  service_id: string
  quantity: number
  unit_price: number
  total_price: number
  notes?: string
  service_name?: string
}

interface Opportunity {
  id: string
  title: string
  description?: string
  amount: number
  win_probability: number
  status: 'in_attesa' | 'acquisita' | 'persa'
  expected_close_date?: string
  notes?: string
  company_name?: string
  company_id?: string
  created_at: string
  user_id: string
  services?: OpportunityService[]
}

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadOpportunities = async () => {
    try {
      // Carica le opportunità
      const { data: opportunitiesData, error: opportunitiesError } = await supabase
        .from('opportunities')
        .select(`
          *,
          crm_companies!opportunities_company_id_fkey(name)
        `)
        .order('created_at', { ascending: false })

      if (opportunitiesError) throw opportunitiesError

      // Carica i servizi per ogni opportunità
      const { data: servicesData, error: servicesError } = await supabase
        .from('opportunity_services')
        .select(`
          *,
          crm_services!opportunity_services_service_id_fkey(name)
        `)

      if (servicesError) throw servicesError

      // Raggruppa i servizi per opportunità
      const servicesMap = new Map()
      servicesData?.forEach(service => {
        if (!servicesMap.has(service.opportunity_id)) {
          servicesMap.set(service.opportunity_id, [])
        }
        servicesMap.get(service.opportunity_id).push({
          id: service.id,
          service_id: service.service_id,
          quantity: service.quantity,
          unit_price: service.unit_price,
          total_price: service.total_price,
          notes: service.notes,
          service_name: service.crm_services?.name
        })
      })

      // Combina opportunità e servizi
      const mappedData = opportunitiesData?.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        amount: item.amount,
        win_probability: item.win_probability,
        status: item.status,
        expected_close_date: item.expected_close_date,
        notes: item.notes,
        company_name: item.crm_companies?.name,
        company_id: item.company_id,
        created_at: item.created_at,
        user_id: item.user_id,
        services: servicesMap.get(item.id) || []
      })) || []

      setOpportunities(mappedData)
    } catch (error: any) {
      console.error('Error loading opportunities:', error)
      toast({
        title: "Errore",
        description: "Impossibile caricare le opportunità",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOpportunities()
  }, [])

  const handleStatusChange = async (opportunityId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ status: newStatus as "in_attesa" | "acquisita" | "persa" })
        .eq('id', opportunityId)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Status dell'opportunità aggiornato",
      })

      loadOpportunities()
    } catch (error: any) {
      console.error('Error updating opportunity status:', error)
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento dello status",
        variant: "destructive"
      })
    }
  }

  const handleDeleteOpportunity = async (opportunityId: string) => {
    try {
      // Prima elimina i servizi associati (CASCADE dovrebbe farlo automaticamente)
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunityId)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Opportunità eliminata con successo",
      })

      loadOpportunities()
    } catch (error: any) {
      console.error('Error deleting opportunity:', error)
      toast({
        title: "Errore",
        description: "Errore durante l'eliminazione dell'opportunità",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_attesa':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />In Attesa</Badge>
      case 'acquisita':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Acquisita</Badge>
      case 'persa':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Persa</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const calculateTotalValue = () => {
    return opportunities.reduce((total, opp) => total + opp.amount, 0)
  }

  const calculateWonValue = () => {
    return opportunities
      .filter(opp => opp.status === 'acquisita')
      .reduce((total, opp) => total + opp.amount, 0)
  }

  const calculateWeightedValue = () => {
    return opportunities
      .filter(opp => opp.status === 'in_attesa')
      .reduce((total, opp) => total + (opp.amount * opp.win_probability / 100), 0)
  }

  if (loading) {
    return <div className="p-6">Caricamento...</div>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header con statistiche */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Opportunità</h1>
          <p className="text-muted-foreground">Gestisci le opportunità di vendita</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuova Opportunità
        </Button>
      </div>

      {/* Cards statistiche */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{calculateTotalValue().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {opportunities.length} opportunità totali
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Acquisito</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">€{calculateWonValue().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {opportunities.filter(o => o.status === 'acquisita').length} opportunità vinte
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Ponderato</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{Math.round(calculateWeightedValue()).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Basato su probabilità di successo
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso di Conversione</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {opportunities.length > 0 
                ? Math.round((opportunities.filter(o => o.status === 'acquisita').length / opportunities.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Opportunità convertite
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista opportunità */}
      <div className="grid gap-4">
        {opportunities.map((opportunity) => (
          <Card key={opportunity.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <CardTitle className="text-lg">{opportunity.title}</CardTitle>
                  <CardDescription>
                    Cliente: {opportunity.company_name}
                    {opportunity.expected_close_date && (
                      <span className="ml-2">
                        • Chiusura prevista: {new Date(opportunity.expected_close_date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(opportunity.status)}
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedOpportunity(opportunity)
                        setShowEditDialog(true)
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare l'opportunità?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Questa azione non può essere annullata. L'opportunità e tutti i servizi associati verranno eliminati definitivamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteOpportunity(opportunity.id)}>
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {opportunity.description && (
                  <p className="text-sm text-muted-foreground">{opportunity.description}</p>
                )}
                
                {/* Lista servizi */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Servizi:</h4>
                  <div className="space-y-2">
                    {opportunity.services?.map((service, index) => (
                      <div key={service.id} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">{service.service_name}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            Quantità: {service.quantity}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">€{service.total_price.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">
                            €{service.unit_price} × {service.quantity}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">
                      Probabilità di successo: {opportunity.win_probability}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Valore ponderato: €{Math.round(opportunity.amount * opportunity.win_probability / 100).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold">€{opportunity.amount.toLocaleString()}</div>
                    {opportunity.status === 'in_attesa' && (
                      <div className="flex gap-2 mt-2">
                        <Select
                          value={opportunity.status}
                          onValueChange={(value) => handleStatusChange(opportunity.id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in_attesa">In Attesa</SelectItem>
                            <SelectItem value="acquisita">Acquisita</SelectItem>
                            <SelectItem value="persa">Persa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
                
                {opportunity.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">{opportunity.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialogs */}
      <AddOpportunityDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onOpportunityAdded={loadOpportunities}
      />
      
      <EditOpportunityDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onOpportunityUpdated={loadOpportunities}
        opportunity={selectedOpportunity}
      />
    </div>
  )
}
