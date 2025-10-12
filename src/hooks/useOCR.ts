import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const processBusinessCard = async (imageFile: File): Promise<{ data: OCRData; confidence: number; rawText: string }> => {
    setIsProcessing(true);
    setProgress(10);

    try {
      // Convert image to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      setProgress(30);
      const imageBase64 = await base64Promise;
      
      setProgress(50);
      
      // Call edge function with OpenAI Vision
      const { data: result, error } = await supabase.functions.invoke('process-business-card', {
        body: { imageBase64 }
      });

      setProgress(90);

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to process business card');
      }

      setProgress(100);
      setIsProcessing(false);

      return {
        data: result.data,
        confidence: result.confidence,
        rawText: JSON.stringify(result.data, null, 2)
      };
    } catch (error) {
      setIsProcessing(false);
      setProgress(0);
      console.error('OCR processing error:', error);
      throw error;
    }
  };

  return {
    isProcessing,
    progress,
    processBusinessCard,
  };
};
