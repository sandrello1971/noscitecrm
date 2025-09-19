import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Building2, Mail, Phone, Globe, Edit, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AddCompanyDialog } from "@/components/forms/AddCompanyDialog"
import { EditCompanyDialog } from "@/components/forms/EditCompanyDialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<any>(null)
  const { toast } = useToast()
  const { isAdmin } = useAuth()

  const refreshCompanies = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Use isAdmin from AuthContext instead of checking again
    console.log('Current user:', user.email, 'isAdmin from context:', isAdmin)

    // Build query - admins see all data, users see only their own
    let query = supabase
      .from('crm_companies')
      .select('*')

    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    }

    console.log('Query will be filtered by user_id:', !isAdmin)
    const { data } = await query.order('name')
    console.log('Companies data:', data)
    
    if (data) setCompanies(data)
  }

  const handleEditCompany = (company: any) => {
    setSelectedCompany(company)
    setShowEditDialog(true)
  }

  const handleDeleteCompany = (company: any) => {
    setCompanyToDelete(company)
    setShowDeleteDialog(true)
  }

  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return

    const { error } = await supabase
      .from('crm_companies')
      .delete()
      .eq('id', companyToDelete.id)

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'azienda",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Successo",
        description: "Azienda eliminata con successo",
      })
      refreshCompanies()
    }

    setShowDeleteDialog(false)
    setCompanyToDelete(null)
  }

  useEffect(() => {
    refreshCompanies()
  }, [isAdmin])

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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditCompany(company)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteCompany(company)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
                {(company.city || company.province) && (
                  <div className="text-sm text-muted-foreground">
                    📍 {[company.city, company.province ? `(${company.province})` : null].filter(Boolean).join(' ')}
                    {company.postal_code && ` - ${company.postal_code}`}
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
        onCompanyAdded={refreshCompanies}
      />

      <EditCompanyDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog}
        company={selectedCompany}
        onCompanyUpdated={refreshCompanies}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare l'azienda "{companyToDelete?.name}"? 
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCompany}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}