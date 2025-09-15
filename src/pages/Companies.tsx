import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Building2, Mail, Phone, Globe } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AddCompanyDialog } from "@/components/forms/AddCompanyDialog"

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [showAddDialog, setShowAddDialog] = useState(false)

  useEffect(() => {
    async function fetchCompanies() {
      const { data } = await supabase
        .from('crm_companies')
        .select('*')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('name')
      
      if (data) setCompanies(data)
    }
    
    fetchCompanies()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Aziende</h1>
          <p className="text-muted-foreground">Gestisci l'anagrafica delle aziende clienti</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova Azienda
        </Button>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle>Nessuna azienda trovata</CardTitle>
            <CardDescription>
              Inizia aggiungendo la tua prima azienda cliente
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Aggiungi Prima Azienda
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company: any) => (
            <Card key={company.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{company.name}</CardTitle>
                  <div className="flex flex-col gap-1">
                    <Badge variant={company.is_active ? "default" : "secondary"}>
                      {company.is_active ? "Attiva" : "Inattiva"}
                    </Badge>
                    {company.is_partner && (
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        Partner
                      </Badge>
                    )}
                  </div>
                </div>
                {company.vat_number && (
                  <CardDescription>P.IVA: {company.vat_number}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {company.email && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="mr-2 h-4 w-4" />
                    {company.email}
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="mr-2 h-4 w-4" />
                    {company.phone}
                  </div>
                )}
                {company.website && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Globe className="mr-2 h-4 w-4" />
                    {company.website}
                  </div>
                )}
                {company.city && (
                  <div className="text-sm text-muted-foreground">
                    📍 {company.city}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <AddCompanyDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onCompanyAdded={() => {
          // Refresh companies list  
          window.location.reload()
        }}
      />
    </div>
  )
}