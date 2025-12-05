import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Legend, BarChart, Bar, CartesianGrid } from "recharts"

interface Project {
  id: string
  name: string
  description?: string
  status: string
  budget: number
  actual_cost: number
  planned_value: number
  earned_value: number
  progress_percentage: number
  planned_start_date?: string
  planned_end_date?: string
}

interface ProjectEVMTabProps {
  project: Project
  ev: number
  ac: number
  pv: number
  bac: number
  cpi: number
  spi: number
  cv: number
  sv: number
  eac: number
  etc: number
  vac: number
}

export function ProjectEVMTab({ project, ev, ac, pv, bac, cpi, spi, cv, sv, eac, etc, vac }: ProjectEVMTabProps) {
  // Mock data for S-Curve chart
  const scurveData = [
    { month: 'M1', pv: bac * 0.1, ev: ev * 0.08, ac: ac * 0.12 },
    { month: 'M2', pv: bac * 0.25, ev: ev * 0.22, ac: ac * 0.28 },
    { month: 'M3', pv: bac * 0.45, ev: ev * 0.40, ac: ac * 0.48 },
    { month: 'M4', pv: bac * 0.65, ev: ev * 0.58, ac: ac * 0.70 },
    { month: 'M5', pv: bac * 0.85, ev: ev * 0.75, ac: ac * 0.88 },
    { month: 'M6', pv: bac, ev: ev, ac: ac },
  ]

  const varianceData = [
    { name: 'Cost Variance (CV)', value: cv, fill: cv >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))' },
    { name: 'Schedule Variance (SV)', value: sv, fill: sv >= 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))' },
    { name: 'VAC', value: vac, fill: vac >= 0 ? 'hsl(var(--chart-3))' : 'hsl(var(--destructive))' },
  ]

  const getHealthStatus = () => {
    if (cpi >= 1 && spi >= 1) return { status: 'excellent', label: 'Ottimo', color: 'text-green-600', icon: CheckCircle }
    if (cpi >= 0.9 && spi >= 0.9) return { status: 'good', label: 'Buono', color: 'text-blue-600', icon: TrendingUp }
    if (cpi >= 0.8 || spi >= 0.8) return { status: 'warning', label: 'Attenzione', color: 'text-yellow-600', icon: AlertTriangle }
    return { status: 'critical', label: 'Critico', color: 'text-red-600', icon: TrendingDown }
  }

  const health = getHealthStatus()
  const HealthIcon = health.icon

  return (
    <div className="space-y-6">
      {/* Project Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Stato di Salute del Progetto
          </CardTitle>
          <CardDescription>
            Analisi Earned Value Management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-4 rounded-full ${health.color} bg-current/10`}>
              <HealthIcon className={`h-8 w-8 ${health.color}`} />
            </div>
            <div>
              <div className={`text-2xl font-bold ${health.color}`}>{health.label}</div>
              <p className="text-muted-foreground">
                {cpi >= 1 && spi >= 1 
                  ? 'Il progetto è sotto budget e in anticipo rispetto ai tempi'
                  : cpi < 1 && spi < 1
                  ? 'Il progetto è in ritardo e sopra budget'
                  : cpi < 1
                  ? 'Il progetto è sopra budget'
                  : 'Il progetto è in ritardo sui tempi'
                }
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Avanzamento Progetto</span>
              <span className="font-medium">{project.progress_percentage}%</span>
            </div>
            <Progress value={project.progress_percentage} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">BAC (Budget at Completion)</div>
            <div className="text-2xl font-bold">€{bac.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Budget totale pianificato</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">EAC (Estimate at Completion)</div>
            <div className={`text-2xl font-bold ${eac > bac ? 'text-red-600' : 'text-green-600'}`}>
              €{eac.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Stima costo finale</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">ETC (Estimate to Complete)</div>
            <div className="text-2xl font-bold">€{Math.max(0, etc).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Costo rimanente stimato</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">VAC (Variance at Completion)</div>
            <div className={`text-2xl font-bold ${vac >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{vac.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{vac >= 0 ? 'Sotto budget previsto' : 'Sopra budget previsto'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Indices */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Performance Index (CPI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold ${cpi >= 1 ? 'text-green-600' : cpi > 0 ? 'text-red-600' : ''}`}>
                {cpi > 0 ? cpi.toFixed(2) : '-'}
              </div>
              <div className="flex-1">
                <Progress value={Math.min(cpi * 100, 150)} className="h-3" />
                <div className="flex justify-between text-xs mt-1">
                  <span>0</span>
                  <span className="text-muted-foreground">Target: 1.0</span>
                  <span>1.5+</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {cpi >= 1 
                ? `Per ogni €1 speso, guadagni €${cpi.toFixed(2)} di valore`
                : cpi > 0
                ? `Per ogni €1 speso, ottieni solo €${cpi.toFixed(2)} di valore`
                : 'Non calcolabile - nessun costo registrato'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Schedule Performance Index (SPI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold ${spi >= 1 ? 'text-green-600' : spi > 0 ? 'text-red-600' : ''}`}>
                {spi > 0 ? spi.toFixed(2) : '-'}
              </div>
              <div className="flex-1">
                <Progress value={Math.min(spi * 100, 150)} className="h-3" />
                <div className="flex justify-between text-xs mt-1">
                  <span>0</span>
                  <span className="text-muted-foreground">Target: 1.0</span>
                  <span>1.5+</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {spi >= 1 
                ? `Il progetto è in anticipo del ${((spi - 1) * 100).toFixed(0)}%`
                : spi > 0
                ? `Il progetto è in ritardo del ${((1 - spi) * 100).toFixed(0)}%`
                : 'Non calcolabile - nessun valore pianificato'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Variances */}
      <Card>
        <CardHeader>
          <CardTitle>Varianze</CardTitle>
          <CardDescription>Analisi delle deviazioni dal piano</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Cost Variance (CV)</div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${cv >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {cv >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                €{cv.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                EV - AC = {cv >= 0 ? 'Sotto budget' : 'Sopra budget'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Schedule Variance (SV)</div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${sv >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {sv >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                €{sv.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                EV - PV = {sv >= 0 ? 'In anticipo' : 'In ritardo'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">TCPI (To Complete Performance Index)</div>
              <div className="text-2xl font-bold">
                {etc > 0 ? ((bac - ev) / etc).toFixed(2) : '-'}
              </div>
              <p className="text-xs text-muted-foreground">
                Performance richiesta per completare in budget
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* EVM Values Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Riepilogo Valori EVM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <div className="text-sm text-muted-foreground">Planned Value (PV)</div>
              <div className="text-2xl font-bold text-blue-600">€{pv.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Valore del lavoro pianificato</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="text-sm text-muted-foreground">Earned Value (EV)</div>
              <div className="text-2xl font-bold text-green-600">€{ev.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Valore del lavoro completato</p>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
              <div className="text-sm text-muted-foreground">Actual Cost (AC)</div>
              <div className="text-2xl font-bold text-orange-600">€{ac.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Costo effettivo sostenuto</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {project.description && (
        <Card>
          <CardHeader>
            <CardTitle>Descrizione Progetto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
