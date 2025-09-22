import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Building2, Edit, Trash2, Mail, Phone, Globe, Plus, Search, X, Users, Briefcase } from "lucide-react"
import { AddCompanyDialog } from "@/components/forms/AddCompanyDialog"
import { EditCompanyDialog } from "@/components/forms/EditCompanyDialog"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

interface Company {
  id: string
  name: string
  vat_number?: string
  tax_code?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  postal_code?: string
  country?: string
  notes?: string
  is_active: boolean
  is_partner?: boolean
  created_at: string
  contacts_count?: number
  opportunities_count?: number
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Stati per ricerca e filtri
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("name")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  const { toast } = useToast()
  const { isAdmin } = useAuth()

  // Alternativa più affidabile - Sostituisci la funzione refreshCompanies

const refreshCompanies = async () => {
  try {
    setLoading(true)
    
    // Prima ottieni le aziende
    let companiesQuery = supabase
      .from('crm_companies')
      .select('*')

    // Filtra per admin se necessario
    if (!isAdmin) {
      companiesQuery = companiesQuery.eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    }

    const { data: companiesData, error: companiesError } = await companiesQuery.order('name')

    if (companiesError) throw companiesError

    // Poi ottieni i conteggi per ogni azienda
    const mappedData = await Promise.all(
      (companiesData || []).map(async (company) => {
        // Conta i contatti per questa specifica azienda
        const { count: contactsCount } = await supabase
          .from('crm_contacts')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)

        // Conta le opportunità per questa specifica azienda  
        const { count: opportunitiesCount } = await supabase
          .from('opportunities')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)

        return {
          ...company,
          contacts_count: contactsCount || 0,
          opportunities_count: opportunitiesCount || 0
        }
      })
    )

    console.log('Loaded companies with correct counts:', mappedData)
    setCompanies(mappedData)
  } catch (error: any) {
    console.error('Error loading companies:', error)
    toast({
      title: "Errore", 
      description: "Impossibile caricare le aziende",
      variant: "destructive"
    })
  } finally {
    setLoading(false)
  }
}

  // Filtro e ricerca delle aziende
  const filteredAndSortedCompanies = useMemo(() => {
    let filtered = companies

    // Filtro per ricerca
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(company => 
        company.name.toLowerCase().includes(search) ||
        company.vat_number?.toLowerCase().includes(search) ||
        company.tax_code?.toLowerCase().includes(search) ||
        company.email?.toLowerCase().includes(search) ||
        company.phone?.toLowerCase().includes(search) ||
        company.website?.toLowerCase().includes(search) ||
        company.city?.toLowerCase().includes(search) ||
        company.address?.toLowerCase().includes(search) ||
        company.notes?.toLowerCase().includes(search)
      )
    }

    // Filtro per status
    if (statusFilter !== "all") {
      filtered = filtered.filter(company => 
        statusFilter === "active" ? company.is_active : !company.is_active
      )
    }

    // Filtro per tipo
    if (typeFilter !== "all") {
      filtered = filtered.filter(company => 
        typeFilter === "partner" ? company.is_partner : !company.is_partner
      )
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'city':
          aValue = a.city?.toLowerCase() || ''
          bValue = b.city?.toLowerCase() || ''
          break
        case 'created_at':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        case 'contacts_count':
          aValue = a.contacts_count || 0
          bValue = b.contacts_count || 0
          break
        case 'opportunities_count':
          aValue = a.opportunities_count || 0
          bValue = b.opportunities_count || 0
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
  }, [companies, searchTerm, statusFilter, typeFilter, sortBy, sortOrder])

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company)
    setShowEditDialog(true)
  }

  const handleDeleteCompany = (company: Company) => {
    setCompanyToDelete(company)
    setShowDeleteDialog(true)
  }

  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return

    try {
      const { error } = await supabase
        .from('crm_companies')
        .delete()
        .eq('id', companyToDelete.id)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Azienda eliminata con successo",
      })
      refreshCompanies()
    } catch (error: any) {
      console.error('Error deleting company:', error)
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'azienda",
        variant: "destructive",
      })
    } finally {
      setShowDeleteDialog(false)
      setCompanyToDelete(null)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setTypeFilter("all")
    setSortBy("name")
    setSortOrder("asc")
  }

  // Statistiche calcolate sui risultati filtrati
  const stats = useMemo(() => {
    const filtered = filteredAndSortedCompanies
    return {
      total: filtered.length,
      active: filtered.filter(c => c.is_active).length,
      inactive: filtered.filter(c => !c.is_active).length,
      partners: filtered.filter(c => c.is_partner).length,
      totalContacts: filtered.reduce((sum, c) => sum + (c.contacts_count || 0), 0),
      totalOpportunities: filtered.reduce((sum, c) => sum + (c.opportunities_count || 0), 0)
    }
  }, [filteredAndSortedCompanies])

  if (loading) {
    return <div className="p-6">Caricamento...</div>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Aziende</h1>
          <p className="text-muted-foreground">
            Gestisci l'anagrafica delle aziende clienti - {filteredAndSortedCompanies.length} di {companies.length} aziende
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova Azienda
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
                placeholder="Cerca per nome, P.IVA, email, telefono, città..."
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
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="active">Attive</SelectItem>
                <SelectItem value="inactive">Inattive</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro tipo */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="client">Clienti</SelectItem>
              </SelectContent>
            </Select>

            {/* Ordinamento */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="city">Città</SelectItem>
                <SelectItem value="created_at">Data Creazione</SelectItem>
                <SelectItem value="contacts_count">N. Contatti</SelectItem>
                <SelectItem value="opportunities_count">N. Opportunità</SelectItem>
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
            {(searchTerm || statusFilter !== "all" || typeFilter !== "all" || sortBy !== "name" || sortOrder !== "asc") && (
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
            <CardTitle className="text-sm font-medium">Aziende Totali</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} attive, {stats.inactive} inattive
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partner</CardTitle>
            <Briefcase className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.partners}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((stats.partners / stats.total) * 100) || 0}% del totale
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contatti Totali</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <p className="text-xs text-muted-foreground">
              Media {Math.round((stats.totalContacts / stats.total) * 10) / 10 || 0} per azienda
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunità Totali</CardTitle>
            <Building2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalOpportunities}</div>
            <p className="text-xs text-muted-foreground">
              Media {Math.round((stats.totalOpportunities / stats.total) * 10) / 10 || 0} per azienda
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista aziende */}
      {filteredAndSortedCompanies.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle>
              {companies.length === 0 ? "Nessuna azienda trovata" : "Nessun risultato"}
            </CardTitle>
            <CardDescription>
              {companies.length === 0 
                ? "Inizia aggiungendo la tua prima azienda cliente"
                : "Nessuna azienda corrisponde ai criteri di ricerca"
              }
            </CardDescription>
          </CardHeader>
          {companies.length === 0 && (
            <CardContent className="text-center">
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi Prima Azienda
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedCompanies.map((company) => (
            <Card key={company.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{company.name}</CardTitle>
                    {company.vat_number && (
                      <CardDescription>P.IVA: {company.vat_number}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
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
                  </div>
                </div>
                
                {/* Badges */}
                <div className="flex flex-wrap gap-1">
                  <Badge variant={company.is_active ? "default" : "secondary"}>
                    {company.is_active ? "Attiva" : "Inattiva"}
                  </Badge>
                  {company.is_partner && (
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      Partner
                    </Badge>
                  )}
                  {(company.contacts_count || 0) > 0 && (
                    <Badge variant="outline">
                      {company.contacts_count} contatti
                    </Badge>
                  )}
                  {(company.opportunities_count || 0) > 0 && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      {company.opportunities_count} opportunità
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-2">
                {company.email && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{company.email}</span>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span>{company.phone}</span>
                  </div>
                )}
                {company.website && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Globe className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{company.website}</span>
                  </div>
                )}
                {company.city && (
                  <div className="text-sm text-muted-foreground">
                    📍 {company.city}
                    {company.postal_code && ` - ${company.postal_code}`}
                  </div>
                )}
                {company.notes && (
                  <div className="text-sm text-muted-foreground italic border-t pt-2">
                    {company.notes.length > 100 
                      ? `${company.notes.substring(0, 100)}...`
                      : company.notes
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Dialogs */}
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
              Questa azione non può essere annullata e rimuoverà anche tutti i contatti e le opportunità associate.
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
