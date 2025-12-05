import { NavLink, useLocation } from "react-router-dom"
import { 
  Building2, 
  Users, 
  Settings, 
  Home, 
  ShoppingCart,
  Package,
  TrendingUp,
  LogOut,
  Car,
  FolderKanban
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"

const items = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Aziende", url: "/companies", icon: Building2 },
  { title: "Contatti", url: "/contacts", icon: Users },
  { title: "Servizi", url: "/services", icon: Package },
  { title: "Opportunità", url: "/opportunities", icon: TrendingUp },
  { title: "Commesse", url: "/orders", icon: ShoppingCart },
  { title: "Progetti", url: "/projects", icon: FolderKanban },
  { title: "Rimborsi KM", url: "/travel-expenses", icon: Car },
  { title: "Impostazioni", url: "/settings", icon: Settings },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname
  const { signOut, isAdmin } = useAuth()

  const isActive = (path: string) => currentPath === path
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <Sidebar
      className={state === "collapsed" ? "w-14" : "w-60"}
      collapsible="icon"
    >
      {/* Header con Logo */}
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-3 px-3 py-4">
          {state !== "collapsed" ? (
            // Logo completo quando sidebar è aperta
            <div className="flex items-center gap-3">
              <img 
                src="/nosciteLOGO.png" 
                alt="Noscite" 
                className="h-8 w-8 object-contain"
              />
              <div className="flex flex-col">
                <span className="font-bold text-lg text-[#5DACA8]">NOSCITE</span>
                <span className="text-xs text-[#E07A47] font-medium -mt-1">
                  In digitali nova virtūs
                </span>
              </div>
            </div>
          ) : (
            // Solo logo quando sidebar è chiusa
            <img 
              src="/nosciteLOGO.png" 
              alt="Noscite" 
              className="h-8 w-8 object-contain mx-auto"
            />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            CRM
            {isAdmin && <span className="text-xs text-blue-600 ml-2">(Admin)</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
              <LogOut className="size-4" />
              {state !== "collapsed" && <span>Esci</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
