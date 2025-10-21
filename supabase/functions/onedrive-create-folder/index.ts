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
        JSON.stringify({ error: 'OneDrive not connected. Please connect OneDrive first.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokenData.access_token;
    const tokenExpired = new Date(tokenData.expires_at) < new Date();
    
    console.log('Token status:', { tokenExpired });
    
    if (tokenExpired) {
      console.log('Token expired, refreshing...');
      // Refresh token logic here
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
        throw new Error('Failed to refresh OneDrive token. Please reconnect your account.');
      }
    }

    console.log('Creating folder on OneDrive...');

    // Extract the folder ID from the SharePoint URL
    // URL: https://noscite-my.sharepoint.com/:f:/g/personal/stefanoandrello_noscite_onmicrosoft_com/Eoz0gBgwpQtLocfJXCwyadsBR6AVHcMs6xIZbfU-piZpAQ?e=ninruZ
    const folderId = 'Eoz0gBgwpQtLocfJXCwyadsBR6AVHcMs6xIZbfU-piZpAQ';

    // Create folder
    const createFolderResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`,
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

    const folder = await createFolderResponse.json();
    console.log('Folder creation response:', { ok: createFolderResponse.ok, folder });

    if (!createFolderResponse.ok) {
      console.error('Folder creation failed:', folder);
      throw new Error(`Failed to create folder: ${folder.error?.message || JSON.stringify(folder)}`);
    }

    // Create README.md file in the new folder
    const readmeBlob = new TextEncoder().encode(readmeContent);
    
    const createFileResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${folder.id}:/README.md:/content`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'text/markdown',
        },
        body: readmeBlob,
      }
    );

    const file = await createFileResponse.json();
    console.log('README creation response:', { ok: createFileResponse.ok, file });

    if (!createFileResponse.ok) {
      console.error('README creation failed:', file);
      throw new Error(`Failed to create README: ${file.error?.message || JSON.stringify(file)}`);
    }

    console.log('Folder and README created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        folderUrl: folder.webUrl,
        message: 'Cartella e README creati su OneDrive!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in onedrive-create-folder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
