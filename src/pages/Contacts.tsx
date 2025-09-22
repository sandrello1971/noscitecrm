import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Plus, Users, Mail, Phone, Building2, Edit, Trash2, Search, X, UserCheck, Crown } from "lucide-react"
import { AddContactDialog } from "@/components/forms/AddContactDialog"
// import { EditContactDialog } from "@/components/forms/EditContactDialog" // TODO: Create this component
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"

interface Contact {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  mobile?: string
  position?: string
  department?: string
  notes?: string
  is_primary: boolean
  is_active: boolean
  company_id?: string
  company_name?: string
  created_at: string
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Stati per ricerca e filtri
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("last_name")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [companies, setCompanies] = useState<{id: string, name: string}[]>([])
  
  const { toast } = useToast()
  const { isAdmin } = useAuth()

  const loadContacts = async () => {
    try {
      setLoading(true)
      
      // Query per i contatti con le aziende associate
      let query = supabase
        .from('crm_contacts')
        .select(`
          *,
          crm_companies!crm_contacts_company_id_fkey(id, name)
        `)

      // Filtra per admin se necessario
      if (!isAdmin) {
        query = query.eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      }

      const { data, error } = await query.order('last_name')

      if (error) throw error

      // Mappa i dati con il nome dell'azienda
      const mappedData = data?.map(contact => ({
        ...contact,
        company_name: contact.crm_companies?.name
      })) || []

      setContacts(mappedData)
    } catch (error: any) {
      console.error('Error loading contacts:', error)
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti",
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

      if (error) throw error
      setCompanies(data || [])
    } catch (error) {
      console.error('Error loading companies:', error)
    }
  }

  useEffect(() => {
    loadContacts()
    loadCompanies()
  }, [isAdmin])

  // Filtro e ricerca dei contatti
  const filteredAndSortedContacts = useMemo(() => {
    let filtered = contacts

    // Filtro per ricerca
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(contact => 
        contact.first_name.toLowerCase().includes(search) ||
        contact.last_name.toLowerCase().includes(search) ||
        contact.email?.toLowerCase().includes(search) ||
        contact.phone?.toLowerCase().includes(search) ||
        contact.mobile?.toLowerCase().includes(search) ||
        contact.position?.toLowerCase().includes(search) ||
        contact.department?.toLowerCase().includes(search) ||
        contact.company_name?.toLowerCase().includes(search) ||
        contact.notes?.toLowerCase().includes(search)
      )
    }

    // Filtro per status
    if (statusFilter !== "all") {
      filtered = filtered.filter(contact => 
        statusFilter === "active" ? contact.is_active : !contact.is_active
      )
    }

    // Filtro per tipo
    if (typeFilter !== "all") {
      filtered = filtered.filter(contact => 
        typeFilter === "primary" ? contact.is_primary : !contact.is_primary
      )
    }

    // Filtro per azienda
    if (companyFilter !== "all") {
      filtered = filtered.filter(contact => contact.company_id === companyFilter)
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'first_name':
          aValue = a.first_name.toLowerCase()
          bValue = b.first_name.toLowerCase()
          break
        case 'last_name':
          aValue = a.last_name.toLowerCase()
          bValue = b.last_name.toLowerCase()
          break
        case 'company':
          aValue = a.company_name?.toLowerCase() || ''
          bValue = b.company_name?.toLowerCase() || ''
          break
        case 'position':
          aValue = a.position?.toLowerCase() || ''
          bValue = b.position?.toLowerCase() || ''
          break
        case 'department':
          aValue = a.department?.toLowerCase() || ''
          bValue = b.department?.toLowerCase() || ''
          break
        case 'created_at':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        default:
          aValue = a.last_name.toLowerCase()
          bValue = b.last_name.toLowerCase()
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
  }, [contacts, searchTerm, statusFilter, typeFilter, companyFilter, sortBy, sortOrder])

  const handleEditContact = (contact: Contact) => {
    // TODO: Implement when EditContactDialog is created
    toast({
      title: "Funzionalità in sviluppo",
      description: "La modifica dei contatti sarà disponibile presto",
    })
    // setSelectedContact(contact)
    // setShowEditDialog(true)
  }

  const handleDeleteContact = (contact: Contact) => {
    setContactToDelete(contact)
    setShowDeleteDialog(true)
  }

  const confirmDeleteContact = async () => {
    if (!contactToDelete) return

    try {
      const { error } = await supabase
        .from('crm_contacts')
        .delete()
        .eq('id', contactToDelete.id)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Contatto eliminato con successo",
      })
      loadContacts()
    } catch (error: any) {
      console.error('Error deleting contact:', error)
      toast({
        title: "Errore",
        description: "Impossibile eliminare il contatto",
        variant: "destructive",
      })
    } finally {
      setShowDeleteDialog(false)
      setContactToDelete(null)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setTypeFilter("all")
    setCompanyFilter("all")
    setSortBy("last_name")
    setSortOrder("asc")
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  // Statistiche calcolate sui risultati filtrati
  const stats = useMemo(() => {
    const filtered = filteredAndSortedContacts
    return {
      total: filtered.length,
      active: filtered.filter(c => c.is_active).length,
      inactive: filtered.filter(c => !c.is_active).length,
      primary: filtered.filter(c => c.is_primary).length,
      withEmail: filtered.filter(c => c.email).length,
      withPhone: filtered.filter(c => c.phone || c.mobile).length
    }
  }, [filteredAndSortedContacts])

  if (loading) {
    return <div className="p-6">Caricamento...</div>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contatti</h1>
          <p className="text-muted-foreground">
            Gestisci l'anagrafica dei contatti aziendali - {filteredAndSortedContacts.length} di {contacts.length} contatti
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Contatto
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
                placeholder="Cerca per nome, email, telefono, ruolo, azienda..."
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
                <SelectItem value="primary">Principali</SelectItem>
                <SelectItem value="secondary">Secondari</SelectItem>
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

            {/* Ordinamento */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_name">Cognome</SelectItem>
                <SelectItem value="first_name">Nome</SelectItem>
                <SelectItem value="company">Azienda</SelectItem>
                <SelectItem value="position">Ruolo</SelectItem>
                <SelectItem value="department">Dipartimento</SelectItem>
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
            {(searchTerm || statusFilter !== "all" || typeFilter !== "all" || companyFilter !== "all" || sortBy !== "last_name" || sortOrder !== "asc") && (
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
            <CardTitle className="text-sm font-medium">Contatti Totali</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Contatti Principali</CardTitle>
            <Crown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.primary}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((stats.primary / stats.total) * 100) || 0}% del totale
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withEmail}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((stats.withEmail / stats.total) * 100) || 0}% del totale
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Telefono</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withPhone}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((stats.withPhone / stats.total) * 100) || 0}% del totale
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista contatti */}
      {filteredAndSortedContacts.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle>
              {contacts.length === 0 ? "Nessun contatto trovato" : "Nessun risultato"}
            </CardTitle>
            <CardDescription>
              {contacts.length === 0 
                ? "Inizia aggiungendo il tuo primo contatto aziendale"
                : "Nessun contatto corrisponde ai criteri di ricerca"
              }
            </CardDescription>
          </CardHeader>
          {contacts.length === 0 && (
            <CardContent className="text-center">
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi Primo Contatto
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedContacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(contact.first_name, contact.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      {contact.first_name} {contact.last_name}
                    </CardTitle>
                    {contact.position && (
                      <CardDescription className="truncate">{contact.position}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditContact(contact)}
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
                          <AlertDialogTitle>Eliminare il contatto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler eliminare il contatto "{contact.first_name} {contact.last_name}"? 
                            Questa azione non può essere annullata.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteContact(contact)}>
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                
                {/* Badges */}
                <div className="flex flex-wrap gap-1">
                  <Badge variant={contact.is_active ? "default" : "secondary"}>
                    {contact.is_active ? "Attivo" : "Inattivo"}
                  </Badge>
                  {contact.is_primary && (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      <Crown className="w-3 h-3 mr-1" />
                      Principale
                    </Badge>
                  )}
                  {contact.department && (
                    <Badge variant="outline">
                      {contact.department}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-2">
                {contact.company_name && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Building2 className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{contact.company_name}</span>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.mobile && contact.mobile !== contact.phone && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span>{contact.mobile} (Mobile)</span>
                  </div>
                )}
                {contact.notes && (
                  <div className="text-sm text-muted-foreground italic border-t pt-2">
                    {contact.notes.length > 100 
                      ? `${contact.notes.substring(0, 100)}...`
                      : contact.notes
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Dialogs */}
      <AddContactDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onContactAdded={loadContacts}
      />

      {/* TODO: Add EditContactDialog when component is created
      <EditContactDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog}
        contact={selectedContact}
        onContactUpdated={loadContacts}
      />
      */}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare il contatto "{contactToDelete?.first_name} {contactToDelete?.last_name}"? 
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteContact}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
