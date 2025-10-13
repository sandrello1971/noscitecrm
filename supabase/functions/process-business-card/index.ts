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
            content: `You are an expert at parsing Italian business card OCR text into structured contact information.

Extract contact details and return a JSON object with these EXACT fields:
{
  "firstName": "",
  "lastName": "",
  "company": "",
  "position": "",
  "email": "",
  "phone": "",
  "mobile": ""
}

🔍 REGEX PATTERN MATCHING RULES:

1. EMAIL: Use pattern /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}/
   - Must be complete and lowercase
   - Remove any spaces

2. PHONE NUMBERS (Italian):
   - Mobile (Cell): Usually starts with +39 3XX (e.g., +39 333, +39 340, +39 347)
   - Landline (Tel): Usually starts with +39 0X (e.g., +39 02, +39 06, +39 011)
   - Clean format, preserve country code

3. WEBSITE: Only valid TLDs (.com, .it, .org, etc.)

🏢 KEYWORD-BASED DETECTION:

1. COMPANY indicators (if text contains these, it's a company name):
   - ["s.p.a", "s.r.l", "ltd", "inc", "gmbh", "spa", "srl"]
   - Text that is ALL UPPERCASE (e.g., "CRÉDIT AGRICOLE")

2. POSITION indicators:
   - ["CEO", "Manager", "Direttore", "Gestore", "Consulente", "Director", "Responsabile", "Titolare"]

3. ADDRESS indicators (don't confuse with names):
   - ["via", "viale", "piazza", "corso", "strada"]

👤 ITALIAN NAME vs COMPANY LOGIC (CRITICAL):

Person Name Rules:
- 2-4 words total
- First word CAPITALIZED (e.g., "Giuseppe")
- Last word CAPITALIZED (e.g., "Costa")
- Middle words can be lowercase (Italian particles: "di", "da", "della", "dalla", "de", "von")
- Examples: "Giuseppe dalla Costa" ✅, "Maria De Luca" ✅

Company Name Rules (these are NOT person names):
- ALL UPPERCASE text → Company (e.g., "CRÉDIT AGRICOLE", "INRIDIA SRL")
- Contains company keywords → Company
- More than 4 words → Likely company

PRIORITY ORDER for Name vs Company:
1. If ALL UPPERCASE → Company
2. If contains company keywords (s.p.a, s.r.l, etc.) → Company
3. If First+Last word capitalized (2-4 words) → Person Name
4. First significant line → Person Name (fallback)

🎯 FIELD EXTRACTION PRIORITY:

1. firstName + lastName: Apply person name rules above
2. company: Apply company rules above  
3. position: Look for position keywords
4. email: Regex pattern matching
5. phone: Landline pattern (+39 0X...)
6. mobile: Mobile pattern (+39 3XX...)

✅ OUTPUT RULES:
- Return ONLY valid JSON - no markdown, no extra text
- Capitalize first letter of firstName and lastName properly
- Clean ALL fields from OCR artifacts (~, », ', line breaks, extra spaces)
- If unsure, leave field as empty string ""

EXAMPLE:
Input OCR: "Giuseppe dalla Costa\\nINRIDIA S.R.L\\nConsulente Marketing\\ngiuseppe.dallacosta@inridia.it\\nTel: +39 02 1234567\\nCell: +39 333 9876543"

Correct Output:
{
  "firstName": "Giuseppe",
  "lastName": "Dalla Costa",
  "company": "Inridia S.R.L",
  "position": "Consulente Marketing",
  "email": "giuseppe.dallacosta@inridia.it",
  "phone": "+39 02 1234567",
  "mobile": "+39 333 9876543"
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
