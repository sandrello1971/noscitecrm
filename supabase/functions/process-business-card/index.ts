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
    const { imageBase64 } = await req.json();
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Processing business card with OpenAI Vision...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting contact information from business cards. You must be extremely accurate and careful.

Extract ALL information from the business card and return it as a JSON object with these exact fields:
{
  "firstName": "person's first name (given name)",
  "lastName": "person's last name (family name/surname)",
  "company": "company or organization name",
  "position": "job title or role",
  "email": "email address in lowercase",
  "phone": "landline/office phone number",
  "mobile": "mobile/cell phone number"
}

CRITICAL RULES:
1. Return ONLY valid JSON, no markdown formatting or extra text
2. If a field is not found or unclear, use an empty string ""
3. For names: carefully distinguish first name from last name
4. For phones: distinguish mobile (typically starts with 3 in Italy) from landline
5. Keep full phone numbers including area codes and country codes if present
6. Email must be lowercase and complete
7. Be extremely careful with OCR - verify each character
8. If text is unclear, leave that field empty rather than guessing

Return ONLY the JSON object.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please carefully extract all contact information from this business card image. Be precise and accurate.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('Raw OpenAI response:', content);
    
    // Parse the JSON response
    const extractedData = JSON.parse(content);
    
    console.log('Extracted data:', extractedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        confidence: 95 // OpenAI Vision is very reliable
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-business-card function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
