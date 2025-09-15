import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, TrendingUp, DollarSign, Target, BarChart3 } from "lucide-react"
import { AddOpportunityDialog } from "@/components/forms/AddOpportunityDialog"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Opportunity {
  id: string
  title: string
  description?: string
  amount: number
  win_probability: number
  status: 'active' | 'won' | 'lost' | 'cancelled'
  expected_close_date?: string
  notes?: string
  company_name?: string
  service_name?: string
  created_at: string
}

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
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
        status: item.status as 'active' | 'won' | 'lost' | 'cancelled',
        expected_close_date: item.expected_close_date,
        notes: item.notes,
        company_name: item.crm_companies?.name,
        service_name: item.crm_services?.name,
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
      'active': { variant: 'default' as const, label: 'Attiva', className: '' },
      'won': { variant: 'default' as const, label: 'Vinta', className: 'bg-green-500' },
      'lost': { variant: 'destructive' as const, label: 'Persa', className: '' },
      'cancelled': { variant: 'secondary' as const, label: 'Annullata', className: '' }
    }
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.active
    return (
      <Badge variant={statusInfo.variant} className={statusInfo.className}>
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
  const activeOpportunities = opportunities.filter(opp => opp.status === 'active').length
  const avgProbability = opportunities.length > 0 
    ? opportunities.reduce((sum, opp) => sum + opp.win_probability, 0) / opportunities.length 
    : 0

  const handleOpportunityAdded = () => {
    loadOpportunities()
    setShowAddDialog(false)
  }

  const convertToOrder = async (opportunityId: string) => {
    try {
      // TODO: Implementare conversione da opportunità a commessa
      toast({
        title: "Funzionalità in sviluppo",
        description: "La conversione in commessa sarà disponibile presto",
      })
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore durante la conversione",
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
                
                {opportunity.status === 'active' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => convertToOrder(opportunity.id)}
                  >
                    Converti in Commessa
                  </Button>
                )}
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
    </div>
  )
}