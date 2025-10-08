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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Validation
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
    let finalNotes = leadData.notes || '';
    if (leadData.company_name) {
      finalNotes = `LEAD FIERA - inridia comolake - Azienda: ${leadData.company_name}${finalNotes ? '\n\n' + finalNotes : ''}`;
    } else {
      finalNotes = `LEAD FIERA - inridia comolake${finalNotes ? '\n\n' + finalNotes : ''}`;
    }

    // Insert contact
    const { data: contact, error: insertError } = await supabaseClient
      .from('crm_contacts')
      .insert({
        user_id: adminUser.user_id,
        first_name: leadData.first_name,
        last_name: leadData.last_name,
        email: leadData.email || null,
        phone: leadData.phone || null,
        position: leadData.position || null,
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
