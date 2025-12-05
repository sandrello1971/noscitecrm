import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, FileText, Download, Trash2, Upload, File, FileSpreadsheet, FileImage } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { it } from "date-fns/locale"

interface Document {
  id: string
  project_id: string
  task_id?: string
  name: string
  description?: string
  document_type: string
  file_name: string
  file_url: string
  file_size: number
  file_type: string
  version: number
  created_at: string
  task_name?: string
}

interface Task {
  id: string
  name: string
}

interface ProjectDocumentsTabProps {
  projectId: string
}

const DOCUMENT_TYPES = [
  { value: 'project_plan', label: 'Piano di Progetto' },
  { value: 'meeting_minutes', label: 'Verbale Riunione' },
  { value: 'report', label: 'Report' },
  { value: 'timesheet', label: 'Timesheet' },
  { value: 'specification', label: 'Specifiche' },
  { value: 'contract', label: 'Contratto' },
  { value: 'deliverable', label: 'Deliverable' },
  { value: 'other', label: 'Altro' }
]

export function ProjectDocumentsTab({ projectId }: ProjectDocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    document_type: 'other',
    task_id: ''
  })
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [docsRes, tasksRes] = await Promise.all([
        supabase
          .from('crm_project_documents')
          .select(`*, crm_project_tasks(name)`)
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('crm_project_tasks')
          .select('id, name')
          .eq('project_id', projectId)
          .order('name')
      ])

      if (docsRes.error) throw docsRes.error
      if (tasksRes.error) throw tasksRes.error

      setDocuments(docsRes.data?.map(d => ({
        ...d,
        task_name: d.crm_project_tasks?.name
      })) || [])
      setTasks(tasksRes.data || [])
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i documenti",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (!formData.name) {
        setFormData({ ...formData, name: file.name.split('.').slice(0, -1).join('.') })
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedFile) {
      toast({
        title: "Errore",
        description: "Seleziona un file da caricare",
        variant: "destructive"
      })
      return
    }

    setUploading(true)

    try {
      const { data: user } = await supabase.auth.getUser()
      
      // Upload file
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${projectId}/${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('crm-project-documents')
        .upload(fileName, selectedFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('crm-project-documents')
        .getPublicUrl(fileName)

      // Save document record
      const { error: dbError } = await supabase
        .from('crm_project_documents')
        .insert({
          project_id: projectId,
          task_id: formData.task_id || null,
          user_id: user.user!.id,
          name: formData.name.trim() || selectedFile.name,
          description: formData.description.trim() || null,
          document_type: formData.document_type,
          file_name: selectedFile.name,
          file_url: publicUrl,
          file_size: selectedFile.size,
          file_type: selectedFile.type || 'application/octet-stream'
        })

      if (dbError) throw dbError

      toast({
        title: "Successo",
        description: "Documento caricato"
      })
      setShowAddDialog(false)
      resetForm()
      loadData()
    } catch (error: any) {
      toast({
        title: "Errore",
        description: `Impossibile caricare il documento: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedDoc) return

    try {
      // Delete from storage
      const filePath = selectedDoc.file_url.split('/').slice(-2).join('/')
      await supabase.storage.from('crm-project-documents').remove([filePath])

      // Delete record
      const { error } = await supabase
        .from('crm_project_documents')
        .delete()
        .eq('id', selectedDoc.id)

      if (error) throw error

      toast({
        title: "Successo",
        description: "Documento eliminato"
      })
      loadData()
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il documento",
        variant: "destructive"
      })
    } finally {
      setShowDeleteDialog(false)
      setSelectedDoc(null)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      document_type: 'other',
      task_id: ''
    })
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const getDocTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type)?.label || type
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />
    if (fileType.includes('sheet') || fileType.includes('excel')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    if (fileType.includes('image')) return <FileImage className="h-5 w-5 text-blue-500" />
    return <File className="h-5 w-5 text-muted-foreground" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading) {
    return <div className="p-4">Caricamento documenti...</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documenti del Progetto
          </CardTitle>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Carica Documento
          </Button>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun documento caricato.</p>
              <p className="text-sm">Clicca "Carica Documento" per aggiungere file al progetto.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Attività</TableHead>
                  <TableHead>Dimensione</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(doc.file_type)}
                        <div>
                          <div className="font-medium">{doc.name}</div>
                          {doc.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {doc.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getDocTypeLabel(doc.document_type)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.task_name || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: it })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(doc.file_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            setSelectedDoc(doc)
                            setShowDeleteDialog(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Carica Documento</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>File *</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    {getFileIcon(selectedFile.type)}
                    <span>{selectedFile.name}</span>
                    <span className="text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
                  </div>
                ) : (
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Clicca per selezionare un file</p>
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome Documento</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome del documento"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo Documento</Label>
                <Select value={formData.document_type} onValueChange={(v) => setFormData({ ...formData, document_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Attività Collegata</Label>
                <Select value={formData.task_id} onValueChange={(v) => setFormData({ ...formData, task_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nessuna</SelectItem>
                    {tasks.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrizione del documento"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={uploading || !selectedFile}>
                {uploading ? 'Caricamento...' : 'Carica'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Il file verrà eliminato permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
