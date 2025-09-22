import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Package, Edit, Trash2, Plus, Search, X, Euro, Layers, Package2, BarChart3 } from "lucide-react"
import { AddServiceDialog } from "@/components/forms/AddServiceDialog"
import { EditServiceDialog } from "@/components/forms/EditServiceDialog"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface ServiceComponent {
  id: string
  child_service_id: string
  quantity: number
  child_service_name?: string
  child_service_code?: string
}

interface Service {
  id: string
  code: string
  name: string
  description?: string
  service_type: 'simple' | 'composed'
  unit_price?: number
  unit_of_measure?: string
  is_active: boolean
  created_at: string
  components?: ServiceComponent[]
  usage_count?: number
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Stati per ricerca e filtri
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("name")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [activeTab, setActiveTab] = useState("all")
  
  const { toast } = useToast()

  const refreshServices = async () => {
    try {
      setLoading(true)
      
      // Carica i servizi
      const { data: servicesData, error: servicesError } = await supabase
        .from('crm_services')
        .select('*')
        .order('name')

      if (servicesError) throw servicesError

      // Carica le composizioni dei servizi
      const { data: compositionsData, error: compositionsError } = await supabase
        .from('crm_service_compositions')
        .select(`
          *,
          crm_services!crm_service_compositions_child_service_id_fkey(name, code)
        `)

      if (compositionsError) throw compositionsError

      // Carica il conteggio dell'utilizzo dei servizi nelle opportunità
      const { data: usageData, error: usageError } = await supabase
        .from('opportunity_services')
        .select('service_id')

      if (usageError) throw usageError

      // Raggruppa le composizioni per servizio padre
      const compositionsMap = new Map()
      compositionsData?.forEach(comp => {
        if (!compositionsMap.has(comp.parent_service_id)) {
          compositionsMap.set(comp.parent_service_id, [])
        }
        compositionsMap.get(comp.parent_service_id).push({
          id: comp.id,
          child_service_id: comp.child_service_id,
          quantity: comp.quantity,
          child_service_name: comp.crm_services?.name,
          child_service_code: comp.crm_services?.code
        })
      })

      // Calcola l'utilizzo per servizio
      const usageMap = new Map()
      usageData?.forEach(usage => {
        const count = usageMap.get(usage.service_id) || 0
        usageMap.set(usage.service_id, count + 1)
      })

      // Combina tutti i dati
      const mappedData = servicesData?.map(service => ({
        ...service,
        components: compositionsMap.get(service.id) || [],
        usage_count: usageMap.get(service.id) || 0
      })) || []

      setServices(mappedData)
    } catch (error: any) {
      console.error('Error loading services:', error)
      toast({
        title: "Errore",
        description: "Impossibile caricare i servizi",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshServices()
  }, [])

  // Filtro e ricerca dei servizi
  const filteredAndSortedServices = useMemo(() => {
    let filtered = services

    // Filtro per tab attivo
    if (activeTab !== "all") {
      filtered = filtered.filter(service => service.service_type === activeTab)
    }

    // Filtro per ricerca
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(service => 
        service.name.toLowerCase().includes(search) ||
        service.code.toLowerCase().includes(search) ||
        service.description?.toLowerCase().includes(search) ||
        service.unit_of_measure?.toLowerCase().includes(search) ||
        service.components?.some(comp => 
          comp.child_service_name?.toLowerCase().includes(search) ||
          comp.child_service_code?.toLowerCase().includes(search)
        )
      )
    }

    // Filtro per status
    if (statusFilter !== "all") {
      filtered = filtered.filter(service => 
        statusFilter === "active" ? service.is_active : !service.is_active
      )
    }

    // Filtro per tipo (ridondante con i tab, ma utile per ricerche globali)
    if (typeFilter !== "all") {
      filtered = filtered.filter(service => service.service_type === typeFilter)
    }

    // Filtro per range di prezzo
    if (priceRangeFilter !== "all") {
      filtered = filtered.filter(service => {
        if (!service.unit_price) return priceRangeFilter === "no_price"
        
        switch (priceRangeFilter) {
          case "0-100":
            return service.unit_price <= 100
          case "100-500":
            return service.unit_price > 100 && service.unit_price <= 500
          case "500-1000":
            return service.unit_price > 500 && service.unit_price <= 1000
          case "1000+":
            return service.unit_price > 1000
          case "no_price":
            return false
          default:
            return true
        }
      })
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'code':
          aValue = a.code.toLowerCase()
          bValue = b.code.toLowerCase()
          break
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'unit_price':
          aValue = a.unit_price || 0
          bValue = b.unit_price || 0
          break
        case 'service_type':
          aValue = a.service_type
          bValue = b.service_type
          break
        case 'usage_count':
          aValue = a.usage_count || 0
          bValue = b.usage_count || 0
          break
        case 'created_at':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
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
  }, [services, activeTab, searchTerm, statusFilter, typeFilter, priceRangeFilter, sortBy, sortOrder])

  const handleEditService = (service: Service) => {
    setSelectedService(service)
    setShowEditDialog(true)
  }

  const handleDeleteService = (service: Service) => {
    setServiceToDelete(service)
    setShowDeleteDialog(true)
  }

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return

    try {
      const { error } = await supabase
        .from('crm_services')
        .delete()
        .eq('id', serviceToDelete.id)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Servizio eliminato con successo",
      })
      refreshServices()
    } catch (error: any) {
      console.error('Error deleting service:', error)
      toast({
        title: "Errore",
        description: "Impossibile eliminare il servizio",
        variant: "destructive",
      })
    } finally {
      setShowDeleteDialog(false)
      setServiceToDelete(null)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setTypeFilter("all")
    setPriceRangeFilter("all")
    setSortBy("name")
    setSortOrder("asc")
  }

  // Statistiche calcolate sui risultati filtrati
  const stats = useMemo(() => {
    const filtered = filteredAndSortedServices
    const all = services
    
    return {
      total: filtered.length,
      active: filtered.filter(s => s.is_active).length,
      inactive: filtered.filter(s => !s.is_active).length,
      simple: filtered.filter(s => s.service_type === 'simple').length,
      composed: filtered.filter(s => s.service_type === 'composed').length,
      withPrice: filtered.filter(s => s.unit_price && s.unit_price > 0).length,
      totalValue: filtered.reduce((sum, s) => sum + (s.unit_price || 0), 0),
      avgPrice: filtered.length > 0 
        ? filtered.reduce((sum, s) => sum + (s.unit_price || 0), 0) / filtered.filter(s => s.unit_price).length
        : 0,
      totalUsage: filtered.reduce((sum, s) => sum + (s.usage_count || 0), 0)
    }
  }, [filteredAndSortedServices, services])

  if (loading) {
    return <div className="p-6">Caricamento...</div>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Servizi</h1>
          <p className="text-muted-foreground">
            Gestisci la distinta base dei servizi - {filteredAndSortedServices.length} di {services.length} servizi
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Servizio
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
                placeholder="Cerca per nome, codice, descrizione, componenti..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filtro status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="active">Attivi</SelectItem>
                <SelectItem value="inactive">Inattivi</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro tipo */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="simple">Semplici</SelectItem>
                <SelectItem value="composed">Composti</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro prezzo */}
            <Select value={priceRangeFilter} onValueChange={setPriceRangeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Prezzo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i prezzi</SelectItem>
                <SelectItem value="0-100">€0 - €100</SelectItem>
                <SelectItem value="100-500">€100 - €500</SelectItem>
                <SelectItem value="500-1000">€500 - €1000</SelectItem>
                <SelectItem value="1000+">€1000+</SelectItem>
                <SelectItem value="no_price">Senza prezzo</SelectItem>
              </SelectContent>
            </Select>

            {/* Ordinamento */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="code">Codice</SelectItem>
                <SelectItem value="unit_price">Prezzo</SelectItem>
                <SelectItem value="service_type">Tipo</SelectItem>
                <SelectItem value="usage_count">Utilizzo</SelectItem>
                <SelectItem value="created_at">Data Creazione</SelectItem>
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
            {(searchTerm || statusFilter !== "all" || typeFilter !== "all" || priceRangeFilter !== "all" || sortBy !== "name" || sortOrder !== "asc") && (
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
            <CardTitle className="text-sm font-medium">Servizi Totali</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} attivi, {stats.inactive} inattivi
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipologie</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.simple} / {stats.composed}</div>
            <p className="text-xs text-muted-foreground">
              Semplici / Composti
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prezzo Medio</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{Math.round(stats.avgPrice || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.withPrice} servizi con prezzo
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilizzo Totale</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalUsage}</div>
            <p className="text-xs text-muted-foreground">
              Nelle opportunità create
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs per tipologie */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Tutti ({stats.total})</TabsTrigger>
          <TabsTrigger value="simple">Semplici ({stats.simple})</TabsTrigger>
          <TabsTrigger value="composed">Composti ({stats.composed})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Lista servizi */}
          {filteredAndSortedServices.length === 0 ? (
            <Card>
              <CardHeader className="text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle>
                  {services.length === 0 ? "Nessun servizio trovato" : "Nessun risultato"}
                </CardTitle>
                <CardDescription>
                  {services.length === 0 
                    ? "Inizia creando il tuo primo servizio nella distinta base"
                    : "Nessun servizio corrisponde ai criteri di ricerca"
                  }
                </CardDescription>
              </CardHeader>
              {services.length === 0 && (
                <CardContent className="text-center">
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crea Primo Servizio
                  </Button>
                </CardContent>
              )}
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedServices.map((service) => (
                <Card key={service.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{service.name}</CardTitle>
                        <CardDescription>Codice: {service.code}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEditService(service)}
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
                              <AlertDialogTitle>Eliminare il servizio?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sei sicuro di voler eliminare il servizio "{service.name}"? 
                                Questa azione non può essere annullata e potrebbe influenzare le opportunità esistenti.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteService(service)}>
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    {/* Badges */}
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={service.service_type === 'simple' ? "default" : "secondary"}>
                        {service.service_type === 'simple' ? 'Semplice' : 'Composto'}
                      </Badge>
                      <Badge variant={service.is_active ? "outline" : "destructive"}>
                        {service.is_active ? "Attivo" : "Inattivo"}
                      </Badge>
                      {(service.usage_count || 0) > 0 && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          {service.usage_count} utilizzi
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    {service.description && (
                      <p className="text-sm text-muted-foreground">
                        {service.description.length > 100 
                          ? `${service.description.substring(0, 100)}...`
                          : service.description
                        }
                      </p>
                    )}
                    
                    {/* Prezzo e unità di misura */}
                    <div className="flex justify-between items-center">
                      <div>
                        {service.unit_price ? (
                          <div className="text-lg font-bold">€{service.unit_price.toFixed(2)}</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Prezzo non definito</div>
                        )}
                        {service.unit_of_measure && (
                          <div className="text-xs text-muted-foreground">per {service.unit_of_measure}</div>
                        )}
                      </div>
                    </div>
                    
                    {/* Componenti per servizi composti */}
                    {service.service_type === 'composed' && service.components && service.components.length > 0 && (
                      <div className="border-t pt-3">
                        <h4 className="text-sm font-medium mb-2">Componenti:</h4>
                        <div className="space-y-1">
                          {service.components.slice(0, 3).map((component) => (
                            <div key={component.id} className="flex justify-between text-xs text-muted-foreground">
                              <span className="truncate">{component.child_service_name}</span>
                              <span>×{component.quantity}</span>
                            </div>
                          ))}
                          {service.components.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              ...e altri {service.components.length - 3} componenti
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Dialogs */}
      <AddServiceDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onServiceAdded={refreshServices}
      />

      <EditServiceDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog}
        service={selectedService}
        onServiceUpdated={refreshServices}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare il servizio "{serviceToDelete?.name}"? 
              Questa azione non può essere annullata e potrebbe influenzare le opportunità esistenti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteService}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
