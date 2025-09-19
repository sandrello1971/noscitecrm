import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Shield, User, Clock, MapPin } from 'lucide-react'

interface RoleChangeAudit {
  id: string
  changed_by: string
  target_user_id: string
  old_role: string | null
  new_role: string
  change_reason: string | null
  ip_address: unknown
  user_agent: string | null
  created_at: string
}

export function SecurityAuditLog() {
  const [auditLogs, setAuditLogs] = useState<RoleChangeAudit[]>([])
  const [loading, setLoading] = useState(false)
  const [userEmails, setUserEmails] = useState<{ [key: string]: string }>({})
  const { toast } = useToast()

  useEffect(() => {
    fetchAuditLogs()
  }, [])

  const fetchAuditLogs = async () => {
    setLoading(true)
    try {
      // Check if user is admin first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (userRole?.role !== 'admin') {
        throw new Error('Access denied: Admin role required')
      }

      // Fetch audit logs
      const { data: logs, error } = await supabase
        .from('role_change_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      setAuditLogs(logs || [])

      // Fetch user emails for display
      const userIds = [...new Set([
        ...logs?.map(log => log.changed_by) || [],
        ...logs?.map(log => log.target_user_id) || []
      ])]

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, email')
        .in('id', userIds)

      const emailMap: { [key: string]: string } = {}
      profiles?.forEach(profile => {
        emailMap[profile.id] = profile.email || 'Unknown'
      })
      setUserEmails(emailMap)

    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il caricamento dei log di audit.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'moderator': return 'secondary'
      default: return 'outline'
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'Amministratore'
      case 'moderator': return 'Moderatore'
      default: return 'Utente'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Log di Audit Sicurezza
          </CardTitle>
          <CardDescription>
            Caricamento dei log di audit per le modifiche dei ruoli...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Caricamento...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Log di Audit Sicurezza
        </CardTitle>
        <CardDescription>
          Registro delle modifiche ai ruoli utente per scopi di sicurezza e conformità
        </CardDescription>
      </CardHeader>
      <CardContent>
        {auditLogs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nessun log di audit disponibile.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Ora</TableHead>
                <TableHead>Modificato da</TableHead>
                <TableHead>Utente Target</TableHead>
                <TableHead>Cambio Ruolo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {new Date(log.created_at).toLocaleString('it-IT')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {userEmails[log.changed_by] || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {userEmails[log.target_user_id] || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {log.old_role && (
                        <>
                          <Badge variant={getRoleBadgeVariant(log.old_role)}>
                            {getRoleDisplayName(log.old_role)}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                        </>
                      )}
                      <Badge variant={getRoleBadgeVariant(log.new_role)}>
                        {getRoleDisplayName(log.new_role)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {log.change_reason || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">
                        {(log.ip_address as string) || 'N/A'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}