import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Package, Settings, DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Services() {
  const [services] = useState([])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Servizi</h1>
          <p className="text-muted-foreground">Gestisci la distinta base dei servizi</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Servizio
        </Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Tutti</TabsTrigger>
          <TabsTrigger value="simple">Servizi Semplici</TabsTrigger>
          <TabsTrigger value="composed">Servizi Composti</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {services.length === 0 ? (
            <Card>
              <CardHeader className="text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle>Nessun servizio trovato</CardTitle>
                <CardDescription>
                  Inizia creando il tuo primo servizio nella distinta base
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Crea Primo Servizio
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service: any) => (
                <Card key={service.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{service.name}</CardTitle>
                        <CardDescription>Codice: {service.code}</CardDescription>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge variant={service.service_type === 'simple' ? "default" : "secondary"}>
                          {service.service_type === 'simple' ? 'Semplice' : 'Composto'}
                        </Badge>
                        <Badge variant={service.is_active ? "outline" : "destructive"}>
                          {service.is_active ? "Attivo" : "Inattivo"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {service.description && (
                      <p className="text-sm text-muted-foreground">
                        {service.description}
                      </p>
                    )}
                    {service.unit_price && (
                      <div className="flex items-center text-sm">
                        <DollarSign className="mr-1 h-4 w-4 text-green-600" />
                        <span className="font-medium">
                          €{service.unit_price} / {service.unit_of_measure}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm">
                        <Settings className="mr-1 h-4 w-4" />
                        Modifica
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="simple">
          <p className="text-muted-foreground">Servizi semplici - unità base della distinta base</p>
        </TabsContent>

        <TabsContent value="composed">
          <p className="text-muted-foreground">Servizi composti - combinazioni di servizi semplici o altri servizi composti</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}