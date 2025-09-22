import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Plus, TrendingUp, DollarSign, Target, BarChart3, CheckCircle, XCircle, Clock, Edit, Trash2, Search, Filter, X, Building2 } from "lucide-react"
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
  services?: OpportunityService[]
}

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Stati per ricerca e filtri
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("created_at")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  const { toast } = useToast()

  const loadOpportunities = async () => {
    setLoading(true)
    try {
      console.log("🔄 Inizio caricamento opportunità...")
      
      // 1. Carica le opportunità
      const { data: opportunitiesData, error: opportunitiesError } = await supabase
        .from('opportunities')
        .select(`
          *,
          crm_companies(name)
        `)
        .order('created_at', { ascending: false })

      if (opportunitiesError) throw opportunitiesError
      console.log("🔵 Opportunità caricate:", opportunitiesData)

      // 2. Carica i servizi per ogni opportunità con sintassi corretta
      const { data: servicesData, error: servicesError } = await supabase
        .from('opportunity_services')
        .select(`
          *,
          crm_services(name, code)
        `)

      if (servicesError) throw servicesError
      console.log("🟢 Servizi caricati:", servicesData)

      // 3. Raggruppa i servizi per opportunità
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

      console.log("🟡 ServicesMap creata:", servicesMap)

      // 4. Combina opportunità e servizi
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
        services: servicesMap.get(item.id) || []
      })) || []

      console.log("🔴 Dati finali mappati:", mappedData)

      setOpportunities(mappedData)
    } catch (error: any) {
      console.error('❌ Errore caricamento opportunità:', error)
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

  // Status change handler
  const handleStatusChange = async (opportunityId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ status: newStatus as 'in_attesa' | 'acquisita' | 'persa' })
        .eq('id', opportunityId)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Status opportunità aggiornato"
      })

      await loadOpportunities()
    } catch (error: any) {
      console.error('Error updating status:', error)
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo status",
        variant: "destructive"
      })
    }
  }

  // Delete opportunity handler
  const handleDeleteOpportunity = async (opportunityId: string) => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunityId)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Opportunità eliminata"
      })

      await loadOpportunities()
    } catch (error: any) {
      console.error('Error deleting opportunity:', error)
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'opportunità",
        variant: "destructive"
      })
    }
  }

  // Edit opportunity handler
  const handleEditOpportunity = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity)
    setShowEditDialog(true)
  }

  // Filtro e ricerca delle opportunità
  const filteredAndSortedOpportunities = useMemo(() => {
    let filtered = opportunities

    // Filtro per ricerca
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(opp => 
        opp.title.toLowerCase().includes(search) ||
        opp.company_name?.toLowerCase().includes(search) ||
        opp.description?.toLowerCase().includes(search) ||
        opp.notes?.toLowerCase().includes(search) ||
        opp.services?.some(service => 
          service.service_name?.toLowerCase().includes(search)
        )
      )
    }

    // Filtro per status
    if (statusFilter !== "all") {
      filtered = filtered.filter(opp => opp.status === statusFilter)
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'company':
          aValue = a.company_name?.toLowerCase() || ''
          bValue = b.company_name?.toLowerCase() || ''
          break
        case 'amount':
          aValue = a.amount
          bValue = b.amount
          break
        case 'win_probability':
          aValue = a.win_probability
          bValue = b.win_probability
          break
        case 'expected_close_date':
          aValue = a.expected_close_date ? new Date(a.expected_close_date).getTime() : 0
          bValue = b.expected_close_date ? new Date(b.expected_close_date).getTime() : 0
          break
        default:
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    return filtered
  }, [opportunities, searchTerm, statusFilter, sortBy, sortOrder])

  // Funzioni di calcolo per le statistiche
  const calculateTotalValue = () => {
    return filteredAndSortedOpportunities.reduce((sum, opp) => sum + opp.amount, 0)
  }

  const calculateWonValue = () => {
    return filteredAndSortedOpportunities
      .filter(opp => opp.status === 'acquisita')
      .reduce((sum, opp) => sum + opp.amount, 0)
  }

  const calculateWeightedValue = () => {
    return filteredAndSortedOpportunities.reduce((sum, opp) => {
      return sum + (opp.amount * opp.win_probability / 100)
    }, 0)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setSortBy("created_at")
    setSortOrder("desc")
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_attesa':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />In Attesa</Badge>
      case 'acquisita':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Acquisita</Badge>
      case 'persa':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Persa</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Caricamento opportunità...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Opportunità</h1>
          <p className="text-muted-foreground">
            Gestisci le opportunità di vendita - {opportunities.length} di {opportunities.length} opportunità
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova Opportunità
        </Button>
      </div>

      {/* Filtri e ricerca */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Cerca per titolo, cliente, descrizione o servizio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="in_attesa">In Attesa</SelectItem>
                <SelectItem value="acquisita">Acquisite</SelectItem>
                <SelectItem value="persa">Perse</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Data Creazione</SelectItem>
                <SelectItem value="title">Titolo</SelectItem>
                <SelectItem value="company">Cliente</SelectItem>
                <SelectItem value="amount">Valore</SelectItem>
                <SelectItem value="win_probability">Probabilità</SelectItem>
                <SelectItem value="expected_close_date">Data Chiusura</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>

            {/* Pulisci filtri */}
            {(searchTerm || statusFilter !== "all" || sortBy !== "created_at" || sortOrder !== "desc") && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-2" />
                Pulisci
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
              {filteredAndSortedOpportunities.length} opportunità mostrate
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
              {filteredAndSortedOpportunities.filter(o => o.status === 'acquisita').length} opportunità vinte
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
              {filteredAndSortedOpportunities.length > 0 
                ? Math.round((filteredAndSortedOpportunities.filter(o => o.status === 'acquisita').length / filteredAndSortedOpportunities.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Opportunità convertite
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista opportunità */}
      {filteredAndSortedOpportunities.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== "all" 
                ? "Nessuna opportunità corrisponde ai criteri di ricerca"
                : "Nessuna opportunità trovata"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Raggruppa per cliente */}
          {Object.entries(
            filteredAndSortedOpportunities.reduce((groups, opportunity) => {
              const client = opportunity.company_name || 'Senza Cliente'
              if (!groups[client]) groups[client] = []
              groups[client].push(opportunity)
              return groups
            }, {} as Record<string, typeof filteredAndSortedOpportunities>)
          ).map(([clientName, clientOpportunities]) => (
            <div key={clientName} className="space-y-4">
              {/* Header del cliente */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">{clientName}</h3>
                  <Badge variant="outline">
                    {clientOpportunities.length} opportunità
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Valore totale cliente</p>
                  <p className="text-lg font-semibold">
                    €{clientOpportunities.reduce((sum, opp) => sum + opp.amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Opportunità del cliente */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clientOpportunities.map((opportunity) => (
                  <Card key={opportunity.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{opportunity.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {getStatusBadge(opportunity.status)}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditOpportunity(opportunity)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminare l'opportunità?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Sei sicuro di voler eliminare l'opportunità "{opportunity.title}"? 
                                  L'opportunità e tutti i servizi associati verranno eliminati definitivamente.
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
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-4">
                        {opportunity.description && (
                          <p className="text-sm text-muted-foreground">{opportunity.description}</p>
                        )}
                        
                        {/* Lista servizi compatta - QUI È IL PEZZO IMPORTANTE */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">Servizi:</h4>
                          {opportunity.services && opportunity.services.length > 0 ? (
                            <div className="space-y-1">
                              {opportunity.services.slice(0, 2).map((service) => (
                                <div key={service.id} className="flex justify-between text-sm">
                                  <span className="truncate">{service.service_name}</span>
                                  <span className="text-muted-foreground">×{service.quantity}</span>
                                </div>
                              ))}
                              {opportunity.services.length > 2 && (
                                <div className="text-xs text-muted-foreground">
                                  ...e altri {opportunity.services.length - 2} servizi
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Nessun servizio configurato</p>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-end pt-2 border-t">
                          <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">
                              Probabilità: {opportunity.win_probability}%
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Ponderato: €{Math.round(opportunity.amount * opportunity.win_probability / 100).toLocaleString()}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-xl font-bold">€{opportunity.amount.toLocaleString()}</div>
                            {opportunity.status === 'in_attesa' && (
                              <div className="flex gap-1 mt-2">
                                <Select
                                  value={opportunity.status}
                                  onValueChange={(value) => handleStatusChange(opportunity.id, value)}
                                >
                                  <SelectTrigger className="w-[120px] h-8 text-xs">
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
                            <p className="text-xs text-muted-foreground italic">
                              {opportunity.notes.length > 80 
                                ? `${opportunity.notes.substring(0, 80)}...`
                                : opportunity.notes
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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
