import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download, FileText, Sparkles } from 'lucide-react';

const MeetingMinutes = () => {
  const [notes, setNotes] = useState('');
  const [generatedMinutes, setGeneratedMinutes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!notes.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci gli appunti della riunione",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-meeting-minutes', {
        body: { notes }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Errore durante la generazione');
      }

      setGeneratedMinutes(data.minutes);
      toast({
        title: "Minuta generata!",
        description: "La minuta è stata creata con successo",
      });
    } catch (error: any) {
      console.error('Error generating minutes:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile generare la minuta",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedMinutes) return;

    const blob = new Blob([generatedMinutes], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-minutes-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download completato",
      description: "La minuta è stata scaricata",
    });
  };

  const handleReset = () => {
    setNotes('');
    setGeneratedMinutes('');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Generatore Minute Meeting</h1>
            <p className="text-muted-foreground">Trasforma i tuoi appunti in minute formali con l'AI</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Appunti Riunione</CardTitle>
              <CardDescription>
                Inserisci gli appunti della riunione in formato libero
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Es: Riunione con cliente Rossi S.p.A. del 16/10/2025&#10;Presenti: Mario Rossi, Laura Bianchi&#10;Progetto: Nuovo sistema CRM&#10;&#10;Discusso:&#10;- Requisiti del sistema&#10;- Timeline di sviluppo&#10;- Budget approvato 50k€&#10;&#10;Decisioni:&#10;- Si parte con fase 1 a novembre&#10;- Review settimanali ogni lunedì&#10;&#10;Todo:&#10;- Mario: preparare documenti tecnici (20/10)&#10;- Laura: contratto da firmare (18/10)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !notes.trim()}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generazione in corso...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Genera Minuta
                    </>
                  )}
                </Button>
                {generatedMinutes && (
                  <Button onClick={handleReset} variant="outline">
                    Nuova
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preview Section */}
          <Card>
            <CardHeader>
              <CardTitle>Minuta Generata</CardTitle>
              <CardDescription>
                Anteprima della minuta in formato Markdown
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedMinutes ? (
                <>
                  <div className="border rounded-md p-4 bg-muted/50 min-h-[400px] max-h-[400px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-mono text-sm">
                      {generatedMinutes}
                    </pre>
                  </div>
                  <Button onClick={handleDownload} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Scarica Minuta (.md)
                  </Button>
                </>
              ) : (
                <div className="border rounded-md p-4 bg-muted/50 min-h-[400px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>La minuta generata apparirà qui</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">💡 Suggerimenti</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc list-inside space-y-1">
              <li>Includi data, partecipanti e argomento della riunione</li>
              <li>Elenca i punti discussi in modo chiaro</li>
              <li>Indica decisioni prese e azioni da intraprendere</li>
              <li>Specifica responsabili e scadenze per le attività</li>
              <li>Puoi scrivere in modo informale, l'AI formatterà tutto correttamente</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MeetingMinutes;