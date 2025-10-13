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
    const ocrSpaceApiKey = Deno.env.get('OCR_SPACE_API_KEY');
    
    if (!ocrSpaceApiKey) {
      throw new Error('OCR_SPACE_API_KEY not configured');
    }

    console.log('Processing business card with OCR.space API...');
    console.log('Image size:', imageBase64.length, 'characters');

    // Call OCR.space API
    const formData = new FormData();
    formData.append('base64Image', imageBase64);
    formData.append('language', 'ita');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // OCR Engine 2 is more accurate

    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': ocrSpaceApiKey,
      },
      body: formData,
    });

    if (!ocrResponse.ok) {
      const error = await ocrResponse.text();
      console.error('OCR.space API error:', error);
      throw new Error(`OCR.space API error: ${ocrResponse.status}`);
    }

    const ocrData = await ocrResponse.json();
    
    console.log('OCR.space response:', JSON.stringify(ocrData));

    if (ocrData.IsErroredOnProcessing) {
      throw new Error(ocrData.ErrorMessage?.[0] || 'OCR processing failed');
    }

    const rawText = ocrData.ParsedResults?.[0]?.ParsedText || '';
    console.log('Extracted text:', rawText);

    // Now use Lovable AI to parse the OCR text into structured data
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert at parsing business card text into structured contact information.

Extract contact details from the OCR text and return a JSON object with these EXACT fields:
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
            content: `Extract structured contact information from this business card OCR text:\n\n${rawText}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('Lovable AI API error:', error);
      throw new Error(`Lovable AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    console.log('Raw AI parsing response:', content);
    
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
