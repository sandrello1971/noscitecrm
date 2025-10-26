import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Car, Download, Plus, Trash2, Calendar } from 'lucide-react';
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
  travel_date: string;
  notes?: string;
}

const TravelExpenses = () => {
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { toast } = useToast();

  // Form state
  const [missionDescription, setMissionDescription] = useState('');
  const [departureLocation, setDepartureLocation] = useState('');
  const [arrivalLocation, setArrivalLocation] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
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

      const { error } = await supabase.from('travel_expenses').insert({
        user_id: user.id,
        mission_description: missionDescription,
        departure_location: departureLocation,
        arrival_location: arrivalLocation,
        distance_km: parseFloat(distanceKm),
        travel_date: travelDate,
        notes: notes || null,
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Spesa di viaggio aggiunta",
      });

      // Reset form
      setMissionDescription('');
      setDepartureLocation('');
      setArrivalLocation('');
      setDistanceKm('');
      setNotes('');
      setTravelDate(format(new Date(), 'yyyy-MM-dd'));

      fetchExpenses();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.from('travel_expenses').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: "Eliminato",
        description: "Spesa eliminata con successo",
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

  const handleExportToExcel = () => {
    if (expenses.length === 0) {
      toast({
        title: "Attenzione",
        description: "Nessun dato da esportare per questo mese",
        variant: "destructive",
      });
      return;
    }

    const exportData = expenses.map((expense) => ({
      Data: format(new Date(expense.travel_date), 'dd/MM/yyyy', { locale: it }),
      Missione: expense.mission_description,
      Partenza: expense.departure_location,
      Arrivo: expense.arrival_location,
      'KM Percorsi': expense.distance_km,
      Note: expense.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rimborsi Chilometrici');

    const monthName = format(new Date(selectedMonth + '-01'), 'MMMM-yyyy', { locale: it });
    XLSX.writeFile(wb, `rimborsi-chilometrici-${monthName}.xlsx`);

    toast({
      title: "Export completato",
      description: "Il file Excel è stato scaricato",
    });
  };

  const totalKm = expenses.reduce((sum, exp) => sum + exp.distance_km, 0);

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
          {/* Form per aggiungere spesa */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Nuova Spesa</CardTitle>
              <CardDescription>Aggiungi un nuovo spostamento</CardDescription>
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

                <Button type="submit" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Aggiungi Spesa
                </Button>
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
                    Totale KM: {totalKm.toFixed(1)} km
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
                        <TableHead>Note</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(expense.travel_date), 'dd/MM/yyyy', { locale: it })}
                          </TableCell>
                          <TableCell>{expense.mission_description}</TableCell>
                          <TableCell>{expense.departure_location}</TableCell>
                          <TableCell>{expense.arrival_location}</TableCell>
                          <TableCell className="text-right font-medium">
                            {expense.distance_km.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {expense.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteExpense(expense.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
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
