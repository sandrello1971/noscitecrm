import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    console.log('OneDrive callback received');
    
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // URL del frontend - usa SOLO crm.noscite.it
    const frontendUrl = 'https://crm.noscite.it';

    // Gestisci errori OAuth
    if (error) {
      console.error('OAuth error:', { error, errorDescription });
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${frontendUrl}/settings?onedrive=error&message=${encodeURIComponent(errorDescription || error)}`,
        },
      });
    }

    if (!code) {
      console.error('Missing authorization code');
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${frontendUrl}/settings?onedrive=error&message=Missing+authorization+code`,
        },
      });
    }

    if (!state) {
      console.error('Missing state parameter');
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${frontendUrl}/settings?onedrive=error&message=Invalid+state`,
        },
      });
    }

    console.log('Authorization code and state received');

    const clientId = Deno.env.get('ONEDRIVE_CLIENT_ID');
    const clientSecret = Deno.env.get('ONEDRIVE_CLIENT_SECRET');
    const tenantId = Deno.env.get('ONEDRIVE_TENANT_ID');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/onedrive-callback`;

    if (!clientId || !clientSecret || !tenantId) {
      console.error('Missing OneDrive configuration');
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${frontendUrl}/settings?onedrive=error&message=Configuration+error`,
        },
      });
    }

    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      }
    );

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokens);
      const errorMsg = tokens.error_description || tokens.error || 'Token exchange failed';
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${frontendUrl}/settings?onedrive=error&message=${encodeURIComponent(errorMsg)}`,
        },
      });
    }

    console.log('Tokens obtained successfully');

    // Store tokens in Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const userId = state;
    
    console.log('Storing tokens for user:', userId);

    const { error: upsertError } = await supabase
      .from('onedrive_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      });

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${frontendUrl}/settings?onedrive=error&message=Failed+to+save+tokens`,
        },
      });
    }

    console.log('Tokens stored successfully, redirecting to:', frontendUrl);

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${frontendUrl}/settings?onedrive=connected`,
      },
    });
  } catch (error) {
    console.error('Error in onedrive-callback:', error);
    const frontendUrl = 'https://crm.noscite.it';
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${frontendUrl}/settings?onedrive=error&message=${encodeURIComponent(errorMsg)}`,
      },
    });
  }
});
});
```

