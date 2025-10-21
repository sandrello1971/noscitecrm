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

    // Gestisci errori OAuth
    if (error) {
      console.error('OAuth error:', { error, errorDescription });
      const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || '';
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${frontendUrl}/settings?onedrive=error&message=${encodeURIComponent(errorDescription || error)}`,
        },
      });
    }

    if (!code) {
      console.error('Missing authorization code');
      const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || '';
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${frontendUrl}/settings?onedrive=error&message=Missing+authorization+code`,
        },
      });
    }

    if (!state) {
      console.error('Missing state parameter');
      const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || '';
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
      const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || '';
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
      const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || '';
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
      const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || '';
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${frontendUrl}/settings?onedrive=error&message=Failed+to+save+tokens`,
        },
      });
    }

    console.log('Tokens stored successfully');

    const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || '';
    
    console.log('Redirecting to:', frontendUrl);

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${frontendUrl}/settings?onedrive=connected`,
      },
    });
  } catch (error) {
    console.error('Error in onedrive-callback:', error);
    const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || '';
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${frontendUrl}/settings?onedrive=error&message=${encodeURIComponent(errorMsg)}`,
      },
    });
  }
});
```

### 1.3 - Sostituisci `onedrive-create-folder/index.ts`

Usa il codice che ti ho fornito nell'artifact `onedrive_fixed` (lo trovi sopra nella conversazione).

---

## 📋 **PASSO 2: Configura Azure AD**

### 2.1 - Accedi ad Azure Portal

1. Vai su [portal.azure.com](https://portal.azure.com)
2. Accedi con il tuo account Microsoft

### 2.2 - Vai alle App Registrations

1. Cerca **"Microsoft Entra ID"** (o "Azure Active Directory")
2. Nel menu a sinistra clicca su **"App registrations"**
3. Cerca la tua app per OneDrive (o creane una nuova se non esiste)

### 2.3 - Configura il Redirect URI

1. Clicca sulla tua app
2. Nel menu a sinistra clicca su **"Authentication"**
3. Sotto **"Platform configurations"** → **"Web"**
4. Clicca **"Add URI"**
5. Inserisci: `https://cpopaqguywwaqprrvony.supabase.co/functions/v1/onedrive-callback`
   
   ⚠️ **IMPORTANTE**: Sostituisci `cpopaqguywwaqprrvony` con il TUO project ID di Supabase!

6. Clicca **"Save"**

### 2.4 - Verifica i Permessi API

1. Nel menu a sinistra clicca su **"API permissions"**
2. Verifica che ci siano questi permessi **Microsoft Graph**:
   - `Files.ReadWrite` (Delegated)
   - `offline_access` (Delegated)
   - `User.Read` (Delegated)

3. Se mancano, clicca **"Add a permission"** → **"Microsoft Graph"** → **"Delegated permissions"** e aggiungili

4. Clicca **"Grant admin consent"** (il bottone in alto)

### 2.5 - Prendi nota di Client ID e Tenant ID

1. Nel menu a sinistra clicca su **"Overview"**
2. Copia questi valori (li userai dopo):
   - **Application (client) ID** 
   - **Directory (tenant) ID**

### 2.6 - Crea/Verifica il Client Secret

1. Nel menu a sinistra clicca su **"Certificates & secrets"**
2. Sotto **"Client secrets"** clicca **"New client secret"**
3. Descrizione: `OneDrive CRM Secret`
4. Scadenza: scegli 24 mesi
5. Clicca **"Add"**
6. **⚠️ IMPORTANTE**: Copia il **Value** SUBITO (non lo vedrai più dopo!)

---

## 📋 **PASSO 3: Configura le variabili d'ambiente in Supabase**

### 3.1 - Vai su Supabase Dashboard

1. Vai su [supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto

### 3.2 - Aggiungi i Secrets

1. Vai su **Project Settings** (icona ingranaggio in basso a sinistra)
2. Clicca su **Edge Functions** nel menu
3. Scorri fino a **Function Secrets**
4. Aggiungi questi secrets (uno alla volta):
```
Nome: ONEDRIVE_CLIENT_ID
Valore: [il Client ID che hai copiato da Azure]

Nome: ONEDRIVE_CLIENT_SECRET
Valore: [il Client Secret che hai copiato da Azure]

Nome: ONEDRIVE_TENANT_ID
Valore: [il Tenant ID che hai copiato da Azure]

Nome: FRONTEND_URL
Valore: https://cpopaqguywwaqprrvony.lovableproject.com
