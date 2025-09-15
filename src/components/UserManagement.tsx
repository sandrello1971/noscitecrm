import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Trash2, UserPlus, Shield, User as UserIcon } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface User {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: string | null
  created_at: string
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      // Get all users with their profiles and roles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          first_name,
          last_name,
          phone,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      // Get user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')

      if (rolesError) throw rolesError

      // For each profile, try to get the email from auth metadata
      const combinedUsers: User[] = []
      
      if (profiles) {
        for (const profile of profiles) {
          try {
            // Get user email from auth (admin function)
            const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
            const userRole = roles?.find(r => r.user_id === profile.id)
            
            if (userData?.user) {
              combinedUsers.push({
                id: profile.id,
                email: userData.user.email || '',
                first_name: profile.first_name,
                last_name: profile.last_name,
                phone: profile.phone,
                role: userRole?.role || 'user',
                created_at: profile.created_at
              })
            }
          } catch (error) {
            // Skip users we can't access
            console.warn('Could not fetch user data for:', profile.id)
          }
        }
      }

      setUsers(combinedUsers)
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il caricamento degli utenti.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const inviteUser = async () => {
    if (!newUserEmail.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un indirizzo email valido.",
        variant: "destructive",
      })
      return
    }

    setInviting(true)
    try {
      // Invite the user through Supabase Auth
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(newUserEmail, {
        redirectTo: `${window.location.origin}/auth`
      })

      if (error) throw error

      toast({
        title: "Utente invitato",
        description: `Invito inviato a ${newUserEmail}. L'utente riceverà un'email per completare la registrazione.`,
      })

      setNewUserEmail('')
      // Refresh users list after a short delay to allow for user creation
      setTimeout(fetchUsers, 2000)
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'invito dell'utente.",
        variant: "destructive",
      })
    } finally {
      setInviting(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // Delete existing roles for this user
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

      // Insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role: newRole as 'admin' | 'moderator' | 'user' }])

      if (error) throw error

      toast({
        title: "Ruolo aggiornato",
        description: "Il ruolo dell'utente è stato aggiornato con successo.",
      })

      fetchUsers()
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento del ruolo.",
        variant: "destructive",
      })
    }
  }

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      // Delete user from auth (this will cascade delete profile and roles)
      const { error } = await supabase.auth.admin.deleteUser(userId)

      if (error) throw error

      toast({
        title: "Utente eliminato",
        description: `L'utente ${userEmail} è stato eliminato con successo.`,
      })

      fetchUsers()
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'eliminazione dell'utente.",
        variant: "destructive",
      })
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'moderator': return 'secondary'
      default: return 'outline'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-3 w-3" />
      case 'moderator': return <Shield className="h-3 w-3" />
      default: return <UserIcon className="h-3 w-3" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Input
          placeholder="Email del nuovo utente"
          value={newUserEmail}
          onChange={(e) => setNewUserEmail(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && inviteUser()}
        />
        <Button onClick={inviteUser} disabled={inviting}>
          <UserPlus className="h-4 w-4 mr-2" />
          {inviting ? 'Invitando...' : 'Invita Utente'}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Caricamento utenti...</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Data Registrazione</TableHead>
              <TableHead>Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>
                  {user.first_name || user.last_name 
                    ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={getRoleBadgeVariant(user.role || 'user')} className="flex items-center gap-1">
                      {getRoleIcon(user.role || 'user')}
                      {user.role === 'admin' ? 'Amministratore' : 
                       user.role === 'moderator' ? 'Moderatore' : 'Utente'}
                    </Badge>
                    <Select value={user.role || 'user'} onValueChange={(value) => updateUserRole(user.id, value)}>
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Utente</SelectItem>
                        <SelectItem value="moderator">Moderatore</SelectItem>
                        <SelectItem value="admin">Amministratore</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString('it-IT')}
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Elimina Utente</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare l'utente {user.email}? 
                          Questa azione è irreversibile e eliminerà tutti i dati associati all'utente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => deleteUser(user.id, user.email)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}