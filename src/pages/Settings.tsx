import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings as SettingsIcon, User, Shield, Database, Palette, Users as UsersIcon } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/integrations/supabase/client"
import { UserManagement } from "@/components/UserManagement"

interface UserProfile {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  preferences: any
}

interface UserRole {
  role: string
}

export default function Settings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [profile, setProfile] = useState<UserProfile>({
    id: '',
    first_name: '',
    last_name: '',
    phone: '',
    preferences: {}
  })

  useEffect(() => {
    if (user) {
      fetchProfile()
      checkAdminRole()
    }
  }, [user])

  const fetchProfile = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error)
      return
    }

    if (data) {
      setProfile(data)
    } else {
      // Create profile if it doesn't exist
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert([
          {
            id: user.id,
            first_name: '',
            last_name: '',
            phone: '',
            preferences: {}
          }
        ])
        .select()
        .single()

      if (createError) {
        console.error('Error creating profile:', createError)
        return
      }

      if (newProfile) {
        setProfile(newProfile)
      }
    }
  }

  const checkAdminRole = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (data) {
      setIsAdmin(true)
    }
  }

  const updateProfile = async () => {
    if (!user) return
    
    setLoading(true)
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          preferences: profile.preferences
        })

      if (error) throw error

      toast({
        title: "Profilo aggiornato",
        description: "Le modifiche sono state salvate con successo.",
      })
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio delle modifiche.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updatePreference = async (key: string, value: any) => {
    const newPreferences = { ...profile.preferences, [key]: value }
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user?.id,
          preferences: newPreferences
        })

      if (error) throw error

      setProfile(prev => ({ ...prev, preferences: newPreferences }))
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Errore durante il salvataggio della preferenza.",
        variant: "destructive",
      })
    }
  }

  const tabsList = isAdmin 
    ? ["profile", "security", "system", "appearance", "users"]
    : ["profile", "security", "system", "appearance"]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground">
          Configura le preferenze del tuo CRM
          {isAdmin && " (Amministratore)"}
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabsList.length}, 1fr)` }}>
          <TabsTrigger value="profile">Profilo</TabsTrigger>
          <TabsTrigger value="security">Sicurezza</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
          <TabsTrigger value="appearance">Aspetto</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Utenti</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informazioni Profilo
              </CardTitle>
              <CardDescription>
                Gestisci le tue informazioni personali
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nome</Label>
                  <Input 
                    id="firstName" 
                    placeholder="Il tuo nome"
                    value={profile.first_name || ''}
                    onChange={(e) => setProfile(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Cognome</Label>
                  <Input 
                    id="lastName" 
                    placeholder="Il tuo cognome"
                    value={profile.last_name || ''}
                    onChange={(e) => setProfile(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={user?.email || ''} 
                  readOnly 
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input 
                  id="phone" 
                  placeholder="+39 123 456 7890"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <Button onClick={updateProfile} disabled={loading}>
                {loading ? "Salvataggio..." : "Salva Modifiche"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sicurezza Account
              </CardTitle>
              <CardDescription>
                Gestisci la sicurezza del tuo account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Per modificare la password, utilizza la funzione "Password dimenticata?" nella pagina di login.
                </p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="2fa">Autenticazione a Due Fattori</Label>
                  <p className="text-sm text-muted-foreground">
                    Aumenta la sicurezza del tuo account
                  </p>
                </div>
                <Switch 
                  id="2fa" 
                  checked={profile.preferences?.two_factor_enabled || false}
                  onCheckedChange={(checked) => updatePreference('two_factor_enabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Impostazioni Sistema
              </CardTitle>
              <CardDescription>
                Configura le preferenze del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications">Notifiche Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Ricevi notifiche via email per aggiornamenti importanti
                  </p>
                </div>
                <Switch 
                  id="notifications" 
                  checked={profile.preferences?.email_notifications !== false}
                  onCheckedChange={(checked) => updatePreference('email_notifications', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoSave">Salvataggio Automatico</Label>
                  <p className="text-sm text-muted-foreground">
                    Salva automaticamente le modifiche
                  </p>
                </div>
                <Switch 
                  id="autoSave" 
                  checked={profile.preferences?.auto_save !== false}
                  onCheckedChange={(checked) => updatePreference('auto_save', checked)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="timezone">Fuso Orario</Label>
                <Input id="timezone" value="Europe/Rome" readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Lingua</Label>
                <Input id="language" value="Italiano" readOnly className="bg-muted" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Aspetto
              </CardTitle>
              <CardDescription>
                Personalizza l'aspetto dell'interfaccia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="darkMode">Modalità Scura</Label>
                  <p className="text-sm text-muted-foreground">
                    Attiva la modalità scura per un'esperienza più confortevole
                  </p>
                </div>
                <Switch 
                  id="darkMode" 
                  checked={profile.preferences?.dark_mode || false}
                  onCheckedChange={(checked) => updatePreference('dark_mode', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="compactMode">Modalità Compatta</Label>
                  <p className="text-sm text-muted-foreground">
                    Riduci la spaziatura per mostrare più contenuti
                  </p>
                </div>
                <Switch 
                  id="compactMode" 
                  checked={profile.preferences?.compact_mode || false}
                  onCheckedChange={(checked) => updatePreference('compact_mode', checked)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Dimensione Font</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={profile.preferences?.font_size === 'small' ? "default" : "outline"} 
                    size="sm"
                    onClick={() => updatePreference('font_size', 'small')}
                  >
                    Piccolo
                  </Button>
                  <Button 
                    variant={!profile.preferences?.font_size || profile.preferences?.font_size === 'normal' ? "default" : "outline"} 
                    size="sm"
                    onClick={() => updatePreference('font_size', 'normal')}
                  >
                    Normale
                  </Button>
                  <Button 
                    variant={profile.preferences?.font_size === 'large' ? "default" : "outline"} 
                    size="sm"
                    onClick={() => updatePreference('font_size', 'large')}
                  >
                    Grande
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5" />
                  Gestione Utenti
                </CardTitle>
                <CardDescription>
                  Gestisci gli utenti e i loro permessi (Solo Amministratori)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UserManagement />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}