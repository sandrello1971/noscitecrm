import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Car, Download, Plus, Trash2, Calendar, Pencil, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface TravelExpense {
  id: string;
  mission_description: string;
  departure_location: string;
  arrival_location: string;
  distance_km: number;
  reimbursement_rate_per_km: number;
  travel_date: string;
  notes?: string;
}

const TravelExpenses = () => {
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state
  const [missionDescription, setMissionDescription] = useState('');
  const [departureLocation, setDepartureLocation] = useState('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [reimbursementRate, setReimbursementRate] = useState('0.50');
  const [travelDate, setTravelDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const fetchExpenses = async () => {
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-31`;

      const { data, error } = await supabase
        .from('travel_expenses')
        .select('*')
        .gte('travel_date', startDate)
        .lte('travel_date', endDate)
        .order('travel_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
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

      if (editingId) {
        // Update existing expense
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
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa spesa?')) return;

    try {
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

      // Get the second sheet (Page 2 - index 1)
      const sheetName = workbook.SheetNames[1];
      const worksheet = workbook.Sheets[sheetName];

      // Replace placeholders
      const downloadDate = format(new Date(), 'dd/MM/yyyy', { locale: it });
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
            }
          }
        }
      }

      // Insert expense data starting from row 81 (index 80)
      let currentRow = 80;
      expenses.forEach((expense) => {
        worksheet[`A${currentRow}`] = { t: 's', v: format(new Date(expense.travel_date), 'dd/MM/yyyy', { locale: it }) };
        worksheet[`B${currentRow}`] = { t: 's', v: `${expense.mission_description} - ${expense.departure_location}/${expense.arrival_location}` };
        worksheet[`E${currentRow}`] = { t: 'n', v: expense.distance_km };
        worksheet[`F${currentRow}`] = { t: 'n', v: expense.reimbursement_rate_per_km };
        worksheet[`G${currentRow}`] = { t: 'n', v: parseFloat((expense.distance_km * expense.reimbursement_rate_per_km).toFixed(2)) };
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

      const monthName = format(new Date(selectedMonth + '-01'), 'MMMM-yyyy', { locale: it });
      XLSX.writeFile(workbook, `rimborsi-chilometrici-${monthName}.xls`);

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

  const totalKm = expenses.reduce((sum, exp) => sum + exp.distance_km, 0);
  const totalAmount = expenses.reduce((sum, exp) => sum + (exp.distance_km * exp.reimbursement_rate_per_km), 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Car className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Rimborsi Chilometrici</h1>
            <p className="text-muted-foreground">Gestisci le tue spese di viaggio</p>
          </div>
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
                  <CardDescription>
                    Totale KM: {totalKm.toFixed(1)} km | Totale Rimborso: €{totalAmount.toFixed(2)}
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
                        <TableHead className="text-right">Totale €</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
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
                          <TableCell className="text-right font-medium">
                            €{(expense.distance_km * expense.reimbursement_rate_per_km).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {expense.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditExpense(expense)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteExpense(expense.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
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
    </div>
  );
};

export default TravelExpenses;
