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

  // Helper function to compress and resize image
  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize to max 1200px maintaining aspect ratio
          const maxSize = 1200;
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress with quality 0.9
          let quality = 0.9;
          let base64 = canvas.toDataURL('image/jpeg', quality);
          
          // If still too large, reduce quality further
          while (base64.length > 1024 * 1024 && quality > 0.5) {
            quality -= 0.1;
            base64 = canvas.toDataURL('image/jpeg', quality);
          }
          
          resolve(base64);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processBusinessCard = async (imageFile: File): Promise<{ data: OCRData; confidence: number; rawText: string }> => {
    setIsProcessing(true);
    setProgress(10);

    try {
      // Compress and resize image to stay under 1MB
      setProgress(20);
      const imageBase64 = await compressImage(imageFile);
      
      setProgress(30);
      
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
