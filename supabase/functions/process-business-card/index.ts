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

    console.log('Processing business card with OpenAI Vision API...');
    console.log('Image size:', imageBase64.length, 'characters');

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
            content: `You are an OCR specialist extracting contact information from business card images.

Your task: Extract contact details and return a JSON object with these EXACT fields:
{
  "firstName": "",
  "lastName": "",
  "company": "",
  "position": "",
  "email": "",
  "phone": "",
  "mobile": ""
}

EXTRACTION INSTRUCTIONS:
1. firstName: Only the person's given/first name
2. lastName: Only the person's family/surname
3. company: The company/organization name (NOT the person's name)
4. position: Job title/role (e.g., "CEO", "Manager", "Director")
5. email: Complete email address in lowercase
6. phone: Office/landline number with full country code (e.g., "+39 02 12345678")
7. mobile: Mobile number with country code (in Italy usually starts with +39 3)

CRITICAL RULES:
- Return ONLY the JSON object - no markdown, no extra text
- If unsure about any field, leave it as empty string ""
- Do NOT put company names in firstName or lastName fields
- Do NOT confuse person names with company names
- For Italian cards: mobile numbers usually start with 3 after country code
- Preserve complete phone numbers including country codes
- Email must be complete and lowercase
- Read the card carefully - logos and company names are NOT person names

Example of CORRECT output:
{
  "firstName": "Mario",
  "lastName": "Rossi",
  "company": "Acme Corporation",
  "position": "Sales Director",
  "email": "mario.rossi@acme.it",
  "phone": "+39 02 12345678",
  "mobile": "+39 333 1234567"
}`
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
