import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Settings, LogOut, ChevronLeft, ChevronRight, Calendar, BarChart3, NotebookText, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GoalsSection } from "@/components/GoalsSection";

interface SidebarProps {
  collapsed?: boolean;
  toggleCollapsed?: () => void;
}

export function Sidebar({ collapsed = false, toggleCollapsed }: SidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const [metrics, setMetrics] = useState<{ totalGood: number; totalBad: number; karmaBad: number }>({ totalGood: 0, totalBad: 0, karmaBad: 0 });
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ totalGood: number; totalBad: number; karmaBad: number }>;
      if (ce.detail) setMetrics(ce.detail);
    };
    window.addEventListener("ktb_metrics_update", handler as EventListener);
    try {
      const s = localStorage.getItem("ktb_metrics_update");
      if (s) setMetrics(JSON.parse(s));
    } catch {}
    return () => window.removeEventListener("ktb_metrics_update", handler as EventListener);
  }, []);

  const links = [
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Work Schedule", href: "/work-schedule", icon: Calendar },
  ];

  const SidebarContent = () => (
    <>
      <div className={cn("p-4 border-b flex items-center", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent whitespace-nowrap">
            Big Brother
          </h1>
        )}
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleCollapsed} 
            className={cn("hidden md:flex", collapsed && "h-8 w-8")}
        >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-2 space-y-2">
        <div className="space-y-2">
          <div>
            {collapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full px-2">
                      <div className="text-[12px] font-medium flex flex-col items-center gap-1">
                        <div className="leading-none">
                          <span className="text-muted-foreground">CSAT</span>
                          <span className="mx-1 text-muted-foreground">—</span>
                          <span className="text-foreground">{(() => {
                            const total = metrics.totalGood + metrics.totalBad;
                            return total > 0 ? `${((metrics.totalGood / total) * 100).toFixed(1)}%` : "100%";
                          })()}</span>
                        </div>
                        <div className="leading-none">
                          <span className="text-muted-foreground">Karma</span>
                          <span className="mx-1 text-muted-foreground">—</span>
                          <span className="text-foreground">{(() => {
                            const base = metrics.totalGood + metrics.totalBad + metrics.karmaBad;
                            return base > 0 ? `${((metrics.totalGood / base) * 100).toFixed(1)}%` : "100%";
                          })()}</span>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">Goals Summary</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="w-full">
                <GoalsSection
                  currentValue={metrics.totalGood}
                  totalNegatives={metrics.totalBad}
                  metricName="CSAT"
                  targets={[88, 90, 95]}
                  variant="sidebar"
                />
                <GoalsSection
                  currentValue={metrics.totalGood}
                  totalNegatives={metrics.totalBad + metrics.karmaBad}
                  metricName="Karma"
                  targets={[88, 90, 95]}
                  variant="sidebar"
                />
              </div>
            )}
          </div>
          <div>
            {collapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/"
                      onClick={() => {
                        try { localStorage.setItem("ktb_active_tab", "overview"); } catch {}
                        try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: "overview" })); } catch {}
                      }}
                    >
                      <Button variant="ghost" className="w-full px-2 justify-center">
                        <BarChart3 className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Overview 📊</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Link
                to="/"
                onClick={() => {
                  try { localStorage.setItem("ktb_active_tab", "overview"); } catch {}
                  try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: "overview" })); } catch {}
                }}
              >
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <BarChart3 className="h-5 w-5" />
                  <span>Overview 📊</span>
                </Button>
              </Link>
            )}
          </div>
          <div>
            {collapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/"
                      onClick={() => {
                        try { localStorage.setItem("ktb_active_tab", "tickets"); } catch {}
                        try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: "tickets" })); } catch {}
                      }}
                    >
                      <Button variant="ghost" className="w-full px-2 justify-center">
                        <ListChecks className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Tickets 🎫</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Link
                to="/"
                onClick={() => {
                  try { localStorage.setItem("ktb_active_tab", "tickets"); } catch {}
                  try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: "tickets" })); } catch {}
                }}
              >
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <ListChecks className="h-5 w-5" />
                  <span>Tickets 🎫</span>
                </Button>
              </Link>
            )}
          </div>
          <div>
            {collapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/"
                      onClick={() => {
                        try { localStorage.setItem("ktb_active_tab", "analytics"); } catch {}
                        try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: "analytics" })); } catch {}
                      }}
                    >
                      <Button variant="ghost" className="w-full px-2 justify-center">
                        <BarChart3 className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Analytics 📈</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Link
                to="/"
                onClick={() => {
                  try { localStorage.setItem("ktb_active_tab", "analytics"); } catch {}
                  try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: "analytics" })); } catch {}
                }}
              >
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <BarChart3 className="h-5 w-5" />
                  <span>Analytics 📈</span>
                </Button>
              </Link>
            )}
          </div>
          <div>
            {collapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/"
                      onClick={() => {
                        try { localStorage.setItem("ktb_active_tab", "notes"); } catch {}
                        try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: "notes" })); } catch {}
                      }}
                    >
                      <Button variant="ghost" className="w-full px-2 justify-center">
                        <NotebookText className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Notes & Schedule 📝</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Link
                to="/"
                onClick={() => {
                  try { localStorage.setItem("ktb_active_tab", "notes"); } catch {}
                  try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: "notes" })); } catch {}
                }}
              >
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <NotebookText className="h-5 w-5" />
                  <span>Notes & Schedule 📝</span>
                </Button>
              </Link>
            )}
          </div>
          <div>
            {collapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/"
                      onClick={() => {
                        try { localStorage.setItem("ktb_active_tab", "log"); } catch {}
                        try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: "log" })); } catch {}
                      }}
                    >
                      <Button variant="ghost" className="w-full px-2 justify-center">
                        <ListChecks className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Log 📋</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Link
                to="/"
                onClick={() => {
                  try { localStorage.setItem("ktb_active_tab", "log"); } catch {}
                  try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: "log" })); } catch {}
                }}
              >
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <ListChecks className="h-5 w-5" />
                  <span>Log 📋</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.href;
          
          const LinkButton = (
            <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start mb-1",
                  isActive && "bg-secondary font-medium",
                  collapsed ? "px-2 justify-center" : "gap-3"
                )}
            >
                <Icon className={cn("h-5 w-5", collapsed ? "" : "")} />
                {!collapsed && <span>{link.name}</span>}
            </Button>
          );

          return (
            <div key={link.href}>
                {collapsed ? (
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Link to={link.href}>{LinkButton}</Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                {link.name}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    <Link to={link.href}>{LinkButton}</Link>
                )}
            </div>
          );
        })}

        
      </div>

      <div className="p-4 border-t">
        {collapsed ? (
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="w-full" onClick={signOut}>
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Sign Out</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        ) : (
            <Button variant="outline" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="h-5 w-5" />
            Sign Out
            </Button>
        )}
      </div>
    </>
  );

  return (
    <div 
        className={cn(
            "hidden md:flex h-screen flex-col border-r bg-card fixed left-0 top-0 z-50 transition-all duration-300",
            collapsed ? "w-16" : "w-64"
        )}
    >
        <SidebarContent />
    </div>
  );
}
