import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, ShoppingCart, Calendar, User, DollarSign, BarChart3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Orders() {
  const [orders] = useState([])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'draft': 'secondary',
      'active': 'default',
      'on_hold': 'outline',
      'completed': 'default',
      'cancelled': 'destructive'
    }
    
    const labels: Record<string, string> = {
      'draft': 'Bozza',
      'active': 'Attiva',
      'on_hold': 'In Sospeso',
      'completed': 'Completata',
      'cancelled': 'Annullata'
    }

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'low': 'secondary',
      'medium': 'outline',
      'high': 'default',
      'urgent': 'destructive'
    }
    
    const labels: Record<string, string> = {
      'low': 'Bassa',
      'medium': 'Media',
      'high': 'Alta',
      'urgent': 'Urgente'
    }

    return (
      <Badge variant={variants[priority] || 'secondary'}>
        {labels[priority] || priority}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Commesse</h1>
          <p className="text-muted-foreground">Gestisci le commesse con struttura gerarchica</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nuova Commessa
        </Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Tutte</TabsTrigger>
          <TabsTrigger value="active">Attive</TabsTrigger>
          <TabsTrigger value="completed">Completate</TabsTrigger>
          <TabsTrigger value="draft">Bozze</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {orders.length === 0 ? (
            <Card>
              <CardHeader className="text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle>Nessuna commessa trovata</CardTitle>
                <CardDescription>
                  Inizia creando la tua prima commessa di lavoro
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Crea Prima Commessa
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order: any) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{order.title}</CardTitle>
                          {order.parent_order_id && (
                            <Badge variant="outline" className="text-xs">Sub-commessa</Badge>
                          )}
                        </div>
                        <CardDescription>
                          #{order.order_number} • {order.company?.name}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(order.status)}
                        {getPriorityBadge(order.priority)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {order.description && (
                      <p className="text-sm text-muted-foreground">
                        {order.description}
                      </p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {order.start_date && (
                        <div className="flex items-center text-muted-foreground">
                          <Calendar className="mr-1 h-4 w-4" />
                          Inizio: {new Date(order.start_date).toLocaleDateString()}
                        </div>
                      )}
                      {order.end_date && (
                        <div className="flex items-center text-muted-foreground">
                          <Calendar className="mr-1 h-4 w-4" />
                          Fine: {new Date(order.end_date).toLocaleDateString()}
                        </div>
                      )}
                      {order.assigned_user && (
                        <div className="flex items-center text-muted-foreground">
                          <User className="mr-1 h-4 w-4" />
                          Assegnato a: {order.assigned_user.name}
                        </div>
                      )}
                      {order.total_amount && (
                        <div className="flex items-center text-muted-foreground">
                          <DollarSign className="mr-1 h-4 w-4" />
                          €{order.total_amount}
                        </div>
                      )}
                    </div>

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

                    {order.estimated_hours && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Ore stimate: {order.estimated_hours}h</span>
                        {order.actual_hours && (
                          <span>Ore effettive: {order.actual_hours}h</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="active">
          <p className="text-muted-foreground">Commesse attualmente in corso</p>
        </TabsContent>

        <TabsContent value="completed">
          <p className="text-muted-foreground">Commesse completate</p>
        </TabsContent>

        <TabsContent value="draft">
          <p className="text-muted-foreground">Bozze di commesse</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}