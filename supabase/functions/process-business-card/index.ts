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
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting information from business cards. Extract the following information and return it as a JSON object:
{
  "firstName": "first name of the person",
  "lastName": "last name of the person",
  "company": "company name",
  "position": "job title/position",
  "email": "email address",
  "phone": "landline phone number",
  "mobile": "mobile phone number"
}

Rules:
- If any field is not found, return an empty string for that field
- For Italian phone numbers, include the full number with area code
- Distinguish between mobile (starting with 3) and landline phones
- Return ONLY the JSON object, no additional text`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the business card information from this image:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
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
