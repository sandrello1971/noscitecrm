import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface ScanRecord {
  id: string;
  created_at: string;
  original_file_name: string;
  image_url: string;
  ocr_confidence: number;
  status: string;
  corrected_data: any;
  crm_companies: {
    name: string;
  } | null;
  crm_contacts: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export default function ScanHistory() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadScans();
  }, [user, navigate]);

  const loadScans = async () => {
    try {
      let query = supabase
        .from('business_card_scans')
        .select(`
          *,
          crm_companies (name),
          crm_contacts (first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', user!.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setScans(data || []);
    } catch (error: any) {
      toast.error('Errore nel caricamento della cronologia');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const viewImage = (imageUrl: string) => {
    window.open(imageUrl, '_blank');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      processed: 'default',
      pending: 'secondary',
      failed: 'destructive',
    };
    
    const labels: Record<string, string> = {
      processed: 'Elaborato',
      pending: 'In attesa',
      failed: 'Fallito',
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return <div className="container mx-auto p-6">Caricamento...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Cronologia Scansioni</CardTitle>
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nessuna scansione trovata
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Contatto</TableHead>
                  <TableHead>Azienda</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Qualità</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell>
                      {format(new Date(scan.created_at), 'dd MMM yyyy HH:mm', { locale: it })}
                    </TableCell>
                    <TableCell>
                      {scan.crm_contacts
                        ? `${scan.crm_contacts.first_name} ${scan.crm_contacts.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell>{scan.crm_companies?.name || '-'}</TableCell>
                    <TableCell>{scan.crm_contacts?.email || '-'}</TableCell>
                    <TableCell>
                      <span className={scan.ocr_confidence > 70 ? 'text-green-600' : 'text-yellow-600'}>
                        {scan.ocr_confidence?.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(scan.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewImage(scan.image_url)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
