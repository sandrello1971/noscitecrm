import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users, Mail, Phone, Building2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AddContactDialog } from "@/components/forms/AddContactDialog"

export default function Contacts() {
  const [contacts] = useState([])
  const [showAddDialog, setShowAddDialog] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contatti</h1>
          <p className="text-muted-foreground">Gestisci l'anagrafica dei contatti aziendali</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Contatto
        </Button>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle>Nessun contatto trovato</CardTitle>
            <CardDescription>
              Inizia aggiungendo il tuo primo contatto aziendale
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Aggiungi Primo Contatto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact: any) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarFallback>
                      {contact.first_name[0]}{contact.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {contact.first_name} {contact.last_name}
                    </CardTitle>
                    {contact.position && (
                      <CardDescription>{contact.position}</CardDescription>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge variant={contact.is_active ? "default" : "secondary"}>
                      {contact.is_active ? "Attivo" : "Inattivo"}
                    </Badge>
                    {contact.is_primary && (
                      <Badge variant="outline">Principale</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {contact.company && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Building2 className="mr-2 h-4 w-4" />
                    {contact.company.name}
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="mr-2 h-4 w-4" />
                    {contact.email}
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="mr-2 h-4 w-4" />
                    {contact.phone}
                  </div>
                )}
                {contact.department && (
                  <div className="text-sm text-muted-foreground">
                    🏢 {contact.department}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <AddContactDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onContactAdded={() => {
          // TODO: Refresh contacts list
        }}
      />
    </div>
  )
}