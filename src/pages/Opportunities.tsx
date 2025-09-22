import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Plus, TrendingUp, DollarSign, Target, BarChart3, CheckCircle, XCircle, Clock, Edit, Trash2, Search, Filter, X } from "lucide-react"
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
  user_id?: string
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
        default: // created_at
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
      }

      if (typeof aValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue as string)
          : (bValue as string).localeCompare(aValue)
      } else {
        return sortOrder === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number)
      }
    })

    return filtered
  }, [opportunities, searchTerm, statusFilter, sortBy, sortOrder])

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

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setSortBy("created_at")
    setSortOrder("desc")
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
    return filteredAndSortedOpportunities.reduce((total, opp) => total + opp.amount, 0)
  }

  const calculateWonValue = () => {
    return filteredAndSortedOpportunities
      .filter(opp => opp.status === 'acquisita')
      .reduce((total, opp) => total + opp.amount, 0)
  }

  const calculateWeightedValue = () => {
    return filteredAndSortedOpportunities
      .filter(opp => opp.status === 'in_attesa')
      .reduce((total, opp) => total + (opp.amount * opp.win_probability / 100), 0)
  }

  if (loading) {
    return <div className="p-6">Caricamento...</div>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Opportunità</h1>
          <p className="text-muted-foreground">
            Gestisci le opportunità di vendita - {filteredAndSortedOpportunities.length} di {opportunities.length} opportunità
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuova Opportunità
        </Button>
      </div>

      {/* Barra di ricerca e filtri */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Campo ricerca */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per titolo, cliente, descrizione, servizi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filtro status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="in_attesa">In Attesa</SelectItem>
                <SelectItem value="acquisita">Acquisita</SelectItem>
                <SelectItem value="persa">Persa</SelectItem>
              </SelectContent>
            </Select>

            {/* Ordinamento */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Data Creazione</SelectItem>
                <SelectItem value="title">Titolo</SelectItem>
                <SelectItem value="company">Cliente</SelectItem>
                <SelectItem value="amount">Importo</SelectItem>
                <SelectItem value="win_probability">Probabilità</SelectItem>
                <SelectItem value="expected_close_date">Data Chiusura</SelectItem>
              </SelectContent>
            </Select>

            {/* Direzione ordinamento */}
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

      {/* Cards statistiche (basate sui risultati filtrati) */}
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

      {/* Lista opportunità filtrate */}
      <div className="grid gap-4">
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
          filteredAndSortedOpportunities.map((opportunity) => (
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
          ))
        )}
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
        opportunity={selectedOpportunity!}
      />
    </div>
  )
}
