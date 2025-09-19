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
  service_name?: string
  company_id?: string
  service_id?: string
  created_at: string
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
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          crm_companies!opportunities_company_id_fkey(name),
          crm_services!opportunities_service_id_fkey(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mappedData = data?.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        amount: item.amount,
        win_probability: item.win_probability,
        status: item.status as 'in_attesa' | 'acquisita' | 'persa',
        expected_close_date: item.expected_close_date,
        notes: item.notes,
        company_name: item.crm_companies?.name,
        service_name: item.crm_services?.name,
        company_id: item.company_id,
        service_id: item.service_id,
        created_at: item.created_at
      })) || []

      setOpportunities(mappedData)
    } catch (error) {
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

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'in_attesa': { variant: 'default' as const, label: 'In Attesa', className: 'bg-blue-500 text-white', icon: Clock },
      'acquisita': { variant: 'default' as const, label: 'Acquisita', className: 'bg-green-500 text-white', icon: CheckCircle },
      'persa': { variant: 'destructive' as const, label: 'Persa', className: 'bg-red-500 text-white', icon: XCircle }
    }
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.in_attesa
    const Icon = statusInfo.icon
    return (
      <Badge variant={statusInfo.variant} className={statusInfo.className}>
        <Icon className="w-3 h-3 mr-1" />
        {statusInfo.label}
      </Badge>
    )
  }

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return 'text-green-600'
    if (probability >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Calculate forecast metrics
  const totalValue = opportunities.reduce((sum, opp) => sum + opp.amount, 0)
  const weightedValue = opportunities.reduce((sum, opp) => sum + (opp.amount * opp.win_probability / 100), 0)
  const activeOpportunities = opportunities.filter(opp => opp.status === 'in_attesa').length
  const avgProbability = opportunities.length > 0 
    ? opportunities.reduce((sum, opp) => sum + opp.win_probability, 0) / opportunities.length 
    : 0

  const handleOpportunityAdded = () => {
    loadOpportunities()
    setShowAddDialog(false)
  }

  const handleOpportunityUpdated = () => {
    loadOpportunities()
    setShowEditDialog(false)
    setSelectedOpportunity(null)
  }

  const handleEditOpportunity = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity)
    setShowEditDialog(true)
  }

  const handleDeleteOpportunity = async (opportunityId: string) => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunityId)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Opportunità eliminata con successo"
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

  const updateOpportunityStatus = async (opportunityId: string, newStatus: 'in_attesa' | 'acquisita' | 'persa') => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ status: newStatus })
        .eq('id', opportunityId)

      if (error) throw error

      // Reload opportunities to get the updated list
      loadOpportunities()
      
      if (newStatus === 'acquisita') {
        toast({
          title: "Opportunità acquisita!",
          description: "L'opportunità è stata convertita automaticamente in commessa",
        })
      } else {
        toast({
          title: "Status aggiornato",
          description: `L'opportunità è stata marcata come ${newStatus === 'persa' ? 'persa' : 'in attesa'}`,
        })
      }
    } catch (error: any) {
      console.error('Error updating opportunity status:', error)
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento dello status",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Opportunità</h1>
          <p className="text-muted-foreground">
            Gestisci il tuo forecast e le opportunità di vendita
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Aggiungi Opportunità
        </Button>
      </div>

      {/* Forecast Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Ponderato</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{Math.round(weightedValue).toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunità Attive</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOpportunities}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prob. Media</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgProbability)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Opportunities List */}
      {opportunities.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nessuna opportunità</CardTitle>
            <CardDescription>
              Non hai ancora creato nessuna opportunità. Inizia creando la tua prima opportunità di vendita.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crea la tua prima opportunità
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((opportunity) => (
            <Card key={opportunity.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{opportunity.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {opportunity.company_name} • {opportunity.service_name}
                    </CardDescription>
                  </div>
                  {getStatusBadge(opportunity.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valore:</span>
                    <span className="font-semibold">€{opportunity.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Probabilità:</span>
                    <span className={`font-semibold ${getProbabilityColor(opportunity.win_probability)}`}>
                      {opportunity.win_probability}%
                    </span>
                  </div>
                  {opportunity.expected_close_date && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Chiusura prevista:</span>
                      <span className="text-sm">
                        {new Date(opportunity.expected_close_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                
                {opportunity.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {opportunity.description}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditOpportunity(opportunity)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Modifica
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Elimina
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare l'opportunità "{opportunity.title}"? 
                          Questa azione non può essere annullata.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteOpportunity(opportunity.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Cambia Status:</span>
                  <Select 
                    value={opportunity.status} 
                    onValueChange={(value: 'in_attesa' | 'acquisita' | 'persa') => updateOpportunityStatus(opportunity.id, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_attesa">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-2" />
                          In Attesa
                        </div>
                      </SelectItem>
                      <SelectItem value="acquisita">
                        <div className="flex items-center">
                          <CheckCircle className="w-3 h-3 mr-2" />
                          Acquisita
                        </div>
                      </SelectItem>
                      <SelectItem value="persa">
                        <div className="flex items-center">
                          <XCircle className="w-3 h-3 mr-2" />
                          Persa
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddOpportunityDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onOpportunityAdded={handleOpportunityAdded}
      />

      <EditOpportunityDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onOpportunityUpdated={handleOpportunityUpdated}
        opportunity={selectedOpportunity}
      />
    </div>
  )
}