import { useMemo } from "react"

interface Task {
  id: string
  name: string
  planned_start_date?: string
  planned_end_date?: string
  start_date?: string
  end_date?: string
}

interface Dependency {
  id: string
  predecessor_task_id: string
  successor_task_id: string
  dependency_type: 'FS' | 'SS' | 'FF' | 'SF'
  lag_days: number
}

interface DependencyLinesProps {
  tasks: Task[]
  dependencies: Dependency[]
  taskPositions: Map<string, { top: number; left: number; right: number; height: number }>
  startDate: Date
  endDate: Date
  dateRange: Date[]
}

export function DependencyLines({ 
  tasks, 
  dependencies, 
  taskPositions, 
  startDate, 
  endDate, 
  dateRange 
}: DependencyLinesProps) {
  const lines = useMemo(() => {
    return dependencies.map(dep => {
      const predPos = taskPositions.get(dep.predecessor_task_id)
      const succPos = taskPositions.get(dep.successor_task_id)
      
      if (!predPos || !succPos) return null

      // Calculate start and end points based on dependency type
      let startX: number
      let startY: number
      let endX: number
      let endY: number

      switch (dep.dependency_type) {
        case 'FS': // Finish to Start
          startX = predPos.right
          startY = predPos.top + predPos.height / 2
          endX = succPos.left
          endY = succPos.top + succPos.height / 2
          break
        case 'SS': // Start to Start
          startX = predPos.left
          startY = predPos.top + predPos.height / 2
          endX = succPos.left
          endY = succPos.top + succPos.height / 2
          break
        case 'FF': // Finish to Finish
          startX = predPos.right
          startY = predPos.top + predPos.height / 2
          endX = succPos.right
          endY = succPos.top + succPos.height / 2
          break
        case 'SF': // Start to Finish
          startX = predPos.left
          startY = predPos.top + predPos.height / 2
          endX = succPos.right
          endY = succPos.top + succPos.height / 2
          break
        default:
          return null
      }

      // Create path with right-angle corners
      const midX = startX + (endX - startX) / 2
      const offset = 10 // Offset for curved path

      // Determine if we need to go around
      let path: string

      if (endX > startX + 20) {
        // Simple path - end is to the right of start
        if (Math.abs(endY - startY) < 5) {
          // Same row - straight line
          path = `M ${startX} ${startY} L ${endX - 8} ${endY}`
        } else {
          // Different rows - use bezier curve
          path = `M ${startX} ${startY} 
                  C ${startX + 30} ${startY}, 
                    ${endX - 30} ${endY}, 
                    ${endX - 8} ${endY}`
        }
      } else {
        // Need to go around - end is to the left or close to start
        const goDown = endY > startY
        const verticalOffset = goDown ? 20 : -20
        
        path = `M ${startX} ${startY}
                L ${startX + 15} ${startY}
                L ${startX + 15} ${startY + verticalOffset}
                L ${endX - 15} ${endY + (goDown ? -verticalOffset : verticalOffset)}
                L ${endX - 15} ${endY}
                L ${endX - 8} ${endY}`
      }

      return {
        id: dep.id,
        path,
        endX,
        endY,
        type: dep.dependency_type,
        lagDays: dep.lag_days
      }
    }).filter(Boolean)
  }, [dependencies, taskPositions])

  if (lines.length === 0) return null

  return (
    <svg 
      className="absolute inset-0 pointer-events-none overflow-visible" 
      style={{ zIndex: 5 }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon 
            points="0 0, 8 3, 0 6" 
            className="fill-primary"
          />
        </marker>
        <marker
          id="arrowhead-warning"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon 
            points="0 0, 8 3, 0 6" 
            className="fill-amber-500"
          />
        </marker>
      </defs>
      {lines.map(line => line && (
        <g key={line.id}>
          <path
            d={line.path}
            className={`fill-none stroke-2 ${line.lagDays !== 0 ? 'stroke-amber-500' : 'stroke-primary'}`}
            strokeDasharray={line.lagDays < 0 ? "4 2" : undefined}
            markerEnd={line.lagDays !== 0 ? "url(#arrowhead-warning)" : "url(#arrowhead)"}
          />
          {line.lagDays !== 0 && (
            <text
              x={(line.endX - 30)}
              y={line.endY - 8}
              className="fill-amber-600 text-[10px] font-medium"
            >
              {line.lagDays > 0 ? `+${line.lagDays}g` : `${line.lagDays}g`}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
