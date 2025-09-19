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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    companies: 0,
    contacts: 0,
    services: 0,
    orders: 0
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

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
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount: number | null) => {
    if (!amount) return "€0"
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'in_progress': return 'text-blue-600'
      case 'draft': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completata'
      case 'in_progress': return 'In corso'
      case 'draft': return 'Bozza'
      default: return status
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Panoramica generale del tuo CRM</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              Aziende nel database
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
            <p className="text-sm text-muted-foreground">Nessuna attività recente</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}