import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function OCRSettings() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    preferred_language: 'ita',
    quality_threshold: 60,
    auto_create_company: true,
    auto_create_contact: true,
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!isAdmin) {
      toast.error('Accesso negato: solo gli amministratori possono accedere a questa pagina');
      navigate('/');
      return;
    }
    loadSettings();
  }, [user, isAdmin, navigate]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('ocr_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          preferred_language: data.preferred_language,
          quality_threshold: data.quality_threshold || 60,
          auto_create_company: data.auto_create_company ?? true,
          auto_create_contact: data.auto_create_contact ?? true,
        });
      }
    } catch (error: any) {
      toast.error('Errore nel caricamento delle impostazioni');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('ocr_settings')
        .upsert({
          user_id: user.id,
          ...settings,
        });

      if (error) throw error;
      toast.success('Impostazioni salvate con successo');
    } catch (error: any) {
      toast.error('Errore nel salvataggio delle impostazioni');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Impostazioni OCR</CardTitle>
          <CardDescription>
            Configura le preferenze per la scansione dei biglietti da visita
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="language">Lingua Preferita</Label>
            <Select
              value={settings.preferred_language}
              onValueChange={(value) =>
                setSettings({ ...settings, preferred_language: value })
              }
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ita">Italiano</SelectItem>
                <SelectItem value="eng">Inglese</SelectItem>
                <SelectItem value="ita+eng">Italiano + Inglese</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="threshold">
              Soglia Qualità Minima ({settings.quality_threshold}%)
            </Label>
            <Input
              id="threshold"
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.quality_threshold}
              onChange={(e) =>
                setSettings({ ...settings, quality_threshold: Number(e.target.value) })
              }
            />
            <p className="text-sm text-muted-foreground">
              Scansioni sotto questa soglia verranno segnalate come bassa qualità
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-company">Crea Azienda Automaticamente</Label>
                <p className="text-sm text-muted-foreground">
                  Crea automaticamente l'azienda se non esiste
                </p>
              </div>
              <Switch
                id="auto-company"
                checked={settings.auto_create_company}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, auto_create_company: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-contact">Crea Contatto Automaticamente</Label>
                <p className="text-sm text-muted-foreground">
                  Salva automaticamente il contatto dopo la correzione
                </p>
              </div>
              <Switch
                id="auto-contact"
                checked={settings.auto_create_contact}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, auto_create_contact: checked })
                }
              />
            </div>
          </div>

          <Button onClick={saveSettings} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salva Impostazioni
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
