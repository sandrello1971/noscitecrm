import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Calendar, 
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  Pause,
  XCircle,
  Eye,
  ArrowRight
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { format } from "date-fns"
import { it } from "date-fns/locale"

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
  tasks_count?: number
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const loadProjects = async () => {
    try {
      setLoading(true)
      const { data: user } = await supabase.auth.getUser()
      
      let query = supabase
        .from('crm_projects')
        .select(`
          *,
          crm_orders(order_number, crm_companies(name))
        `)

      if (!isAdmin) {
        query = query.eq('user_id', user.user?.id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      const mappedData = data?.map(project => ({
        ...project,
        status: project.status as Project['status'],
        order_number: project.crm_orders?.order_number,
        company_name: project.crm_orders?.crm_companies?.name,
        tasks_count: 0
      })) || []

      setProjects(mappedData)
    } catch (error: any) {
      console.error('Error loading projects:', error)
      toast({
        title: "Errore",
        description: `Impossibile caricare i progetti: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [isAdmin])

  const filteredProjects = useMemo(() => {
    let filtered = projects

    if (statusFilter !== "all") {
      filtered = filtered.filter(p => p.status === statusFilter)
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search) ||
        p.order_number?.toLowerCase().includes(search) ||
        p.company_name?.toLowerCase().includes(search)
      )
    }

    return filtered
  }, [projects, statusFilter, searchTerm])

  const stats = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
    const totalEV = projects.reduce((sum, p) => sum + (p.earned_value || 0), 0)
    const totalAC = projects.reduce((sum, p) => sum + (p.actual_cost || 0), 0)
    
    return {
      total: projects.length,
      planning: projects.filter(p => p.status === 'planning').length,
      inProgress: projects.filter(p => p.status === 'in_progress').length,
      completed: projects.filter(p => p.status === 'completed').length,
      totalBudget,
      avgCPI: totalAC > 0 ? (totalEV / totalAC).toFixed(2) : '-'
    }
  }, [projects])

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; icon: any; label: string; className?: string }> = {
      'planning': { variant: 'secondary', icon: Clock, label: 'Pianificazione', className: undefined },
      'in_progress': { variant: 'default', icon: TrendingUp, label: 'In Corso', className: 'bg-blue-600' },
      'on_hold': { variant: 'outline', icon: Pause, label: 'Sospeso', className: undefined },
      'completed': { variant: 'default', icon: CheckCircle, label: 'Completato', className: 'bg-green-600' },
      'cancelled': { variant: 'destructive', icon: XCircle, label: 'Annullato', className: undefined }
    }

    const statusConfig = config[status] || config.planning
    const { variant, icon: Icon, label, className } = statusConfig

    return (
      <Badge variant={variant} className={className || ''}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    )
  }

  const calculateEVM = (project: Project) => {
    const ev = project.earned_value || 0
    const ac = project.actual_cost || 0
    const pv = project.planned_value || 0

    const cpi = ac > 0 ? ev / ac : 0
    const spi = pv > 0 ? ev / pv : 0

    return { cpi, spi }
  }

  if (loading) {
    return <div className="p-6">Caricamento progetti...</div>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FolderKanban className="h-8 w-8" />
            Project Management
          </h1>
          <p className="text-muted-foreground">
            Gestione progetti con Gantt, Earned Value e tracking risorse
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Progetti Totali</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">In Corso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.planning}</div>
            <p className="text-xs text-muted-foreground">In Pianificazione</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Completati</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">€{stats.totalBudget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Budget Totale</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.avgCPI}</div>
            <p className="text-xs text-muted-foreground">CPI Medio</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca progetti..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="planning">Pianificazione</SelectItem>
                <SelectItem value="in_progress">In Corso</SelectItem>
                <SelectItem value="on_hold">Sospeso</SelectItem>
                <SelectItem value="completed">Completato</SelectItem>
                <SelectItem value="cancelled">Annullato</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nessun progetto trovato</h3>
            <p className="text-muted-foreground mb-4">
              I progetti vengono creati automaticamente quando una commessa passa allo stato "In Corso"
            </p>
            <Button variant="outline" onClick={() => navigate('/orders')}>
              Vai alle Commesse
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const { cpi, spi } = calculateEVM(project)
            
            return (
              <Card 
                key={project.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                      {project.order_number && (
                        <p className="text-sm text-muted-foreground">{project.order_number}</p>
                      )}
                    </div>
                    {getStatusBadge(project.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.company_name && (
                    <p className="text-sm text-muted-foreground">{project.company_name}</p>
                  )}
                  
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progresso</span>
                      <span>{project.progress_percentage || 0}%</span>
                    </div>
                    <Progress value={project.progress_percentage || 0} className="h-2" />
                  </div>

                  {/* EVM Indicators */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted/50 rounded p-2">
                      <div className="text-muted-foreground text-xs">CPI</div>
                      <div className={`font-medium ${cpi >= 1 ? 'text-green-600' : cpi > 0 ? 'text-red-600' : ''}`}>
                        {cpi > 0 ? cpi.toFixed(2) : '-'}
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded p-2">
                      <div className="text-muted-foreground text-xs">SPI</div>
                      <div className={`font-medium ${spi >= 1 ? 'text-green-600' : spi > 0 ? 'text-red-600' : ''}`}>
                        {spi > 0 ? spi.toFixed(2) : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Budget */}
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>Budget</span>
                    </div>
                    <span className="font-medium">€{(project.budget || 0).toLocaleString()}</span>
                  </div>

                  {/* Dates */}
                  {(project.planned_start_date || project.planned_end_date) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {project.planned_start_date && format(new Date(project.planned_start_date), 'dd MMM', { locale: it })}
                        {project.planned_start_date && project.planned_end_date && ' - '}
                        {project.planned_end_date && format(new Date(project.planned_end_date), 'dd MMM yyyy', { locale: it })}
                      </span>
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="mr-2 h-4 w-4" />
                    Apri Progetto
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
