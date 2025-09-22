import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, Package, ShoppingCart } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"

interface DashboardStats {
  companies: number
  contacts: number
  services: number
  orders: number
}

interface RecentOrder {
  id: string
  title: string
  status: string
  created_at: string
  total_amount: number
}

interface RecentActivity {
  id: string
  type: 'opportunity' | 'order' | 'company' | 'service'
  action: 'created' | 'updated' | 'deleted'
  title: string
  created_at: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    companies: 0,
    contacts: 0,
    services: 0,
    orders: 0
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchRecentActivities = async (isAdmin: boolean, userId: string) => {
    try {
      const activities: RecentActivity[] = []

      // 1. Opportunità recenti
      let opportunitiesQuery = supabase
        .from('opportunities')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10)

      if (!isAdmin) {
        opportunitiesQuery = opportunitiesQuery.eq('user_id', userId)
      }

      const { data: opportunities } = await opportunitiesQuery
      opportunities?.forEach(opp => {
        activities.push({
          id: `opp-${opp.id}`,
          type: 'opportunity',
          action: 'updated',
          title: opp.title,
          created_at: opp.updated_at
        })
      })

      // 2. Commesse recenti
      let ordersQuery = supabase
        .from('crm_orders')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10)

      if (!isAdmin) {
        ordersQuery = ordersQuery.eq('user_id', userId)
      }

      const { data: orders } = await ordersQuery
      orders?.forEach(order => {
        activities.push({
          id: `order-${order.id}`,
          type: 'order',
          action: 'updated',
          title: order.title,
          created_at: order.updated_at
        })
      })

      // 3. Aziende recenti
      let companiesQuery = supabase
        .from('crm_companies')
        .select('id, name, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10)

      if (!isAdmin) {
        companiesQuery = companiesQuery.eq('user_id', userId)
      }

      const { data: companies } = await companiesQuery
      companies?.forEach(company => {
        activities.push({
          id: `company-${company.id}`,
          type: 'company',
          action: 'updated',
          title: company.name,
          created_at: company.updated_at
        })
      })

      // 4. Servizi recenti
      let servicesQuery = supabase
        .from('crm_services')
        .select('id, name, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10)

      if (!isAdmin) {
        servicesQuery = servicesQuery.eq('user_id', userId)
      }

      const { data: services } = await servicesQuery
      services?.forEach(service => {
        activities.push({
          id: `service-${service.id}`,
          type: 'service',
          action: 'updated',
          title: service.name,
          created_at: service.updated_at
        })
      })

      // Ordina tutte le attività per data e prendi le prime 10
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setRecentActivities(activities.slice(0, 10))

    } catch (error) {
      console.error('Error fetching recent activities:', error)
    }
  }

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if user is admin
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      const isAdmin = userRole?.role === 'admin'

      // Build queries - admins see all data, users see only their own
      const companiesQuery = supabase.from('crm_companies').select('id', { count: 'exact' })
      const contactsQuery = supabase.from('crm_contacts').select('id', { count: 'exact' }).eq('is_active', true)
      const servicesQuery = supabase.from('crm_services').select('id', { count: 'exact' }).eq('is_active', true)
      const ordersQuery = supabase.from('crm_orders').select('id', { count: 'exact' })

      if (!isAdmin) {
        companiesQuery.eq('user_id', user.id)
        contactsQuery.eq('user_id', user.id)
        servicesQuery.eq('user_id', user.id)
        ordersQuery.eq('user_id', user.id)
      }

      // Fetch stats in parallel
      const [companiesResult, contactsResult, servicesResult, ordersResult] = await Promise.all([
        companiesQuery,
        contactsQuery,
        servicesQuery,
        ordersQuery
      ])

      setStats({
        companies: companiesResult.count || 0,
        contacts: contactsResult.count || 0,
        services: servicesResult.count || 0,
        orders: ordersResult.count || 0
      })

      // Fetch recent orders
      let ordersDataQuery = supabase
        .from('crm_orders')
        .select('id, title, status, created_at, total_amount')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!isAdmin) {
        ordersDataQuery = ordersDataQuery.eq('user_id', user.id)
      }

      const { data: ordersData } = await ordersDataQuery
      setRecentOrders(ordersData || [])

      // Fetch recent activities
      await fetchRecentActivities(isAdmin, user.id)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('it-IT', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAmount = (amount: number | null) => {
    if (!amount) return '€0'
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-gray-600'
      case 'active':
        return 'text-blue-600'
      case 'on_hold':
        return 'text-yellow-600'
      case 'completed':
        return 'text-green-600'
      case 'cancelled':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Bozza'
      case 'active':
        return 'Attiva'
      case 'on_hold':
        return 'In Pausa'
      case 'completed':
        return 'Completata'
      case 'cancelled':
        return 'Annullata'
      default:
        return status
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return '💼'
      case 'order':
        return '📦'
      case 'company':
        return '🏢'
      case 'service':
        return '⚙️'
      default:
        return '📝'
    }
  }

  const getActivityText = (activity: RecentActivity) => {
    const actionText = activity.action === 'created' ? 'creato' : 
                       activity.action === 'updated' ? 'aggiornato' : 'eliminato'
    const typeText = activity.type === 'opportunity' ? 'Opportunità' :
                     activity.type === 'order' ? 'Commessa' :
                     activity.type === 'company' ? 'Azienda' : 'Servizio'
    
    return `${typeText} ${actionText}`
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Panoramica generale del sistema CRM
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aziende</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.companies}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Aziende registrate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contatti</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.contacts}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Contatti attivi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servizi</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.services}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Servizi configurati
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commesse</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.orders}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Commesse attive
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders and Activities */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Commesse Recenti</CardTitle>
            <CardDescription>Le ultime commesse create</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{order.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(order.created_at)} • <span className={getStatusColor(order.status)}>{getStatusText(order.status)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatAmount(order.total_amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna commessa trovata</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attività Recenti</CardTitle>
            <CardDescription>Le ultime modifiche al sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentActivities.length > 0 ? (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className="text-xl">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {getActivityText(activity)} • {formatDate(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna attività recente</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
