import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Verify authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Non autorizzato' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create client with user's auth to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the calling user
    const { data: { user: callingUser }, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !callingUser) {
      console.error('Error getting user:', userError)
      return new Response(
        JSON.stringify({ error: 'Non autorizzato' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`User ${callingUser.id} attempting to invite a new user`)

    // Verify the calling user has admin role
    const { data: roleData, error: roleError } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .eq('role', 'admin')
      .single()

    if (roleError || !roleData) {
      console.error('User is not an admin:', callingUser.id)
      return new Response(
        JSON.stringify({ error: 'Accesso negato. Solo gli amministratori possono invitare utenti.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const { email } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email è richiesta' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Formato email non valido' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Admin ${callingUser.email} inviting user with email: ${email}`)

    // Create admin client with service role key for the actual invitation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Send invitation email
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)

    if (error) {
      console.error('Error inviting user:', error)
      
      let errorMessage = 'Errore durante l\'invito utente'
      
      // Handle specific error cases
      if (error.message.includes('invalid')) {
        errorMessage = 'L\'indirizzo email fornito non è valido o non è accettato dal sistema'
      } else if (error.message.includes('already registered') || error.message.includes('already exists')) {
        errorMessage = 'Un utente con questa email è già registrato'
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Troppi tentativi di invito. Riprova più tardi'
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Log the invitation action for audit
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_user_id: callingUser.id,
      action: 'INVITE_USER',
      table_name: 'auth.users',
      record_id: data.user?.id || null,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0'
    })

    console.log('User invited successfully by admin:', callingUser.email)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invito inviato con successo',
        user: data.user 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
