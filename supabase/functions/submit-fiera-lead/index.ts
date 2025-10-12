import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadData {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  position?: string;
  notes?: string;
}

// Email validation regex
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Phone validation regex (flexible, allows international formats)
const PHONE_REGEX = /^[\d\s\-\+\(\)\.]{7,20}$/;

// Sanitize text input by trimming and removing control characters
const sanitizeText = (text: string): string => {
  return text.trim().replace(/[\x00-\x1F\x7F]/g, '');
};

// Rate limiting storage (IP -> last submission time)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SUBMISSIONS_PER_WINDOW = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    const now = Date.now();
    const lastSubmission = rateLimitMap.get(clientIP);
    
    if (lastSubmission && (now - lastSubmission) < RATE_LIMIT_WINDOW_MS) {
      // Check how many submissions in the last hour
      const recentSubmissions = Array.from(rateLimitMap.entries())
        .filter(([ip, time]) => ip === clientIP && (now - time) < RATE_LIMIT_WINDOW_MS)
        .length;
      
      if (recentSubmissions >= MAX_SUBMISSIONS_PER_WINDOW) {
        return new Response(
          JSON.stringify({ error: 'Limite raggiunto. Massimo 3 invii per ora.' }),
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const leadData: LeadData = await req.json();

    // Validation: Required fields
    if (!leadData.first_name || !leadData.last_name) {
      return new Response(
        JSON.stringify({ error: 'Nome e cognome sono obbligatori' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!leadData.email && !leadData.phone) {
      return new Response(
        JSON.stringify({ error: 'Inserisci almeno email o telefono' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validation: Length limits
    if (leadData.first_name.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Il nome è troppo lungo (massimo 100 caratteri)' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (leadData.last_name.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Il cognome è troppo lungo (massimo 100 caratteri)' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (leadData.company_name && leadData.company_name.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Il nome dell\'azienda è troppo lungo (massimo 200 caratteri)' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (leadData.position && leadData.position.length > 100) {
      return new Response(
        JSON.stringify({ error: 'La posizione è troppo lunga (massimo 100 caratteri)' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (leadData.notes && leadData.notes.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Le note sono troppo lunghe (massimo 1000 caratteri)' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validation: Email format
    if (leadData.email && !EMAIL_REGEX.test(leadData.email)) {
      return new Response(
        JSON.stringify({ error: 'Formato email non valido' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validation: Phone format
    if (leadData.phone && !PHONE_REGEX.test(leadData.phone)) {
      return new Response(
        JSON.stringify({ error: 'Formato telefono non valido' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Sanitize all text inputs
    const sanitizedData = {
      first_name: sanitizeText(leadData.first_name),
      last_name: sanitizeText(leadData.last_name),
      email: leadData.email ? sanitizeText(leadData.email) : null,
      phone: leadData.phone ? sanitizeText(leadData.phone) : null,
      company_name: leadData.company_name ? sanitizeText(leadData.company_name) : null,
      position: leadData.position ? sanitizeText(leadData.position) : null,
      notes: leadData.notes ? sanitizeText(leadData.notes) : null,
    };

    // Get admin user ID (sandrello@noscite.it)
    const { data: adminUser, error: adminError } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    if (adminError || !adminUser) {
      console.error('Error finding admin user:', adminError);
      return new Response(
        JSON.stringify({ error: 'Configurazione sistema non trovata' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare notes with company info if provided
    let finalNotes = sanitizedData.notes || '';
    if (sanitizedData.company_name) {
      finalNotes = `LEAD FIERA - inridia comolake - Azienda: ${sanitizedData.company_name}${finalNotes ? '\n\n' + finalNotes : ''}`;
    } else {
      finalNotes = `LEAD FIERA - inridia comolake${finalNotes ? '\n\n' + finalNotes : ''}`;
    }

    // Insert contact
    const { data: contact, error: insertError } = await supabaseClient
      .from('crm_contacts')
      .insert({
        user_id: adminUser.user_id,
        first_name: sanitizedData.first_name,
        last_name: sanitizedData.last_name,
        email: sanitizedData.email,
        phone: sanitizedData.phone,
        position: sanitizedData.position,
        notes: finalNotes,
        is_active: true,
        is_primary: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting contact:', insertError);
      return new Response(
        JSON.stringify({ error: 'Errore durante il salvataggio' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update rate limit tracking
    rateLimitMap.set(clientIP, now);
    
    // Clean up old entries (older than rate limit window)
    for (const [ip, time] of rateLimitMap.entries()) {
      if (now - time > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(ip);
      }
    }

    console.log(`Lead submission successful from IP: ${clientIP}`);

    return new Response(
      JSON.stringify({ success: true, contact }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error processing lead:', error);
    return new Response(
      JSON.stringify({ error: 'Errore interno del server' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
