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

    // Now use OpenAI GPT-5 to parse the OCR text into structured data
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        max_completion_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `You are an expert at parsing Italian business card OCR text. You MUST follow these rules strictly.

STEP 1: ANALYZE THE TEXT
First, identify what each line represents by analyzing patterns:
- ALL CAPS text with keywords (S.P.A, S.R.L, LTD) = Company name
- Mixed case 2-3 words with first letters capitalized = Person name
- Words like "Manager", "Direttore", "Gestore", "Responsabile" = Job position
- Email addresses = email field
- Numbers starting with +39 3XX = Mobile phone
- Numbers starting with +39 0X = Landline phone

STEP 2: APPLY EXTRACTION RULES

🔍 REGEX PATTERNS:
- Email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}/
- Mobile: +39 3XX XXXXXXX
- Landline: +39 0X XXXXXXXX

👤 PERSON NAME RULES (CRITICAL):
✅ Person names are typically:
  - 2-4 words
  - First word capitalized (e.g., "Massimiliano")
  - Last word capitalized (e.g., "Diotti")
  - May have lowercase particles: "di", "da", "della", "de"
  - NOT in all caps
  - NOT containing company keywords

❌ NOT person names:
  - ALL CAPS = Company (e.g., "CREDIT AGRICOLE")
  - Contains S.P.A, S.R.L, LTD, INC = Company
  - Job titles = Position

🏢 COMPANY NAME RULES:
✅ Company indicators:
  - ALL UPPERCASE (e.g., "CREDIT AGRICOLE")
  - Contains: s.p.a, s.r.l, ltd, inc, gmbh, spa, srl
  - More than 4 words
  
💼 POSITION RULES:
✅ Job title indicators:
  - Contains: Manager, Direttore, Gestore, Responsabile, CEO, Director, Consulente, Titolare
  - Usually comes after the person name
  - NOT a person name or company name

EXTRACTION ORDER:
1. Find email first (most reliable)
2. Find phone numbers (mobile vs landline)
3. Identify company (ALL CAPS or keywords)
4. Identify position (job title keywords)
5. Find person name (what's left that matches name pattern)

Return ONLY this JSON (no markdown, no extra text):
{
  "firstName": "",
  "lastName": "",
  "company": "",
  "position": "",
  "email": "",
  "phone": "",
  "mobile": ""
}

FORMATTING RULES:
- firstName/lastName: Capitalize first letter only
- company: Keep original case but clean artifacts
- email: Lowercase, no spaces
- phone/mobile: +39 XX XXXXXXXX format

EXAMPLE:
OCR Text: "Massimiliano Diotti\\nCREDIT AGRICOLE S.P.A\\nGestore Clienti\\nmassimiliano.diotti@credit-agricole.it\\nTel: +39 02 48601625\\nCell: +39 337 1286177"

ANALYSIS:
- "Massimiliano Diotti" = Person name (2 words, capitalized)
- "CREDIT AGRICOLE S.P.A" = Company (ALL CAPS + S.P.A)
- "Gestore Clienti" = Position (job title keyword "Gestore")
- "massimiliano.diotti@credit-agricole.it" = Email
- "+39 02 48601625" = Landline (starts with 0X)
- "+39 337 1286177" = Mobile (starts with 3XX)

CORRECT OUTPUT:
{
  "firstName": "Massimiliano",
  "lastName": "Diotti",
  "company": "Credit Agricole S.P.A",
  "position": "Gestore Clienti",
  "email": "massimiliano.diotti@credit-agricole.it",
  "phone": "+39 02 48601625",
  "mobile": "+39 337 1286177"
}`
          },
          {
            role: 'user',
            content: `Extract structured contact information from this Italian business card OCR text. Follow the analysis steps carefully:\n\n${rawText}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
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
        confidence: 85 // GPT-5 with rule-based parsing is very reliable
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
