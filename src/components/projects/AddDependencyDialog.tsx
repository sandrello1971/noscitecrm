import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Task {
  id: string
  name: string
}

interface AddDependencyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  tasks: Task[]
  preselectedSuccessorId?: string
  onDependencyAdded?: () => void
}

const DEPENDENCY_TYPES = [
  { value: 'FS', label: 'Fine → Inizio (FS)', description: 'B inizia dopo che A è finita' },
  { value: 'SS', label: 'Inizio → Inizio (SS)', description: 'B inizia dopo che A è iniziata' },
  { value: 'FF', label: 'Fine → Fine (FF)', description: 'B finisce dopo che A è finita' },
  { value: 'SF', label: 'Inizio → Fine (SF)', description: 'B finisce dopo che A è iniziata' },
]

export function AddDependencyDialog({ 
  open, 
  onOpenChange, 
  projectId, 
  tasks, 
  preselectedSuccessorId,
  onDependencyAdded 
}: AddDependencyDialogProps) {
  const [loading, setLoading] = useState(false)
  const [predecessorId, setPredecessorId] = useState('')
  const [successorId, setSuccessorId] = useState(preselectedSuccessorId || '')
  const [dependencyType, setDependencyType] = useState('FS')
  const [lagDays, setLagDays] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setPredecessorId('')
      setSuccessorId(preselectedSuccessorId || '')
      setDependencyType('FS')
      setLagDays(0)
    }
  }, [open, preselectedSuccessorId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!predecessorId || !successorId) {
      toast({
        title: "Errore",
        description: "Seleziona entrambe le attività",
        variant: "destructive"
      })
      return
    }

    if (predecessorId === successorId) {
      toast({
        title: "Errore",
        description: "Un'attività non può dipendere da se stessa",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const { data: user } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('crm_task_dependencies')
        .insert({
          predecessor_task_id: predecessorId,
          successor_task_id: successorId,
          dependency_type: dependencyType,
          lag_days: lagDays,
          user_id: user.user!.id
        })

      if (error) {
        if (error.code === '23505') {
          throw new Error('Questa dipendenza esiste già')
        }
        if (error.message?.includes('ciclica') || error.message?.includes('cycle')) {
          throw new Error('Dipendenza ciclica rilevata! Questa dipendenza creerebbe un ciclo tra le attività.')
        }
        if (error.message?.includes('stesso progetto')) {
          throw new Error('Le attività devono appartenere allo stesso progetto')
        }
        throw error
      }

      toast({
        title: "Dipendenza creata",
        description: "Le date delle attività collegate sono state ricalcolate automaticamente"
      })
      onOpenChange(false)
      onDependencyAdded?.()
    } catch (error: any) {
      console.error('Error creating dependency:', error)
      toast({
        title: "Errore",
        description: error.message || "Impossibile creare la dipendenza",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedType = DEPENDENCY_TYPES.find(t => t.value === dependencyType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi Dipendenza</DialogTitle>
          <DialogDescription>
            Crea un collegamento tra due attività per definire l'ordine di esecuzione.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Predecessore (A)</Label>
            <Select value={predecessorId} onValueChange={setPredecessorId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona attività predecessore" />
              </SelectTrigger>
              <SelectContent>
                {tasks.filter(t => t.id !== successorId).map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo di Dipendenza</Label>
            <Select value={dependencyType} onValueChange={setDependencyType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPENDENCY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <p className="text-xs text-muted-foreground">{selectedType.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Successore (B)</Label>
            <Select value={successorId} onValueChange={setSuccessorId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona attività successore" />
              </SelectTrigger>
              <SelectContent>
                {tasks.filter(t => t.id !== predecessorId).map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lag">Ritardo/Anticipo (giorni)</Label>
            <Input
              id="lag"
              type="number"
              value={lagDays}
              onChange={(e) => setLagDays(parseInt(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Positivo = ritardo, Negativo = anticipo (lead time)
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creazione...' : 'Crea Dipendenza'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
