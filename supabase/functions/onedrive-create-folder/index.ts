import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('OneDrive create folder request received');
    
    const { companyName, readmeContent } = await req.json();
    console.log('Request data:', { companyName, readmeContentLength: readmeContent?.length });

    if (!companyName || !readmeContent) {
      return new Response(
        JSON.stringify({ error: 'Missing companyName or readmeContent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get OneDrive token
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('onedrive_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single();

    console.log('Token data retrieved:', { 
      hasTokenData: !!tokenData, 
      tokenError: tokenError?.message,
      expiresAt: tokenData?.expires_at 
    });

    if (tokenError || !tokenData) {
      console.error('Token error:', tokenError);
      return new Response(
        JSON.stringify({ error: 'OneDrive non connesso. Connetti OneDrive nelle impostazioni.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokenData.access_token;
    const tokenExpired = new Date(tokenData.expires_at) < new Date();
    
    console.log('Token status:', { tokenExpired });
    
    if (tokenExpired) {
      console.log('Token expired, refreshing...');
      const clientId = Deno.env.get('ONEDRIVE_CLIENT_ID');
      const clientSecret = Deno.env.get('ONEDRIVE_CLIENT_SECRET');
      const tenantId = Deno.env.get('ONEDRIVE_TENANT_ID');

      const refreshResponse = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            refresh_token: tokenData.refresh_token,
            grant_type: 'refresh_token',
          }),
        }
      );

      const newTokens = await refreshResponse.json();
      if (refreshResponse.ok) {
        console.log('Token refreshed successfully');
        accessToken = newTokens.access_token;
        
        await supabaseAdmin.from('onedrive_tokens').update({
          access_token: newTokens.access_token,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        }).eq('user_id', user.id);
      } else {
        console.error('Token refresh failed:', newTokens);
        throw new Error('Token OneDrive scaduto. Riconnetti OneDrive nelle impostazioni.');
      }
    }

    console.log('Creating folder structure on OneDrive...');

    // Usa la cartella corretta: "10_clienti" (minuscolo)
    console.log(`Creating company folder at: 10_clienti/${companyName}...`);
    
    // Prova a creare direttamente la cartella company dentro 10_clienti
    let createCompanyFolderResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/10_clienti:/children`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: companyName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename',
        }),
      }
    );

    // Se "10_clienti" non esiste (404), creala prima
    if (createCompanyFolderResponse.status === 404) {
      console.log('"10_clienti" folder does not exist, creating it first...');
      
      const createClientiResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root/children`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: '10_clienti',
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
          }),
        }
      );

      if (!createClientiResponse.ok) {
        const error = await createClientiResponse.json();
        // Ignora se esiste già
        if (error.error?.code !== 'nameAlreadyExists') {
          console.error('Failed to create 10_clienti folder:', error);
          throw new Error(`Errore creazione cartella 10_clienti: ${error.error?.message || 'Errore sconosciuto'}`);
        }
      }

      console.log('"10_clienti" folder created/verified, now creating company folder...');
      
      // Riprova a creare la cartella company
      createCompanyFolderResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root:/10_clienti:/children`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: companyName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          }),
        }
      );
    }

    if (!createCompanyFolderResponse.ok) {
      const error = await createCompanyFolderResponse.json();
      console.error('Company folder creation failed:', error);
      throw new Error(`Errore creazione cartella: ${error.error?.message || JSON.stringify(error.error)}`);
    }

    const companyFolder = await createCompanyFolderResponse.json();
    console.log('Company folder created successfully:', { 
      id: companyFolder.id, 
      name: companyFolder.name,
      webUrl: companyFolder.webUrl 
    });

    // STEP 3: Crea il file README.md nella cartella del cliente
    console.log('Step 3: Creating README.md file...');
    
    const readmeBlob = new TextEncoder().encode(readmeContent);
    
    const createReadmeResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${companyFolder.id}:/README.md:/content`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'text/markdown',
        },
        body: readmeBlob,
      }
    );

    if (!createReadmeResponse.ok) {
      const error = await createReadmeResponse.json();
      console.error('README creation failed:', error);
      
      // Non blocchiamo se il README fallisce, ma logghiamo
      console.warn('README creation failed, but folder was created successfully');
    } else {
      const readmeFile = await createReadmeResponse.json();
      console.log('README.md created successfully:', readmeFile.name);
    }

    console.log('OneDrive folder structure created successfully!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        folderUrl: companyFolder.webUrl,
        folderName: companyFolder.name,
        message: `Cartella "${companyFolder.name}" creata su OneDrive!`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in onedrive-create-folder:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Errore sconosciuto durante la creazione della cartella'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
