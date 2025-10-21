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

    // STEP 1: Ottieni o crea la cartella root "Clienti" usando il path invece dell'ID
    console.log('Step 1: Checking/creating root "Clienti" folder...');
    
    let clientiFolderId: string;
    
    // Prima prova a ottenere la cartella Clienti se esiste
    const checkRootResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/Clienti`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (checkRootResponse.ok) {
      const rootFolder = await checkRootResponse.json();
      clientiFolderId = rootFolder.id;
      console.log('Root "Clienti" folder found:', clientiFolderId);
    } else {
      // La cartella non esiste, creiamola
      console.log('Root "Clienti" folder not found, creating it...');
      const createRootResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root/children`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Clienti',
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
          }),
        }
      );

      if (!createRootResponse.ok) {
        const error = await createRootResponse.json();
        console.error('Failed to create root folder:', error);
        
        // Gestisci errori specifici
        if (error.error?.code === 'nameAlreadyExists') {
          // Se esiste già, riprova a recuperarla
          const retryResponse = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/root:/Clienti`,
            {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${accessToken}` },
            }
          );
          if (retryResponse.ok) {
            const folder = await retryResponse.json();
            clientiFolderId = folder.id;
          } else {
            throw new Error('Impossibile accedere alla cartella Clienti su OneDrive');
          }
        } else if (error.error?.code === 'accessDenied') {
          throw new Error('Accesso negato. Verifica i permessi OneDrive nelle impostazioni.');
        } else {
          throw new Error(`Errore creazione cartella root: ${error.error?.message || 'Errore sconosciuto'}`);
        }
      } else {
        const rootFolder = await createRootResponse.json();
        clientiFolderId = rootFolder.id;
        console.log('Root "Clienti" folder created:', clientiFolderId);
      }
    }

    // STEP 2: Crea la cartella del cliente dentro "Clienti"
    console.log(`Step 2: Creating company folder "${companyName}" inside Clienti...`);
    
    const createCompanyFolderResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${clientiFolderId}/children`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: companyName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename', // Se esiste già, crea con nome diverso
        }),
      }
    );

    if (!createCompanyFolderResponse.ok) {
      const error = await createCompanyFolderResponse.json();
      console.error('Company folder creation failed:', error);
      
      if (error.error?.code === 'accessDenied') {
        throw new Error('Accesso negato alla cartella Clienti. Verifica i permessi OneDrive.');
      }
      
      throw new Error(`Errore creazione cartella cliente: ${error.error?.message || 'Errore sconosciuto'}`);
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
