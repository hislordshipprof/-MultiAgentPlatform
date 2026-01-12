import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Truck, 
  Settings, 
  Package, 
  AlertCircle,
  TrendingUp,
  Route,
  Bell,
  Search,
  Menu,
  LogOut,
  Activity,
  FileText,
  HelpCircle,
  User as UserIcon,
  Edit
} from 'lucide-react'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from 'react'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from '../contexts/AuthContext'
import { useIssues } from '../hooks/api/useIssues'
import { useIssuesWebSocket } from '../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'
import type { WebSocketEventData } from '../services/websocket'

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const pathname = location.pathname
  const isAdmin = pathname.includes('admin')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Fetch open/investigating issues count for badge (only for admin/manager/dispatcher)
  const shouldFetchIssues = isAdmin && (user?.role === 'admin' || user?.role === 'manager' || user?.role === 'dispatcher')
  const queryClient = useQueryClient()
  const { data: issues = [] } = useIssues(
    {},
    { enabled: shouldFetchIssues }
  )
  
  // Subscribe to issues updates via WebSocket to update badge in real-time
  useIssuesWebSocket((_event, _data: WebSocketEventData) => {
    if (shouldFetchIssues) {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
    }
  })
  
  // Count open and investigating issues for badge
  const openIssuesCount = shouldFetchIssues 
    ? issues.filter(issue => issue.status === 'open' || issue.status === 'investigating').length
    : 0

  // Determine current section
  const getPageTitle = () => {
    if (pathname.includes('overview')) return 'Overview'
    if (pathname.includes('shipments')) return 'Shipments'
    if (pathname.includes('routes')) return 'Routes'
    if (pathname.includes('issues')) return 'Issues'
    if (pathname.includes('escalations')) return 'Escalations'
    if (pathname.includes('delivery-changes')) return 'Delivery Changes'
    if (pathname.includes('metrics')) return 'Metrics'
    if (pathname.includes('metrics-admin')) return 'Metrics Admin'
    if (pathname.includes('admin')) return 'Admin Dashboard'
    if (pathname.includes('customer')) return 'My Shipments'
    return 'Dashboard'
  }

  const handleLogout = () => {
    logout()
  }
  
  const getUserInitials = () => {
    if (!user) return 'U';
    const names = user.name.split(' ');
    return names.length > 1 
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : user.name.substring(0, 2).toUpperCase();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar - Glassmorphism */}
      <aside className={cn(
        "hidden lg:flex flex-col w-64 glass-dark text-white transition-all duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-blue-600">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">CallSphere</h1>
              <p className="text-xs text-slate-400">Logistics Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {isAdmin ? (
            <>
              {/* MAIN MENU */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">MAIN MENU</p>
                {/* Overview - Only for admin, manager, dispatcher */}
                {user?.role !== 'driver' && (
                  <Link 
                    to="/dashboard/admin/overview" 
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover-lift",
                      pathname.includes('overview') || pathname === '/dashboard/admin'
                        ? "bg-gradient-to-r from-teal-600/80 to-blue-600/80 text-white shadow-lg"
                        : "text-slate-300 hover:bg-white/10"
                    )}
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="font-medium">Overview</span>
                  </Link>
                )}
                {/* Shipments - Only for admin, manager, dispatcher */}
                {user?.role !== 'driver' && (
                  <Link 
                    to="/dashboard/admin/shipments" 
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover-lift",
                      pathname.includes('shipments')
                        ? "bg-gradient-to-r from-teal-600/80 to-blue-600/80 text-white shadow-lg"
                        : "text-slate-300 hover:bg-white/10"
                    )}
                  >
                    <Truck className="h-5 w-5" />
                    <span className="font-medium">Shipments</span>
                  </Link>
                )}
                <Link 
                  to="/dashboard/admin/routes" 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover-lift",
                    pathname.includes('routes')
                      ? "bg-gradient-to-r from-teal-600/80 to-blue-600/80 text-white shadow-lg"
                      : "text-slate-300 hover:bg-white/10"
                  )}
                >
                  <Route className="h-5 w-5" />
                  <span className="font-medium">Routes</span>
                </Link>
                {/* Issues - Only for admin, manager, dispatcher */}
                {user?.role !== 'driver' && (
                  <Link 
                    to="/dashboard/admin/issues" 
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover-lift relative",
                      pathname.includes('issues')
                        ? "bg-gradient-to-r from-teal-600/80 to-blue-600/80 text-white shadow-lg"
                        : "text-slate-300 hover:bg-white/10"
                    )}
                  >
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Issues</span>
                    {openIssuesCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {openIssuesCount}
                      </span>
                    )}
                  </Link>
                )}
                {/* Escalations - Only for manager and admin */}
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <Link 
                    to="/dashboard/admin/escalations" 
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover-lift",
                      pathname.includes('escalations')
                        ? "bg-gradient-to-r from-teal-600/80 to-blue-600/80 text-white shadow-lg"
                        : "text-slate-300 hover:bg-white/10"
                    )}
                  >
                    <Activity className="h-5 w-5" />
                    <span className="font-medium">Escalations</span>
                  </Link>
                )}
                {/* Delivery Changes - Only for manager and admin */}
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <Link 
                    to="/dashboard/admin/delivery-changes" 
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover-lift",
                      pathname.includes('delivery-changes')
                        ? "bg-gradient-to-r from-teal-600/80 to-blue-600/80 text-white shadow-lg"
                        : "text-slate-300 hover:bg-white/10"
                    )}
                  >
                    <Edit className="h-5 w-5" />
                    <span className="font-medium">Delivery Changes</span>
                  </Link>
                )}
                {/* Metrics - Only for admin, manager, dispatcher */}
                {user?.role !== 'driver' && (
                  <Link 
                    to="/dashboard/admin/metrics" 
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover-lift",
                      pathname.includes('metrics') && !pathname.includes('metrics-admin')
                        ? "bg-gradient-to-r from-teal-600/80 to-blue-600/80 text-white shadow-lg"
                        : "text-slate-300 hover:bg-white/10"
                    )}
                  >
                    <TrendingUp className="h-5 w-5" />
                    <span className="font-medium">Metrics</span>
                  </Link>
                )}
              </div>

              {/* GENERAL */}
              <div className="mb-4 pt-4 border-t border-white/10">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">GENERAL</p>
                {/* Metrics Admin - Only for admin */}
                {user?.role === 'admin' && (
                  <Link 
                    to="/dashboard/admin/metrics-admin" 
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover-lift",
                      pathname.includes('metrics-admin')
                        ? "bg-gradient-to-r from-teal-600/80 to-blue-600/80 text-white shadow-lg"
                        : "text-slate-300 hover:bg-white/10"
                    )}
                  >
                    <FileText className="h-5 w-5" />
                    <span className="font-medium">Metrics Admin</span>
                  </Link>
                )}
                <Link 
                  to="#" 
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-white/10 transition-all duration-200"
                >
                  <HelpCircle className="h-5 w-5" />
                  <span className="font-medium">Support</span>
                </Link>
                <Link 
                  to="#" 
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-white/10 transition-all duration-200"
                >
                  <UserIcon className="h-5 w-5" />
                  <span className="font-medium">Account</span>
                </Link>
              </div>

              {/* OTHERS */}
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">OTHERS</p>
                <Link 
                  to="#" 
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-white/10 transition-all duration-200"
                >
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">Settings</span>
                </Link>
              </div>
            </>
          ) : (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">MAIN MENU</p>
              <Link 
                to="/dashboard/customer" 
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover-lift",
                  pathname.includes('customer')
                    ? "bg-gradient-to-r from-teal-600/80 to-blue-600/80 text-white shadow-lg"
                    : "text-slate-300 hover:bg-white/10"
                )}
              >
                <Package className="h-5 w-5" />
                <span className="font-medium">My Shipments</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 w-full"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Log out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass-card"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Glassmorphism */}
        <header className="glass-card border-b border-border/40 p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-foreground">{getPageTitle()}</h2>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background/50 focus-within:ring-2 focus-within:ring-primary/50">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search" 
                  placeholder="Search..." 
                  className="border-0 bg-transparent focus-visible:ring-0 w-48"
                />
              </div>
              
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative hover-lift">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full border-2 border-background"></span>
              </Button>
              
              {/* User Profile */}
              <div className="flex items-center gap-3 pl-3 border-l border-border">
                <Avatar className="h-9 w-9 border-2 border-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-teal-500 to-blue-600 text-white font-semibold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block">
                  <p className="text-sm font-semibold text-foreground">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role || 'Unknown'}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
