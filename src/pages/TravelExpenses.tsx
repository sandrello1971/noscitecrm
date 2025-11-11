import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Car, Download, Plus, Trash2, Calendar, Pencil, X, FileText, Copy, ArrowLeft, Upload, Eye, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface TravelExpense {
  id: string;
  mission_description: string;
  departure_location: string;
  arrival_location: string;
  distance_km: number;
  reimbursement_rate_per_km: number;
  travel_date: string;
  notes?: string;
  vehicle_plate?: string;
  vehicle_model?: string;
  requires_diaria?: boolean;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected';
  attachment_urls?: Array<{ name: string; url: string; size: number }>;
  submitted_at?: string;
  finalized_at?: string;
}

const TravelExpenses = () => {
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form state
  const [missionDescription, setMissionDescription] = useState('');
  const [departureLocation, setDepartureLocation] = useState('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [reimbursementRate, setReimbursementRate] = useState('0.50');
  const [travelDate, setTravelDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [requiresDiaria, setRequiresDiaria] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [viewingAttachments, setViewingAttachments] = useState<TravelExpense | null>(null);

  const fetchExpenses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      const startDate = `${selectedMonth}-01`;
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('travel_expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('travel_date', startDate)
        .lte('travel_date', endDate)
        .order('travel_date', { ascending: false });

      if (error) throw error;
      setExpenses((data || []).map(exp => ({
        ...exp,
        status: exp.status as 'draft' | 'submitted' | 'approved' | 'rejected',
        attachment_urls: exp.attachment_urls ? JSON.parse(JSON.stringify(exp.attachment_urls)) : []
      })));
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare le spese di viaggio",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedMonth]);

  const resetForm = () => {
    setMissionDescription('');
    setDepartureLocation('');
    setArrivalLocation('');
    setDistanceKm('');
    setReimbursementRate('0.50');
    setNotes('');
    setTravelDate(format(new Date(), 'yyyy-MM-dd'));
    setVehiclePlate('');
    setVehicleModel('');
    setRequiresDiaria(false);
    setAttachments([]);
    setEditingId(null);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!missionDescription || !departureLocation || !arrivalLocation || !distanceKm) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      // Upload attachments if any
      let uploadedAttachments: Array<{ name: string; url: string; size: number }> = [];
      
      if (attachments.length > 0) {
        for (const file of attachments) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('travel-expense-attachments')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('travel-expense-attachments')
            .getPublicUrl(fileName);

          uploadedAttachments.push({
            name: file.name,
            url: publicUrl,
            size: file.size
          });
        }
      }

      if (editingId) {
        // Update existing expense - merge with existing attachments
        const existingExpense = expenses.find(e => e.id === editingId);
        const mergedAttachments = [
          ...(existingExpense?.attachment_urls || []),
          ...uploadedAttachments
        ];

        const { error } = await supabase
          .from('travel_expenses')
          .update({
            mission_description: missionDescription,
            departure_location: departureLocation,
            arrival_location: arrivalLocation,
            distance_km: parseFloat(distanceKm),
            reimbursement_rate_per_km: parseFloat(reimbursementRate),
            travel_date: travelDate,
            notes: notes || null,
            vehicle_plate: vehiclePlate || null,
            vehicle_model: vehicleModel || null,
            requires_diaria: requiresDiaria,
            attachment_urls: mergedAttachments,
          })
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: "Aggiornato",
          description: "Spesa modificata con successo",
        });
      } else {
        // Create new expense
        const { error } = await supabase.from('travel_expenses').insert({
          user_id: user.id,
          mission_description: missionDescription,
          departure_location: departureLocation,
          arrival_location: arrivalLocation,
          distance_km: parseFloat(distanceKm),
          reimbursement_rate_per_km: parseFloat(reimbursementRate),
          travel_date: travelDate,
          notes: notes || null,
          vehicle_plate: vehiclePlate || null,
          vehicle_model: vehicleModel || null,
          requires_diaria: requiresDiaria || false,
          attachment_urls: uploadedAttachments,
          status: 'draft',
        });

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Spesa di viaggio aggiunta",
        });
      }

      resetForm();
      fetchExpenses();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditExpense = (expense: TravelExpense) => {
    setEditingId(expense.id);
    setMissionDescription(expense.mission_description);
    setDepartureLocation(expense.departure_location);
    setArrivalLocation(expense.arrival_location);
    setDistanceKm(expense.distance_km.toString());
    setReimbursementRate(expense.reimbursement_rate_per_km.toString());
    setTravelDate(expense.travel_date);
    setNotes(expense.notes || '');
    setVehiclePlate(expense.vehicle_plate || '');
    setVehicleModel(expense.vehicle_model || '');
    setRequiresDiaria(expense.requires_diaria || false);
  };

  const handleDuplicateExpense = (expense: TravelExpense) => {
    setEditingId(null); // Clear any editing state
    setMissionDescription(expense.mission_description);
    setDepartureLocation(expense.departure_location);
    setArrivalLocation(expense.arrival_location);
    setDistanceKm(expense.distance_km.toString());
    setReimbursementRate(expense.reimbursement_rate_per_km.toString());
    setTravelDate(format(new Date(), 'yyyy-MM-dd')); // Set to today
    setNotes(expense.notes || '');
    setVehiclePlate(expense.vehicle_plate || '');
    setVehicleModel(expense.vehicle_model || '');
    setRequiresDiaria(expense.requires_diaria || false);
    
    toast({
      title: "Pronto per duplicare",
      description: "Modifica i dati e clicca Aggiungi per salvare",
    });
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa spesa?')) return;

    try {
      // Get expense to delete attachments
      const expense = expenses.find(e => e.id === id);
      
      // Delete attachments from storage
      if (expense?.attachment_urls && expense.attachment_urls.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          for (const att of expense.attachment_urls) {
            const path = att.url.split('/').slice(-2).join('/'); // Get user_id/filename
            await supabase.storage
              .from('travel-expense-attachments')
              .remove([path]);
          }
        }
      }

      const { error } = await supabase.from('travel_expenses').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: "Eliminato",
        description: "Spesa eliminata con successo",
      });
      
      if (editingId === id) {
        resetForm();
      }
      
      fetchExpenses();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFinalizeExpense = async (id: string) => {
    if (!confirm('Vuoi finalizzare questa nota spese? Una volta finalizzata non potrà essere modificata.')) return;

    try {
      const { error } = await supabase.rpc('finalize_travel_expense', { expense_id: id });
      
      if (error) throw error;

      toast({
        title: "Finalizzata",
        description: "Nota spese finalizzata con successo",
      });
      
      fetchExpenses();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleExportToExcel = async () => {
    if (expenses.length === 0) {
      toast({
        title: "Attenzione",
        description: "Nessun dato da esportare per questo mese",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      // Get user profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const userName = profile?.full_name || user.email || 'Utente';

      // Load the template
      const templateUrl = new URL('../assets/rimborso_template.xls', import.meta.url).href;
      const response = await fetch(templateUrl);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // Remove all sheets except the second one (Page 2)
      const sheetName = workbook.SheetNames[1]; // Get the second sheet name
      const worksheet = workbook.Sheets[sheetName];
      
      // Remove all other sheets
      workbook.SheetNames = [sheetName];
      workbook.Sheets = { [sheetName]: worksheet };

      // Replace placeholders
      const downloadDate = format(new Date(), 'dd/MM/yyyy', { locale: it });
      const monthName = format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: it });
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            if (typeof cell.v === 'string') {
              if (cell.v.includes('<datadownload>')) {
                cell.v = cell.v.replace('<datadownload>', downloadDate);
              }
              if (cell.v.includes('<nomeutente>')) {
                cell.v = cell.v.replace('<nomeutente>', userName);
              }
              if (cell.v.includes('<mese>')) {
                cell.v = cell.v.replace('<mese>', monthName);
              }
            }
          }
        }
      }

      // Insert expense data starting from row 81 (index 80)
      let currentRow = 80;
      expenses.forEach((expense) => {
        const kmReimbursement = expense.distance_km * expense.reimbursement_rate_per_km;
        const diariaAmount = expense.requires_diaria ? 46 : 0;
        const totalExpense = kmReimbursement + diariaAmount;
        
        worksheet[`A${currentRow}`] = { t: 's', v: format(new Date(expense.travel_date), 'dd/MM/yyyy', { locale: it }) };
        worksheet[`B${currentRow}`] = { t: 's', v: `${expense.mission_description} - ${expense.departure_location}/${expense.arrival_location}${expense.requires_diaria ? ' + Diaria' : ''}` };
        worksheet[`E${currentRow}`] = { t: 'n', v: expense.distance_km };
        worksheet[`F${currentRow}`] = { t: 'n', v: expense.reimbursement_rate_per_km };
        worksheet[`G${currentRow}`] = { t: 'n', v: parseFloat(totalExpense.toFixed(2)) };
        worksheet[`H${currentRow}`] = { t: 's', v: expense.notes || '-' };
        currentRow++;
      });

      // Add totals at row 93 (index 92)
      worksheet['F93'] = { t: 's', v: 'EURO' };
      worksheet['G93'] = { t: 'n', v: parseFloat(totalAmount.toFixed(2)) };

      // Update cell range to include new data
      const newRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      if (currentRow > newRange.e.r) {
        newRange.e.r = currentRow;
        worksheet['!ref'] = XLSX.utils.encode_range(newRange);
      }

      const monthFileName = format(new Date(selectedMonth + '-01'), 'MMMM-yyyy', { locale: it });
      XLSX.writeFile(workbook, `rimborsi-chilometrici-${monthFileName}.xls`);

      toast({
        title: "Export completato",
        description: "Il file Excel è stato scaricato",
      });
    } catch (error: any) {
      toast({
        title: "Errore export",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExportToPDF = async () => {
    if (expenses.length === 0) {
      toast({
        title: "Attenzione",
        description: "Nessun dato da esportare per questo mese",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

      const userName = userProfile 
        ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() 
        : 'Utente';
      const downloadDate = format(new Date(), 'dd/MM/yyyy', { locale: it });
      const monthName = format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: it });

      const doc = new jsPDF();

      // Header
      doc.setFontSize(10);
      doc.text(`data emissione: ${downloadDate}`, 14, 15);
      doc.text(`mese: ${monthName}`, 14, 20);
      
      // Company info - aligned to the right but with proper margins
      doc.text('Noscite s.r.l.s.', 120, 15);
      doc.text('Via Monte Grappa 13, Corsico (MI)', 120, 20);
      doc.setFontSize(9);
      doc.text('Codice fiscale e partita iva', 120, 25);
      doc.text('14385240966', 120, 29);

      // Authorization text
      doc.setFontSize(9);
      doc.text(`Il sig.${userName} con sede di lavoro a Corsico (MI) è autorizzato ad effettuare il viaggio`, 14, 38);
      doc.text('utilizzando il proprio automezzo nei termini indicati nel seguente riquadro:', 14, 43);

      // Vehicle info
      doc.setFontSize(9);
      const firstExpense = expenses[0];
      const vehicleInfo = firstExpense.vehicle_model || '';
      const vehiclePlate = firstExpense.vehicle_plate || '';
      
      doc.text('automezzo da utilizzare', 14, 51);
      doc.text(vehicleInfo, 80, 51);
      doc.text('targa', 150, 51);
      doc.text(vehiclePlate, 170, 51);
      doc.text('c.c.', 185, 51);

      // Table
      const tableData = expenses.map((expense) => {
        const kmReimbursement = expense.distance_km * expense.reimbursement_rate_per_km;
        const diariaAmount = expense.requires_diaria ? 46 : 0;
        const totalExpense = kmReimbursement + diariaAmount;
        
        return [
          format(new Date(expense.travel_date), 'dd/MM/yyyy', { locale: it }),
          expense.departure_location,
          expense.arrival_location,
          expense.distance_km.toFixed(1),
          `€${expense.reimbursement_rate_per_km.toFixed(2)}`,
          expense.requires_diaria ? '€46' : '-',
          `€${kmReimbursement.toFixed(2)}`,
          `€${totalExpense.toFixed(2)}`,
          expense.notes || '-'
        ];
      });

      autoTable(doc, {
        startY: 58,
        head: [['DATA', 'DA', 'A', 'KM', '€/KM', 'Diaria', 'Ind. KM', 'Totale', 'Note']],
        body: tableData,
        foot: [['TOTALI', '', '', totalKm.toFixed(1), '', '', '', `€${totalAmount.toFixed(2)}`, '']],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { 
          fillColor: [220, 220, 220], 
          textColor: [0, 0, 0], 
          lineWidth: 0.5, 
          lineColor: [0, 0, 0],
          fontStyle: 'bold'
        },
        footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;

      // Footer sections
      doc.setFontSize(8);
      doc.text('GIUSTIFICATIVI ALLEGATI', 14, finalY);
      doc.text('MANDATO DI PAGAMENTO', 80, finalY);
      doc.text('TOTALE NOTA', 150, finalY);
      
      doc.text('N. _______________', 14, finalY + 5);
      doc.text('N.                  DEL', 80, finalY + 5);
      doc.text(`SPESE: €${totalAmount.toFixed(2)}`, 150, finalY + 5);
      
      doc.text('', 80, finalY + 10);
      doc.text('ANTICIPO', 150, finalY + 10);
      
      doc.text("V. RISCONTRO CONTABILITA'", 14, finalY + 15);
      doc.text('V. LA DIREZIONE', 80, finalY + 15);
      doc.text('DEL', 150, finalY + 15);
      
      doc.text('', 80, finalY + 20);
      doc.text('ANTICIPO', 150, finalY + 20);
      
      doc.text('', 80, finalY + 25);
      doc.text('DEL', 150, finalY + 25);
      
      doc.text('DATA RIMBORSO', 14, finalY + 30);
      doc.text('FIRMA DEL DIPENDENTE', 80, finalY + 30);
      doc.text('IMPORTO DA', 150, finalY + 30);
      
      doc.text(format(new Date(), 'dd.MM.yyyy', { locale: it }), 14, finalY + 35);
      doc.text('', 80, finalY + 35);
      doc.text(`RIMBORSARE: €${totalAmount.toFixed(2)}`, 150, finalY + 35);
      
      doc.text('', 14, finalY + 40);
      doc.text('', 80, finalY + 40);
      doc.text('EURO', 150, finalY + 40);

      // Note
      doc.setFontSize(7);
      doc.text('N.B. : non sono consentiti rimborsi spese per percorrenze effettuate esclusivamente nell\'ambito del Comune in cui si trova', 14, finalY + 50);
      doc.text('la sede del lavoro (cir. Min. 20.11.1976,n.13/RT/1702)', 14, finalY + 54);

      const monthFileName = format(new Date(selectedMonth + '-01'), 'MMMM-yyyy', { locale: it });
      doc.save(`rimborsi-chilometrici-${monthFileName}.pdf`);

      toast({
        title: "PDF generato",
        description: "Il file PDF è stato scaricato",
      });
    } catch (error: any) {
      toast({
        title: "Errore export PDF",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const totalKm = expenses.reduce((sum, exp) => sum + exp.distance_km, 0);
  const totalAmount = expenses.reduce((sum, exp) => {
    const kmReimbursement = exp.distance_km * exp.reimbursement_rate_per_km;
    const diariaAmount = exp.requires_diaria ? 46 : 0;
    return sum + kmReimbursement + diariaAmount;
  }, 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Car className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Rimborsi Chilometrici</h1>
              <p className="text-muted-foreground">Gestisci le tue spese di viaggio</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Form per aggiungere/modificare spesa */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>{editingId ? 'Modifica Spesa' : 'Nuova Spesa'}</CardTitle>
              <CardDescription>
                {editingId ? 'Modifica i dati della spesa' : 'Aggiungi un nuovo spostamento'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <Label htmlFor="mission">Missione *</Label>
                  <Input
                    id="mission"
                    value={missionDescription}
                    onChange={(e) => setMissionDescription(e.target.value)}
                    placeholder="Es: Visita cliente X"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="vehiclePlate">Targa Auto</Label>
                  <Input
                    id="vehiclePlate"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="Es: AB123CD"
                  />
                </div>

                <div>
                  <Label htmlFor="vehicleModel">Modello Auto</Label>
                  <Input
                    id="vehicleModel"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Es: Fiat Panda"
                  />
                </div>

                <div>
                  <Label htmlFor="departure">Luogo Partenza *</Label>
                  <Input
                    id="departure"
                    value={departureLocation}
                    onChange={(e) => setDepartureLocation(e.target.value)}
                    placeholder="Es: Milano"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="arrival">Luogo Arrivo *</Label>
                  <Input
                    id="arrival"
                    value={arrivalLocation}
                    onChange={(e) => setArrivalLocation(e.target.value)}
                    placeholder="Es: Roma"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="distance">KM Percorsi *</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    placeholder="Es: 150.5"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="rate">Tariffa Rimborso (€/km) *</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    value={reimbursementRate}
                    onChange={(e) => setReimbursementRate(e.target.value)}
                    placeholder="Es: 0.50"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="date">Data Viaggio *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Note</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Note aggiuntive (opzionale)"
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="diaria"
                    checked={requiresDiaria}
                    onChange={(e) => setRequiresDiaria(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="diaria" className="cursor-pointer">
                    Diaria necessaria (+€46)
                  </Label>
                </div>

                <div>
                  <Label htmlFor="attachments">Allegati (scontrini, ricevute)</Label>
                  <Input
                    id="attachments"
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      if (e.target.files) {
                        setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                      }
                    }}
                    className="cursor-pointer"
                  />
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                          <span className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAttachment(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingId ? (
                      <>
                        <Pencil className="mr-2 h-4 w-4" />
                        Aggiorna
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Aggiungi
                      </>
                    )}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Tabella spese */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Registro Spese</CardTitle>
                  <CardDescription className="space-y-1 mt-2">
                    <div>Totale KM: {totalKm.toFixed(1)} km</div>
                    <div>Totale Rimborso: €{totalAmount.toFixed(2)}</div>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <Button onClick={handleExportToExcel} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export Excel
                  </Button>
                  <Button onClick={handleExportToPDF} variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nessuna spesa registrata per questo mese
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Missione</TableHead>
                        <TableHead>Partenza</TableHead>
                        <TableHead>Arrivo</TableHead>
                        <TableHead className="text-right">KM</TableHead>
                        <TableHead className="text-right">€/km</TableHead>
                        <TableHead className="text-center">Diaria</TableHead>
                        <TableHead className="text-right">Totale €</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Allegati</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="w-32"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => {
                        const isFinalized = expense.status === 'submitted' || expense.status === 'approved';
                        return (
                        <TableRow key={expense.id} className={editingId === expense.id ? 'bg-muted/50' : ''}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(expense.travel_date), 'dd/MM/yyyy', { locale: it })}
                          </TableCell>
                          <TableCell>{expense.mission_description}</TableCell>
                          <TableCell>{expense.departure_location}</TableCell>
                          <TableCell>{expense.arrival_location}</TableCell>
                          <TableCell className="text-right font-medium">
                            {expense.distance_km.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right">
                            €{expense.reimbursement_rate_per_km.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {expense.requires_diaria ? '✓ €46' : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            €{((expense.distance_km * expense.reimbursement_rate_per_km) + (expense.requires_diaria ? 46 : 0)).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              expense.status === 'submitted' ? 'default' :
                              expense.status === 'approved' ? 'default' :
                              expense.status === 'rejected' ? 'destructive' :
                              'secondary'
                            }>
                              {expense.status === 'submitted' ? 'Finalizzata' :
                               expense.status === 'approved' ? 'Approvata' :
                               expense.status === 'rejected' ? 'Rifiutata' :
                               'Bozza'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {expense.attachment_urls && expense.attachment_urls.length > 0 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingAttachments(expense)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {expense.attachment_urls.length}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {expense.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {!isFinalized && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditExpense(expense)}
                                    title="Modifica"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDuplicateExpense(expense)}
                                    title="Duplica"
                                  >
                                    <Copy className="h-4 w-4 text-primary" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteExpense(expense.id)}
                                    title="Elimina"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleFinalizeExpense(expense.id)}
                                    title="Finalizza"
                                  >
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </Button>
                                </>
                              )}
                              {isFinalized && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDuplicateExpense(expense)}
                                  title="Duplica"
                                >
                                  <Copy className="h-4 w-4 text-primary" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}

                      <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={4} className="text-right">TOTALE</TableCell>
                        <TableCell className="text-right">{totalKm.toFixed(1)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">€{totalAmount.toFixed(2)}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog for viewing attachments */}
      <Dialog open={!!viewingAttachments} onOpenChange={() => setViewingAttachments(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Allegati Nota Spese</DialogTitle>
            <DialogDescription>
              {viewingAttachments?.mission_description} - {viewingAttachments && format(new Date(viewingAttachments.travel_date), 'dd/MM/yyyy', { locale: it })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {viewingAttachments?.attachment_urls?.map((attachment, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{attachment.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(attachment.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    {attachment.url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                      <img 
                        src={attachment.url} 
                        alt={attachment.name}
                        className="w-full h-48 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center bg-muted rounded border">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => window.open(attachment.url, '_blank')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Scarica
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TravelExpenses;
