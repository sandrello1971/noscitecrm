import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/AuthContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Auth from "@/pages/Auth"
import { AppLayout } from "@/components/layout/AppLayout"
import Dashboard from "@/pages/Dashboard"
import Companies from "@/pages/Companies"
import Contacts from "@/pages/Contacts"
import Services from "@/pages/Services"
import Opportunities from "@/pages/Opportunities"
import Orders from "@/pages/Orders"
import Settings from "@/pages/Settings"
import NotFound from "@/pages/NotFound"

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              
              {/* Protected routes */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <SidebarProvider>
                      <AppLayout>
                        <Routes>
                          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/services" element={<Services />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/settings" element={<Settings />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AppLayout>
                    </SidebarProvider>
                  </ProtectedRoute>
                }
              />
            </Routes>
            <Toaster />
            <Sonner />
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App