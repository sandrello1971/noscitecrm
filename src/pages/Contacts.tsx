import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Plus, Users, Mail, Phone, Building2, Edit, Trash2, Search, X, UserCheck, Crown } from "lucide-react"
import { AddContactDialog } from "@/components/forms/AddContactDialog"
import { EditContactDialog } from "@/components/forms/EditContactDialog"
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
  user_id: string
  company?: {
    id: string
    name: string
  }
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
  const { user } = useAuth()

  const loadContacts = async () => {
    try {
      setLoading(true)
      
      if (!user?.id) return

      // Query per i contatti con le aziende associate
      const { data: contactsData, error: contactsError } = await supabase
        .from('crm_contacts')
        .select(`
          *,
          company:crm_companies(id, name)
        `)
        .eq('user_id', user.id)
        .order('last_name')

      if (contactsError) throw contactsError

      // Trasforma i dati per includerli nel formato aspettato
      const transformedContacts = (contactsData || []).map(contact => ({
        ...contact,
        company_name: contact.company?.name
      }))

      setContacts(transformedContacts)

      // Carica anche le aziende per i filtri
      const { data: companiesData, error: companiesError } = await supabase
        .from('crm_companies')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name')

      if (companiesError) throw companiesError
      
      setCompanies(companiesData || [])

    } catch (error: any) {
      console.error('Error loading contacts:', error)
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContacts()
  }, [user?.id])

  // Filtri e ordinamenti
  const filteredAndSortedContacts = useMemo(() => {
    let filtered = contacts

    // Filtro di ricerca
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(contact => 
        contact.first_name.toLowerCase().includes(searchLower) ||
        contact.last_name.toLowerCase().includes(searchLower) ||
        (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
        (contact.phone && contact.phone.includes(searchTerm)) ||
        (contact.mobile && contact.mobile.includes(searchTerm)) ||
        (contact.position && contact.position.toLowerCase().includes(searchLower)) ||
        (contact.company_name && contact.company_name.toLowerCase().includes(searchLower))
      )
    }

    // Filtro status
    if (statusFilter !== "all") {
      filtered = filtered.filter(contact => 
        statusFilter === "active" ? contact.is_active : !contact.is_active
      )
    }

    // Filtro tipo
    if (typeFilter !== "all") {
      filtered = filtered.filter(contact => 
        typeFilter === "primary" ? contact.is_primary : !contact.is_primary
      )
    }

    // Filtro azienda
    if (companyFilter !== "all") {
      filtered = filtered.filter(contact => contact.company_id === companyFilter)
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'first_name':
          aValue = a.first_name
          bValue = b.first_name
          break
        case 'last_name':
          aValue = a.last_name
          bValue = b.last_name
          break
        case 'email':
          aValue = a.email || ''
          bValue = b.email || ''
          break
        case 'company_name':
          aValue = a.company_name || ''
          bValue = b.company_name || ''
          break
        case 'created_at':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        default:
          aValue = a.last_name
          bValue = b.last_name
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
    setSelectedContact(contact)
    setShowEditDialog(true)
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

      {/* Statistiche */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attivi</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inattivi</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Principali</CardTitle>
            <Crown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.primary}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Email</CardTitle>
            <Mail className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.withEmail}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Telefono</CardTitle>
            <Phone className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.withPhone}</div>
          </CardContent>
        </Card>
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
              <SelectTrigger className="w-[180px]">
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
            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [field, order] = value.split('-')
              setSortBy(field)
              setSortOrder(order as 'asc' | 'desc')
            }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_name-asc">Cognome A-Z</SelectItem>
                <SelectItem value="last_name-desc">Cognome Z-A</SelectItem>
                <SelectItem value="first_name-asc">Nome A-Z</SelectItem>
                <SelectItem value="first_name-desc">Nome Z-A</SelectItem>
                <SelectItem value="company_name-asc">Azienda A-Z</SelectItem>
                <SelectItem value="company_name-desc">Azienda Z-A</SelectItem>
                <SelectItem value="created_at-desc">Più recenti</SelectItem>
                <SelectItem value="created_at-asc">Più vecchi</SelectItem>
              </SelectContent>
            </Select>

            {/* Pulsante per pulire filtri */}
            {(searchTerm || statusFilter !== "all" || typeFilter !== "all" || companyFilter !== "all" || sortBy !== "last_name" || sortOrder !== "asc") && (
              <Button variant="outline" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Pulisci
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
                  <div className="flex items-center gap-1">
                    {contact.is_primary && (
                      <Crown className="h-4 w-4 text-yellow-500" title="Contatto principale" />
                    )}
                    {!contact.is_active && (
                      <Badge variant="secondary" className="text-xs">Inattivo</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {contact.company_name && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Building2 className="mr-2 h-4 w-4" />
                    <span className="truncate">{contact.company_name}</span>
                  </div>
                )}
                
                {contact.email && (
                  <div className="flex items-center text-sm">
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                    <a 
                      href={`mailto:${contact.email}`}
                      className="text-blue-600 hover:underline truncate"
                    >
                      {contact.email}
                    </a>
                  </div>
                )}
                
                {(contact.phone || contact.mobile) && (
                  <div className="space-y-1">
                    {contact.phone && (
                      <div className="flex items-center text-sm">
                        <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                        <a 
                          href={`tel:${contact.phone}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    {contact.mobile && (
                      <div className="flex items-center text-sm">
                        <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                        <a 
                          href={`tel:${contact.mobile}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.mobile} <span className="text-muted-foreground">(Cell.)</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {contact.department && (
                  <div className="text-sm text-muted-foreground">
                    <strong>Reparto:</strong> {contact.department}
                  </div>
                )}

                {contact.notes && (
                  <div className="text-sm text-muted-foreground">
                    <strong>Note:</strong> {
                      contact.notes.length > 100 
                        ? `${contact.notes.substring(0, 100)}...`
                        : contact.notes
                    }
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant={contact.is_active ? "default" : "secondary"}>
                      {contact.is_active ? "Attivo" : "Inattivo"}
                    </Badge>
                    {contact.is_primary && (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        Principale
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex space-x-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditContact(contact)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteContact(contact)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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

      <EditContactDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog}
        contact={selectedContact}
        onContactUpdated={loadContacts}
      />

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
