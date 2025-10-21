import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    if (!code) {
      return new Response('Missing authorization code', { status: 400 });
    }

    const clientId = Deno.env.get('ONEDRIVE_CLIENT_ID');
    const clientSecret = Deno.env.get('ONEDRIVE_CLIENT_SECRET');
    const tenantId = Deno.env.get('ONEDRIVE_TENANT_ID');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/onedrive-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      }
    );

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokens);
      return new Response(`Token exchange failed: ${JSON.stringify(tokens)}`, { status: 400 });
    }

    console.log('Tokens obtained successfully');

    // Store tokens in Supabase (you'll need to create a table for this)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        await supabase.from('onedrive_tokens').upsert({
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        });
      }
    }

    // Redirect back to the app with success
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${Deno.env.get('SUPABASE_URL').replace('.supabase.co', '')}/settings?onedrive=connected`,
      },
    });
  } catch (error) {
    console.error('Error in onedrive-callback:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
