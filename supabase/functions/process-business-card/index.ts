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

    // Apply rule-based extraction FIRST
    const ruleBasedData = applyRuleBasedExtraction(rawText);
    console.log('Rule-based extraction:', ruleBasedData);

    // Now use OpenAI to validate and clean the extracted data
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
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `You are a data validator for Italian business cards. You receive pre-extracted data and must clean and validate it.

Your job is to:
1. Capitalize firstName and lastName correctly (first letter uppercase)
2. Clean company name from OCR artifacts (remove ~, », ', aS, uy, etc.)
3. Clean position from artifacts
4. Validate email format (lowercase, no spaces)
5. Clean phone numbers

Return ONLY valid JSON with cleaned data. Do NOT reorganize fields - just clean them.

Example:
Input: {"firstName":"massimiliano","lastName":"diotti aS","company":"CREDIT AGRICOLE uy","position":"Gestore clienti SX"}
Output: {"firstName":"Massimiliano","lastName":"Diotti","company":"Credit Agricole","position":"Gestore Clienti"}`
          },
          {
            role: 'user',
            content: `Clean this pre-extracted data:\n\n${JSON.stringify(ruleBasedData, null, 2)}`
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
    
    console.log('AI cleaned data:', content);
    
    // Parse the JSON response
    const extractedData = JSON.parse(content);
    
    console.log('Final extracted data:', extractedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        confidence: 85 // Rule-based + AI cleaning is very reliable
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

// Rule-based extraction function
function applyRuleBasedExtraction(text: string): any {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  const result = {
    firstName: '',
    lastName: '',
    company: '',
    position: '',
    email: '',
    phone: '',
    mobile: ''
  };

  // Extract email (most reliable)
  const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase().replace(/\s+/g, '');
  }

  // Extract phone numbers
  const mobileRegex = /\+39\s*3\d{2}\s*\d{6,7}/g;
  const landlineRegex = /\+39\s*0\d{1,2}\s*\d{6,8}/g;
  
  const mobileMatch = text.match(mobileRegex);
  const landlineMatch = text.match(landlineRegex);
  
  if (mobileMatch) {
    result.mobile = mobileMatch[0].replace(/\s+/g, ' ').trim();
  }
  if (landlineMatch) {
    result.phone = landlineMatch[0].replace(/\s+/g, ' ').trim();
  }

  // Keywords for company detection
  const companyKeywords = ['s.p.a', 's.r.l', 'spa', 'srl', 'ltd', 'inc', 'gmbh'];
  const positionKeywords = ['manager', 'direttore', 'gestore', 'responsabile', 'consulente', 'ceo', 'director', 'titolare'];

  let personName = '';
  let companyName = '';
  let position = '';

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    
    // Skip email and phone lines
    if (emailRegex.test(line) || /\+39/.test(line) || /tel|cell|fax|phone/i.test(line)) {
      continue;
    }

    // Check if it's a company (all caps or contains company keywords)
    const isAllCaps = line === line.toUpperCase() && line.length > 2;
    const hasCompanyKeyword = companyKeywords.some(kw => lineLower.includes(kw));
    
    if ((isAllCaps || hasCompanyKeyword) && !companyName) {
      companyName = line;
      continue;
    }

    // Check if it's a position
    const hasPositionKeyword = positionKeywords.some(kw => lineLower.includes(kw));
    if (hasPositionKeyword && !position) {
      position = line;
      continue;
    }

    // Check if it's a person name (2-4 words, first and last capitalized)
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && !personName) {
      const firstWord = words[0];
      const lastWord = words[words.length - 1];
      
      // Check if first and last words start with capital
      if (firstWord[0] === firstWord[0].toUpperCase() && 
          lastWord[0] === lastWord[0].toUpperCase() &&
          !isAllCaps) {
        personName = line;
      }
    }
  }

  // Split person name into first and last
  if (personName) {
    const nameParts = personName.split(/\s+/);
    if (nameParts.length === 2) {
      result.firstName = nameParts[0];
      result.lastName = nameParts[1];
    } else if (nameParts.length > 2) {
      result.firstName = nameParts[0];
      result.lastName = nameParts.slice(1).join(' ');
    }
  }

  result.company = companyName;
  result.position = position;

  return result;
}
