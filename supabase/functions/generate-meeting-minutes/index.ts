import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { notes } = await req.json();
    
    if (!notes || typeof notes !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Notes are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Sei un assistente che trasforma appunti di riunione in minute formali seguendo un template specifico.

Il template da utilizzare è:
---
titolo: "Riunione [DATA] - [Argomento]"
data: [DATA in formato YYYY-MM-DD]
partecipanti: ["Partecipante 1", "Partecipante 2"]
cliente: [[Cliente]]
progetto_ref: [[Progetto]]
tipo: "Meeting"
tags: [meeting, minuta]
status: "Bozza"
---

# 🗓️ Riunione [DATA] - [Argomento]

## 📋 Contesto
[Descrizione breve del contesto della riunione]

## 🗣️ Sintesi discussione
[Sintesi dei punti discussi]

## ✅ Decisioni
- Decisione 1
- Decisione 2

## 🧠 Action Items
\`\`\`tasks
- [ ] Assegnato a [Responsabile] – [Attività] (scadenza YYYY-MM-DD)
\`\`\`

## 📎 Allegati / Riferimenti
- [[Documento Collegato]]

ISTRUZIONI:
1. Estrai tutte le informazioni dagli appunti forniti
2. Organizza il contenuto secondo le sezioni del template
3. Usa la data odierna se non specificata
4. Se mancano informazioni, usa placeholder descrittivi tra parentesi quadre
5. Mantieni esattamente la struttura markdown con frontmatter YAML
6. Restituisci SOLO il markdown formattato, senza commenti o spiegazioni aggiuntive`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Trasforma questi appunti in una minuta seguendo il template:\n\n${notes}` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit raggiunto. Riprova tra qualche istante.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Crediti AI esauriti. Contatta l\'amministratore.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedMinutes = data.choices[0].message.content;

    console.log('Meeting minutes generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        minutes: generatedMinutes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-meeting-minutes function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore sconosciuto durante la generazione'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});