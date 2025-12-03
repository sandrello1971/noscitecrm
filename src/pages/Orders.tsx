import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Plus, ShoppingCart, Calendar, User, DollarSign, BarChart3, Edit, Trash2, Search, X, Clock, CheckCircle, Pause, AlertCircle, XCircle } from "lucide-react"
import { AddOrderDialog } from "@/components/forms/AddOrderDialog"
import { EditOrderDialog } from "@/components/forms/EditOrderDialog"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

interface OrderService {
  id: string
  service_id: string
  quantity: number
  unit_price: number
  total_price: number
  notes?: string
  service_name?: string
}

interface Order {
  id: string
  order_number: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  start_date?: string
  end_date?: string
  estimated_hours?: number
  actual_hours?: number
  total_amount?: number
  progress_percentage?: number
  notes?: string
  company_id?: string
  company_name?: string
  parent_order_id?: string
  parent_order_title?: string
  assigned_user_id?: string
  created_at: string
  services?: OrderService[]
  sub_orders_count?: number
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Stati per ricerca e filtri
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [progressFilter, setProgressFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("created_at")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [activeTab, setActiveTab] = useState("all")
  const [companies, setCompanies] = useState<{id: string, name: string}[]>([])
  
  const { toast } = useToast()
  const { isAdmin } = useAuth()

  const loadOrders = async () => {
    try {
      setLoading(true)
      
      // Query semplificata per le commesse con solo le aziende
      let query = supabase
        .from('crm_orders')
        .select(`
          *,
          crm_companies(id, name)
        `)

      // Filtra per admin se necessario
      if (!isAdmin) {
        query = query.eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      }

      const { data: ordersData, error: ordersError } = await query.order('created_at', { ascending: false })

      if (ordersError) {
        console.error('Orders error:', ordersError)
        throw ordersError
      }

      // Per ora iniziamo senza i servizi e le sotto-commesse per testare
      const mappedData = ordersData?.map(order => ({
        ...order,
        status: order.status as "active" | "draft" | "completed" | "on_hold" | "cancelled",
        priority: order.priority as "low" | "medium" | "high" | "urgent",
        company_name: order.crm_companies?.name,
        parent_order_title: undefined, // TODO: Aggiungere dopo
        services: [], // TODO: Aggiungere dopo
        sub_orders_count: 0 // TODO: Aggiungere dopo
      })) || []

      console.log('Loaded orders:', mappedData)
      setOrders(mappedData)
    } catch (error: any) {
      console.error('Error loading orders:', error)
      toast({
        title: "Errore",
        description: `Impossibile caricare le commesse: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      let query = supabase
        .from('crm_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (!isAdmin) {
        query = query.eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      }

      const { data, error } = await query

      if (error) {
        console.error('Companies error:', error)
        throw error
      }
      
      console.log('Loaded companies:', data)
      setCompanies(data || [])
    } catch (error) {
      console.error('Error loading companies:', error)
      // Non blocchiamo il caricamento delle commesse per un errore delle aziende
    }
  }

  useEffect(() => {
    loadOrders()
    loadCompanies()
  }, [isAdmin])

  // Filtro e ricerca delle commesse
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = orders

    // Filtro per tab attivo
    if (activeTab !== "all") {
      filtered = filtered.filter(order => order.status === activeTab)
    }

    // Filtro per ricerca
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(order => 
        order.title.toLowerCase().includes(search) ||
        order.order_number.toLowerCase().includes(search) ||
        order.description?.toLowerCase().includes(search) ||
        order.company_name?.toLowerCase().includes(search) ||
        order.parent_order_title?.toLowerCase().includes(search) ||
        order.notes?.toLowerCase().includes(search) ||
        order.services?.some(service => 
          service.service_name?.toLowerCase().includes(search)
        )
      )
    }

    // Filtro per status (ridondante con i tab, ma utile per ricerche globali)
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    // Filtro per priorità
    if (priorityFilter !== "all") {
      filtered = filtered.filter(order => order.priority === priorityFilter)
    }

    // Filtro per azienda
    if (companyFilter !== "all") {
      filtered = filtered.filter(order => order.company_id === companyFilter)
    }

    // Filtro per progresso
    if (progressFilter !== "all") {
      filtered = filtered.filter(order => {
        const progress = order.progress_percentage || 0
        switch (progressFilter) {
          case "not_started":
            return progress === 0
          case "in_progress":
            return progress > 0 && progress < 100
          case "completed":
            return progress === 100
          default:
            return true
        }
      })
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'order_number':
          aValue = a.order_number.toLowerCase()
          bValue = b.order_number.toLowerCase()
          break
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'company':
          aValue = a.company_name?.toLowerCase() || ''
          bValue = b.company_name?.toLowerCase() || ''
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'priority':
          const priorityOrder = { low: 1, medium: 2, high: 3, urgent: 4 }
          aValue = priorityOrder[a.priority] || 0
          bValue = priorityOrder[b.priority] || 0
          break
        case 'total_amount':
          aValue = a.total_amount || 0
          bValue = b.total_amount || 0
          break
        case 'progress_percentage':
          aValue = a.progress_percentage || 0
          bValue = b.progress_percentage || 0
          break
        case 'start_date':
          aValue = a.start_date ? new Date(a.start_date).getTime() : 0
          bValue = b.start_date ? new Date(b.start_date).getTime() : 0
          break
        case 'end_date':
          aValue = a.end_date ? new Date(a.end_date).getTime() : 0
          bValue = b.end_date ? new Date(b.end_date).getTime() : 0
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
  }, [orders, activeTab, searchTerm, statusFilter, priorityFilter, companyFilter, progressFilter, sortBy, sortOrder])

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order)
    setShowEditDialog(true)
  }

  const handleDeleteOrder = (order: Order) => {
    setOrderToDelete(order)
    setShowDeleteDialog(true)
  }

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return

    try {
      const { error } = await supabase
        .from('crm_orders')
        .delete()
        .eq('id', orderToDelete.id)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Commessa eliminata con successo",
      })
      loadOrders()
    } catch (error: any) {
      console.error('Error deleting order:', error)
      toast({
        title: "Errore",
        description: "Impossibile eliminare la commessa",
        variant: "destructive",
      })
    } finally {
      setShowDeleteDialog(false)
      setOrderToDelete(null)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setPriorityFilter("all")
    setCompanyFilter("all")
    setProgressFilter("all")
    setSortBy("created_at")
    setSortOrder("desc")
  }

  const getStatusBadge = (status: string) => {
    const config = {
      'draft': { variant: 'secondary' as const, icon: Clock, label: 'Bozza', className: undefined },
      'active': { variant: 'default' as const, icon: CheckCircle, label: 'Attiva', className: undefined },
      'on_hold': { variant: 'outline' as const, icon: Pause, label: 'In Sospeso', className: undefined },
      'completed': { variant: 'default' as const, icon: CheckCircle, label: 'Completata', className: 'bg-green-600' },
      'cancelled': { variant: 'destructive' as const, icon: XCircle, label: 'Annullata', className: undefined }
    }

    const statusConfig = config[status as keyof typeof config] || config.draft
    const { variant, icon: Icon, label, className } = statusConfig

    return (
      <Badge variant={variant} className={className || ''}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const config = {
      'low': { variant: 'secondary' as const, label: 'Bassa' },
      'medium': { variant: 'outline' as const, label: 'Media' },
      'high': { variant: 'default' as const, label: 'Alta' },
      'urgent': { variant: 'destructive' as const, label: 'Urgente' }
    }

    const { variant, label } = config[priority as keyof typeof config] || config.medium

    return <Badge variant={variant}>{label}</Badge>
  }

  // Statistiche calcolate su TUTTI gli ordini (non filtrati)
  const stats = useMemo(() => {
    return {
      total: orders.length,
      draft: orders.filter(o => o.status === 'draft').length,
      active: orders.filter(o => o.status === 'active').length,
      completed: orders.filter(o => o.status === 'completed').length,
      onHold: orders.filter(o => o.status === 'on_hold').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      totalValue: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      avgProgress: orders.length > 0 
        ? Math.round(orders.reduce((sum, o) => sum + (o.progress_percentage || 0), 0) / orders.length)
        : 0,
      totalHours: orders.reduce((sum, o) => sum + (o.actual_hours || 0), 0),
      estimatedHours: orders.reduce((sum, o) => sum + (o.estimated_hours || 0), 0)
    }
  }, [orders])

  if (loading) {
    return <div className="p-6">Caricamento...</div>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Commesse</h1>
          <p className="text-muted-foreground">
            Gestisci le commesse con struttura gerarchica - {filteredAndSortedOrders.length} di {orders.length} commesse
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova Commessa
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
                placeholder="Cerca per numero, titolo, descrizione, azienda, servizi..."
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
                <SelectItem value="draft">Bozze</SelectItem>
                <SelectItem value="active">Attive</SelectItem>
                <SelectItem value="on_hold">In Sospeso</SelectItem>
                <SelectItem value="completed">Completate</SelectItem>
                <SelectItem value="cancelled">Annullate</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro priorità */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priorità" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="low">Bassa</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro azienda */}
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Azienda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le aziende</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro progresso */}
            <Select value={progressFilter} onValueChange={setProgressFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Progresso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="not_started">Non iniziate</SelectItem>
                <SelectItem value="in_progress">In corso</SelectItem>
                <SelectItem value="completed">Complete</SelectItem>
              </SelectContent>
            </Select>

            {/* Ordinamento */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Data Creazione</SelectItem>
                <SelectItem value="order_number">Numero</SelectItem>
                <SelectItem value="title">Titolo</SelectItem>
                <SelectItem value="company">Azienda</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="priority">Priorità</SelectItem>
                <SelectItem value="total_amount">Valore</SelectItem>
                <SelectItem value="progress_percentage">Progresso</SelectItem>
                <SelectItem value="start_date">Data Inizio</SelectItem>
                <SelectItem value="end_date">Data Fine</SelectItem>
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
            {(searchTerm || statusFilter !== "all" || priorityFilter !== "all" || companyFilter !== "all" || progressFilter !== "all" || sortBy !== "created_at" || sortOrder !== "desc") && (
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
            <CardTitle className="text-sm font-medium">Commesse Totali</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} attive, {stats.completed} completate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stats.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Valore commesse filtrate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progresso Medio</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgProgress}%</div>
            <p className="text-xs text-muted-foreground">
              Media avanzamento lavori
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ore Lavorate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours}h</div>
            <p className="text-xs text-muted-foreground">
              su {stats.estimatedHours}h stimate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs per status */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Tutte ({stats.total})</TabsTrigger>
          <TabsTrigger value="active">Attive ({stats.active})</TabsTrigger>
          <TabsTrigger value="completed">Completate ({stats.completed})</TabsTrigger>
          <TabsTrigger value="draft">Bozze ({stats.draft})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Lista commesse */}
          {filteredAndSortedOrders.length === 0 ? (
            <Card>
              <CardHeader className="text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle>
                  {orders.length === 0 ? "Nessuna commessa trovata" : "Nessun risultato"}
                </CardTitle>
                <CardDescription>
                  {orders.length === 0 
                    ? "Inizia creando la tua prima commessa"
                    : "Nessuna commessa corrisponde ai criteri di ricerca"
                  }
                </CardDescription>
              </CardHeader>
              {orders.length === 0 && (
                <CardContent className="text-center">
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crea Prima Commessa
                  </Button>
                </CardContent>
              )}
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredAndSortedOrders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-lg">{order.title}</CardTitle>
                          <Badge variant="outline">{order.order_number}</Badge>
                        </div>
                        <CardDescription>
                          Cliente: {order.company_name}
                          {order.parent_order_title && (
                            <span className="ml-2">• Sotto-commessa di: {order.parent_order_title}</span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditOrder(order)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminare la commessa?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sei sicuro di voler eliminare la commessa "{order.title}"? 
                                Questa azione non può essere annullata e rimuoverà anche tutti i servizi associati.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => {
                                  try {
                                    // Prima elimina i servizi associati
                                    await supabase
                                      .from('crm_order_services')
                                      .delete()
                                      .eq('order_id', order.id)
                                    
                                    // Poi elimina la commessa
                                    const { error } = await supabase
                                      .from('crm_orders')
                                      .delete()
                                      .eq('id', order.id)

                                    if (error) throw error

                                    toast({
                                      title: "Successo",
                                      description: "Commessa eliminata con successo",
                                    })
                                    loadOrders()
                                  } catch (error: any) {
                                    console.error('Error deleting order:', error)
                                    toast({
                                      title: "Errore",
                                      description: "Impossibile eliminare la commessa",
                                      variant: "destructive",
                                    })
                                  }
                                }}
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    {/* Status e Priority */}
                    <div className="flex flex-wrap gap-2">
                      {getStatusBadge(order.status)}
                      {getPriorityBadge(order.priority)}
                      {(order.sub_orders_count || 0) > 0 && (
                        <Badge variant="outline">
                          {order.sub_orders_count} sotto-commesse
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {order.description && (
                      <p className="text-sm text-muted-foreground">
                        {order.description.length > 200 
                          ? `${order.description.substring(0, 200)}...`
                          : order.description
                        }
                      </p>
                    )}
                    
                    {/* Informazioni temporali e finanziarie */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {order.start_date && (
                        <div className="flex items-center text-muted-foreground">
                          <Calendar className="mr-1 h-4 w-4" />
                          Inizio: {new Date(order.start_date).toLocaleDateString('it-IT')}
                        </div>
                      )}
                      {order.end_date && (
                        <div className="flex items-center text-muted-foreground">
                          <Calendar className="mr-1 h-4 w-4" />
                          Fine: {new Date(order.end_date).toLocaleDateString('it-IT')}
                        </div>
                      )}
                      {order.total_amount && (
                        <div className="flex items-center text-muted-foreground">
                          <DollarSign className="mr-1 h-4 w-4" />
                          €{order.total_amount.toLocaleString()}
                        </div>
                      )}
                      {(order.estimated_hours || order.actual_hours) && (
                        <div className="flex items-center text-muted-foreground">
                          <Clock className="mr-1 h-4 w-4" />
                          {order.actual_hours || 0}h / {order.estimated_hours || 0}h
                        </div>
                      )}
                    </div>

                    {/* Barra di progresso */}
                    {order.progress_percentage !== undefined && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center">
                            <BarChart3 className="mr-1 h-4 w-4" />
                            Progresso
                          </span>
                          <span>{order.progress_percentage}%</span>
                        </div>
                        <Progress value={order.progress_percentage} className="h-2" />
                      </div>
                    )}

                    {/* Servizi associati */}
                    {order.services && order.services.length > 0 && (
                      <div className="border-t pt-3">
                        <h4 className="text-sm font-medium mb-2">Servizi:</h4>
                        <div className="space-y-1">
                          {order.services.slice(0, 3).map((service) => (
                            <div key={service.id} className="flex justify-between text-sm text-muted-foreground">
                              <span className="truncate">{service.service_name}</span>
                              <span>×{service.quantity} - €{service.total_price.toFixed(2)}</span>
                            </div>
                          ))}
                          {order.services.length > 3 && (
                            <div className="text-sm text-muted-foreground">
                              ...e altri {order.services.length - 3} servizi
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {order.notes && (
                      <div className="border-t pt-3">
                        <p className="text-sm text-muted-foreground italic">
                          {order.notes.length > 150 
                            ? `${order.notes.substring(0, 150)}...`
                            : order.notes
                          }
                        </p>
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
      <AddOrderDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onOrderAdded={loadOrders}
      />

      <EditOrderDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog}
        order={selectedOrder}
        onOrderUpdated={loadOrders}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare la commessa "{orderToDelete?.title}"? 
              Questa azione non può essere annullata e rimuoverà anche tutti i servizi e le sotto-commesse associate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteOrder}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
