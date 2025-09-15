import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings as SettingsIcon, User, Shield, Database, Palette } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground">Configura le preferenze del tuo CRM</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profilo</TabsTrigger>
          <TabsTrigger value="security">Sicurezza</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
          <TabsTrigger value="appearance">Aspetto</TabsTrigger>
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
                  <Input id="firstName" placeholder="Il tuo nome" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Cognome</Label>
                  <Input id="lastName" placeholder="Il tuo cognome" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="la-tua-email@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input id="phone" placeholder="+39 123 456 7890" />
              </div>
              <Button>Salva Modifiche</Button>
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
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Password Attuale</Label>
                <Input id="currentPassword" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nuova Password</Label>
                <Input id="newPassword" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma Password</Label>
                <Input id="confirmPassword" type="password" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="2fa">Autenticazione a Due Fattori</Label>
                  <p className="text-sm text-muted-foreground">
                    Aumenta la sicurezza del tuo account
                  </p>
                </div>
                <Switch id="2fa" />
              </div>
              <Button>Aggiorna Password</Button>
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
                <Switch id="notifications" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoSave">Salvataggio Automatico</Label>
                  <p className="text-sm text-muted-foreground">
                    Salva automaticamente le modifiche
                  </p>
                </div>
                <Switch id="autoSave" defaultChecked />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="timezone">Fuso Orario</Label>
                <Input id="timezone" value="Europe/Rome" readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Lingua</Label>
                <Input id="language" value="Italiano" readOnly />
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
                <Switch id="darkMode" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="compactMode">Modalità Compatta</Label>
                  <p className="text-sm text-muted-foreground">
                    Riduci la spaziatura per mostrare più contenuti
                  </p>
                </div>
                <Switch id="compactMode" />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Dimensione Font</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Piccolo</Button>
                  <Button variant="default" size="sm">Normale</Button>
                  <Button variant="outline" size="sm">Grande</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}