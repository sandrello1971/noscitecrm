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
      // Only admins should see the user management section
      // Get current user role first
      const { data: currentUserRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single()

      if (currentUserRole?.role !== 'admin') {
        throw new Error('Non hai i permessi per accedere a questa sezione')
      }

      // Get users with email from profiles table
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          first_name,
          last_name,
          phone,
          email,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      // Get user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')

      if (rolesError) throw rolesError

      // Combine profiles with roles
      const combinedUsers: User[] = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id)
        return {
          id: profile.id,
          email: profile.email || 'Email non disponibile',
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          role: userRole?.role || 'user',
          created_at: profile.created_at
        }
      }) || []

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
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: newUserEmail.trim() }
      })

      if (error) {
        throw error
      }

      if (data.error) {
        throw new Error(data.error)
      }

      toast({
        title: "Invito inviato",
        description: "L'invito è stato inviato con successo!",
      })
      
      setNewUserEmail('')
      // Refresh users list
      fetchUsers()
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
      // Check if user already has this exact role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', newRole as any)
        .maybeSingle()

      if (existingRole) {
        toast({
          title: "Nessun cambiamento",
          description: "L'utente ha già questo ruolo.",
        })
        return
      }

      // Delete ALL existing roles for this user first
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        console.error('Delete error:', deleteError)
        throw deleteError
      }

      // Then insert the new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role: newRole as any }])

      if (insertError) {
        console.error('Insert error:', insertError)
        throw insertError
      }

      toast({
        title: "Ruolo aggiornato",
        description: "Il ruolo dell'utente è stato aggiornato con successo.",
      })

      fetchUsers()
    } catch (error: any) {
      console.error('Role update error:', error)
      toast({
        title: "Errore", 
        description: error.message || "Errore durante l'aggiornamento del ruolo.",
        variant: "destructive",
      })
    }
  }

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      })

      if (error) {
        throw error
      }

      if (data.error) {
        throw new Error(data.error)
      }

      toast({
        title: "Utente eliminato",
        description: `L'utente ${userEmail} è stato eliminato completamente.`,
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