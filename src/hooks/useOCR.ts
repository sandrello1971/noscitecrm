import { useState } from 'react';
import Tesseract from 'tesseract.js';

export interface OCRData {
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  mobile?: string;
}

export const useOCR = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const extractTextFromImage = async (imageFile: File, language = 'ita'): Promise<{ text: string; confidence: number }> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(imageFile, language, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      setIsProcessing(false);
      return {
        text: result.data.text,
        confidence: result.data.confidence,
      };
    } catch (error) {
      setIsProcessing(false);
      throw error;
    }
  };

  const parseBusinessCard = (text: string): OCRData => {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const data: OCRData = {};

    // Regex patterns
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/gi;
    const phoneRegex = /(?:\+39|0039)?[\s.]?3\d{2}[\s.]?\d{6,7}|(?:\+39|0039)?[\s.]?0\d{1,4}[\s.]?\d{6,8}/gi;
    
    // Extract email
    const emailMatch = text.match(emailRegex);
    if (emailMatch) {
      data.email = emailMatch[0].toLowerCase();
    }

    // Extract phones
    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches) {
      if (phoneMatches[0]) {
        const cleanPhone = phoneMatches[0].replace(/[\s.]/g, '');
        if (cleanPhone.startsWith('3') || cleanPhone.startsWith('+393') || cleanPhone.startsWith('00393')) {
          data.mobile = phoneMatches[0];
          data.phone = phoneMatches[1] || undefined;
        } else {
          data.phone = phoneMatches[0];
          data.mobile = phoneMatches[1] || undefined;
        }
      }
    }

    // Try to extract name from first non-empty lines
    const potentialNameLines = lines.filter(line => 
      !emailRegex.test(line) && 
      !phoneRegex.test(line) &&
      line.length > 2 &&
      !/^(www\.|http|@)/i.test(line)
    );

    if (potentialNameLines.length > 0) {
      const nameParts = potentialNameLines[0].split(/\s+/).filter(p => p.length > 1);
      if (nameParts.length >= 2) {
        data.firstName = nameParts[0];
        data.lastName = nameParts.slice(1).join(' ');
      } else if (nameParts.length === 1) {
        data.lastName = nameParts[0];
      }
    }

    // Try to extract position/company from subsequent lines
    if (potentialNameLines.length > 1) {
      data.position = potentialNameLines[1];
    }
    if (potentialNameLines.length > 2) {
      data.company = potentialNameLines[2];
    }

    return data;
  };

  const processBusinessCard = async (imageFile: File, language = 'ita'): Promise<{ data: OCRData; confidence: number; rawText: string }> => {
    const { text, confidence } = await extractTextFromImage(imageFile, language);
    const data = parseBusinessCard(text);

    return {
      data,
      confidence,
      rawText: text,
    };
  };

  return {
    isProcessing,
    progress,
    processBusinessCard,
  };
};
