import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Upload, Loader2, Check, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOCR, type OCRData } from '@/hooks/useOCR';
import { generateVCard, downloadVCard } from '@/utils/vcard';

export default function BusinessCardScanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isProcessing, progress, processBusinessCard } = useOCR();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [extractedData, setExtractedData] = useState<OCRData | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<OCRData>({});
  const [showCamera, setShowCamera] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const startCamera = async () => {
    console.log('startCamera called');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      console.log('Camera stream obtained:', stream);
      streamRef.current = stream;
      setIsVideoReady(false);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('Video srcObject set');
      }
      setShowCamera(true);
      console.log('showCamera set to true');
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Impossibile accedere alla fotocamera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setIsVideoReady(false);
  };

  const captureImage = () => {
    console.log('captureImage called');
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      console.log('Video dimensions:', video.videoWidth, video.videoHeight);
      
      // Check if video is ready
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        toast.error('La fotocamera non è ancora pronta. Riprova.');
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('Blob created, size:', blob.size);
            const file = new File([blob], 'business-card.jpg', { type: 'image/jpeg' });
            handleFileSelect(file);
            stopCamera();
          } else {
            console.error('Failed to create blob');
            toast.error('Errore nella cattura dell\'immagine');
          }
        }, 'image/jpeg', 0.95);
      } else {
        console.error('Could not get canvas context');
      }
    } else {
      console.error('videoRef or canvasRef not available', {
        video: !!videoRef.current,
        canvas: !!canvasRef.current
      });
      toast.error('Fotocamera non disponibile');
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setExtractedData(null);
    setFormData({});
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const processImage = async () => {
    if (!selectedFile) return;

    try {
      const result = await processBusinessCard(selectedFile, 'ita+eng');
      setExtractedData(result.data);
      setFormData(result.data);
      setConfidence(result.confidence);
      toast.success('Biglietto da visita scansionato con successo!');
    } catch (error) {
      toast.error('Errore durante la scansione del biglietto da visita');
      console.error(error);
    }
  };

  const checkForDuplicates = async () => {
    if (!user || !formData.email) return null;

    const { data: existingContact } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', formData.email)
      .maybeSingle();

    return existingContact;
  };

  const findOrCreateCompany = async () => {
    if (!user || !formData.company) return null;

    // Check if company exists
    const { data: existingCompany } = await supabase
      .from('crm_companies')
      .select('id')
      .eq('user_id', user.id)
      .ilike('name', formData.company)
      .maybeSingle();

    if (existingCompany) {
      return existingCompany.id;
    }

    // Create new company
    const { data: newCompany, error } = await supabase
      .from('crm_companies')
      .insert({
        user_id: user.id,
        name: formData.company,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) throw error;
    return newCompany.id;
  };

  const saveContact = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Check for duplicates
      const existingContact = await checkForDuplicates();
      if (existingContact) {
        toast.error('Esiste già un contatto con questa email');
        setIsSaving(false);
        return;
      }

      // Find or create company
      const companyId = await findOrCreateCompany();

      // Upload image to storage
      const fileName = `${user.id}/${Date.now()}_${selectedFile?.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, selectedFile!);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Create contact
      const { data: contact, error: contactError } = await supabase
        .from('crm_contacts')
        .insert({
          user_id: user.id,
          first_name: formData.firstName || '',
          last_name: formData.lastName || '',
          email: formData.email || null,
          phone: formData.phone || null,
          mobile: formData.mobile || null,
          position: formData.position || null,
          company_id: companyId,
          is_active: true,
        })
        .select()
        .single();

      if (contactError) throw contactError;

      // Save scan record
      await supabase
        .from('business_card_scans')
        .insert({
          user_id: user.id,
          company_id: companyId,
          contact_id: contact.id,
          image_url: publicUrl,
          original_file_name: selectedFile?.name || '',
          extracted_data: extractedData as any,
          corrected_data: formData as any,
          ocr_confidence: confidence,
          status: 'processed',
        });

      toast.success('Contatto salvato con successo!');
      
      // Reset form
      setSelectedFile(null);
      setPreviewUrl('');
      setExtractedData(null);
      setFormData({});
      setConfidence(0);
      
    } catch (error: any) {
      toast.error('Errore durante il salvataggio: ' + error.message);
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadVCard = () => {
    const vcard = generateVCard(formData);
    const fileName = `${formData.firstName || 'contact'}_${formData.lastName || ''}`.trim();
    downloadVCard(vcard, fileName);
    toast.success('vCard scaricata con successo');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/nosciteLOGO.png" 
              alt="Noscite" 
              className="h-10 w-10 object-contain"
            />
            <div className="flex flex-col">
              <span className="font-bold text-lg text-[#5DACA8]">NOSCITE</span>
              <span className="text-xs text-[#E07A47] font-medium -mt-1">
                Scanner Biglietti
              </span>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Vai al CRM
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 sm:p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Scanner Biglietti da Visita</CardTitle>
            <CardDescription>
              Scansiona o carica un biglietto da visita per estrarre automaticamente i dati del contatto
            </CardDescription>
          </CardHeader>
          <CardContent>
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" onClick={stopCamera}>
                <Upload className="mr-2 h-4 w-4" />
                Carica File
              </TabsTrigger>
              <TabsTrigger value="camera" onClick={startCamera}>
                <Camera className="mr-2 h-4 w-4" />
                Usa Fotocamera
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="max-w-sm"
                />
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-full h-auto max-h-96 rounded-lg shadow-lg"
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="camera" className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                {showCamera ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      onLoadedMetadata={() => {
                        console.log('Video metadata loaded');
                        setIsVideoReady(true);
                      }}
                      className="max-w-full rounded-lg shadow-lg"
                    />
                    <Button 
                      onClick={() => {
                        console.log('Button clicked, isVideoReady:', isVideoReady);
                        captureImage();
                      }}
                      disabled={!isVideoReady}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {isVideoReady ? 'Scatta Foto' : 'Caricamento...'}
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">Clicca sulla tab "Usa Fotocamera" per avviare la camera</p>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </TabsContent>
          </Tabs>

          {selectedFile && !extractedData && (
            <div className="mt-6">
              <Button
                onClick={processImage}
                disabled={isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scansione in corso... {progress}%
                  </>
                ) : (
                  <>Avvia Scansione OCR</>
                )}
              </Button>
              {isProcessing && <Progress value={progress} className="mt-2" />}
            </div>
          )}

          {extractedData && (
            <div className="mt-6 space-y-6">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Qualità scansione</h3>
                  <span className={`text-sm font-medium ${confidence > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {confidence.toFixed(1)}%
                  </span>
                </div>
                <Progress value={confidence} className="h-2" />
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Correggi i dati estratti</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Nome</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName || ''}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Cognome</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName || ''}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="company">Azienda</Label>
                  <Input
                    id="company"
                    value={formData.company || ''}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="position">Posizione</Label>
                  <Input
                    id="position"
                    value={formData.position || ''}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Telefono</Label>
                    <Input
                      id="phone"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mobile">Cellulare</Label>
                    <Input
                      id="mobile"
                      value={formData.mobile || ''}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={saveContact} disabled={isSaving} className="flex-1">
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvataggio...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Salva Contatto
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleDownloadVCard} 
                    variant="outline"
                    disabled={!formData.firstName && !formData.lastName}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Scarica vCard
                  </Button>

                  <Button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl('');
                      setExtractedData(null);
                      setFormData({});
                    }}
                    variant="outline"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Annulla
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </main>
    </div>
  );
}
