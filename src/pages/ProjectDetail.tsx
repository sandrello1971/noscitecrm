import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  ListTodo,
  Clock,
  FileText,
  BarChart3,
  Users,
  Building2,
  Target
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { ProjectTasksTab } from "@/components/projects/ProjectTasksTab"
import { ProjectGanttTab } from "@/components/projects/ProjectGanttTab"
import { ProjectTimesheetsTab } from "@/components/projects/ProjectTimesheetsTab"
import { ProjectDocumentsTab } from "@/components/projects/ProjectDocumentsTab"
import { ProjectEVMTab } from "@/components/projects/ProjectEVMTab"

interface Project {
  id: string
  order_id?: string
  name: string
  description?: string
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
  start_date?: string
  end_date?: string
  planned_start_date?: string
  planned_end_date?: string
  budget: number
  actual_cost: number
  planned_value: number
  earned_value: number
  progress_percentage: number
  created_at: string
  order_number?: string
  company_name?: string
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  const loadProject = async () => {
    if (!id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('crm_projects')
        .select(`
          *,
          crm_orders(order_number, crm_companies(name))
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      setProject({
        ...data,
        status: data.status as Project['status'],
        order_number: data.crm_orders?.order_number,
        company_name: data.crm_orders?.crm_companies?.name
      })
    } catch (error: any) {
      console.error('Error loading project:', error)
      toast({
        title: "Errore",
        description: `Impossibile caricare il progetto: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProject()
  }, [id])

  if (loading) {
    return <div className="p-6">Caricamento progetto...</div>
  }

  if (!project) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Progetto non trovato</h2>
        <Button onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna ai Progetti
        </Button>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string; className?: string }> = {
      'planning': { variant: 'secondary', label: 'Pianificazione' },
      'in_progress': { variant: 'default', label: 'In Corso', className: 'bg-blue-600' },
      'on_hold': { variant: 'outline', label: 'Sospeso' },
      'completed': { variant: 'default', label: 'Completato', className: 'bg-green-600' },
      'cancelled': { variant: 'destructive', label: 'Annullato' }
    }

    const { variant, label, className } = config[status] || config.planning
    return <Badge variant={variant} className={className || ''}>{label}</Badge>
  }

  // EVM Calculations
  const ev = project.earned_value || 0
  const ac = project.actual_cost || 0
  const pv = project.planned_value || 0
  const bac = project.budget || 0

  const cpi = ac > 0 ? ev / ac : 0
  const spi = pv > 0 ? ev / pv : 0
  const cv = ev - ac
  const sv = ev - pv
  const eac = cpi > 0 ? bac / cpi : bac
  const etc = eac - ac
  const vac = bac - eac

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {getStatusBadge(project.status)}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            {project.order_number && (
              <span className="flex items-center gap-1">
                <ListTodo className="h-4 w-4" />
                {project.order_number}
              </span>
            )}
            {project.company_name && (
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {project.company_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Progresso</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{project.progress_percentage}%</div>
              <Progress value={project.progress_percentage} className="h-2 mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Budget (BAC)</span>
            </div>
            <div className="text-2xl font-bold mt-2">€{bac.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">CPI</span>
            </div>
            <div className={`text-2xl font-bold mt-2 ${cpi >= 1 ? 'text-green-600' : cpi > 0 ? 'text-red-600' : ''}`}>
              {cpi > 0 ? cpi.toFixed(2) : '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">SPI</span>
            </div>
            <div className={`text-2xl font-bold mt-2 ${spi >= 1 ? 'text-green-600' : spi > 0 ? 'text-red-600' : ''}`}>
              {spi > 0 ? spi.toFixed(2) : '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Scadenza</span>
            </div>
            <div className="text-lg font-bold mt-2">
              {project.planned_end_date 
                ? format(new Date(project.planned_end_date), 'dd MMM yyyy', { locale: it })
                : '-'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Attività</span>
          </TabsTrigger>
          <TabsTrigger value="gantt" className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Gantt</span>
          </TabsTrigger>
          <TabsTrigger value="timesheets" className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Timesheet</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documenti</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ProjectEVMTab 
            project={project} 
            ev={ev} 
            ac={ac} 
            pv={pv} 
            bac={bac}
            cpi={cpi}
            spi={spi}
            cv={cv}
            sv={sv}
            eac={eac}
            etc={etc}
            vac={vac}
          />
        </TabsContent>

        <TabsContent value="tasks">
          <ProjectTasksTab projectId={project.id} onTasksChange={loadProject} />
        </TabsContent>

        <TabsContent value="gantt">
          <ProjectGanttTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="timesheets">
          <ProjectTimesheetsTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="documents">
          <ProjectDocumentsTab projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
