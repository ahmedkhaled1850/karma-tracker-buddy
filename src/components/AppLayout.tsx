import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "./Sidebar";
import { BarChart3, ListChecks, NotebookText, ClipboardList, Calendar, Settings, LogOut, Plus, Minus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

const MOBILE_TABS = [
  { tab: "overview", label: "Overview", icon: BarChart3 },
  { tab: "tickets", label: "Tickets", icon: ListChecks },
  { tab: "analytics", label: "Analytics", icon: BarChart3 },
  { tab: "notes", label: "Notes", icon: NotebookText },
  { tab: "log", label: "Log", icon: ClipboardList },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved === 'true';
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem("ktb_active_tab") || "overview"; } catch { return "overview"; }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce.detail) setActiveTab(ce.detail);
    };
    window.addEventListener("ktb_tab_change", handler as EventListener);
    return () => window.removeEventListener("ktb_tab_change", handler as EventListener);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const name = profile?.username || user?.email || "";
  const initials = name ? name.slice(0, 2).toUpperCase() : "";

  const [initialLoading, setInitialLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 400);
    return () => clearTimeout(t);
  }, []);
  const showLoader = initialLoading || isLoading;

  // Next event from BreakScheduler
  const [nextEvent, setNextEvent] = useState<{ countdown: string; label: string }>({ countdown: "", label: "" });
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ countdown: string; label: string }>;
      if (ce.detail) setNextEvent(ce.detail);
    };
    window.addEventListener("ktb_next_event", handler as EventListener);
    try {
      const stored = localStorage.getItem("ktb_next_event");
      if (stored) setNextEvent(JSON.parse(stored));
    } catch {}
    return () => window.removeEventListener("ktb_next_event", handler as EventListener);
  }, []);

  const handleTabClick = (tab: string) => {
    localStorage.setItem("ktb_active_tab", tab);
    try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: tab })); } catch {}
    setActiveTab(tab);
    if (location.pathname !== "/") navigate("/");
  };

  const isOnHome = location.pathname === "/";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} toggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Main Content Wrapper */}
      <div 
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300",
          sidebarCollapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        {/* Mobile Top Bar - Slim */}
        <header className="md:hidden border-b bg-card/95 backdrop-blur-md sticky top-0 z-40">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 border border-border">
                <AvatarFallback className="text-[10px] font-bold">{initials}</AvatarFallback>
              </Avatar>
              <span className="font-bold text-sm bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Big Brother
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {nextEvent.countdown && nextEvent.label && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10">
                  <Clock className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-mono font-bold text-primary">{nextEvent.countdown}</span>
                </div>
              )}
              <Button 
                size="icon" 
                className="h-7 w-7 rounded-md bg-success/15 text-success hover:bg-success/25"
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent("ktb_quick_rating", { detail: "good" })); } catch {}
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button 
                size="icon" 
                className="h-7 w-7 rounded-md bg-destructive/15 text-destructive hover:bg-destructive/25"
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent("ktb_quick_rating", { detail: "bad" })); } catch {}
                }}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between gap-4 px-4 py-3 border-b bg-card/70 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{name}</div>
              <div className="text-xs text-muted-foreground">{user?.email || ""}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {nextEvent.countdown && nextEvent.label && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">{nextEvent.label}</span>
                <span className="text-sm font-mono font-bold text-primary">{nextEvent.countdown}</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-2 py-1 shadow-sm">
              <Button 
                size="sm" 
                className="h-9 px-4 rounded-lg bg-success/15 text-success hover:bg-success/25"
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent("ktb_quick_rating", { detail: "good" })); } catch {}
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="font-medium">Add Good</span>
              </Button>
              <Button 
                size="sm" 
                className="h-9 px-4 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25"
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent("ktb_quick_rating", { detail: "bad" })); } catch {}
                }}
              >
                <Minus className="mr-2 h-4 w-4" />
                <span className="font-medium">Add Bad</span>
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={signOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Main Content - extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 px-3 py-4 md:px-8 md:py-8 pb-20 md:pb-8 animate-fade-in">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isOnHome && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
          <div className="flex items-center justify-around px-1 py-1.5">
            {MOBILE_TABS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  onClick={() => handleTabClick(item.tab)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-all min-w-0 flex-1",
                    isActive 
                      ? "text-primary bg-primary/10" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                  <span className={cn(
                    "text-[10px] font-medium truncate",
                    isActive && "text-primary font-semibold"
                  )}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Mobile bottom nav for non-home pages */}
      {!isOnHome && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
          <div className="flex items-center justify-around px-1 py-1.5">
            <button
              onClick={() => navigate("/")}
              className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg text-muted-foreground hover:text-foreground flex-1"
            >
              <BarChart3 className="h-5 w-5" />
              <span className="text-[10px] font-medium">Home</span>
            </button>
            <Link to="/work-schedule" className="flex-1">
              <button
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg w-full transition-all",
                  location.pathname === "/work-schedule" ? "text-primary bg-primary/10" : "text-muted-foreground"
                )}
              >
                <Calendar className="h-5 w-5" />
                <span className="text-[10px] font-medium">Schedule</span>
              </button>
            </Link>
            <Link to="/settings" className="flex-1">
              <button
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg w-full transition-all",
                  location.pathname === "/settings" ? "text-primary bg-primary/10" : "text-muted-foreground"
                )}
              >
                <Settings className="h-5 w-5" />
                <span className="text-[10px] font-medium">Settings</span>
              </button>
            </Link>
            <button
              onClick={signOut}
              className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg text-muted-foreground hover:text-foreground flex-1"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-[10px] font-medium">Logout</span>
            </button>
          </div>
        </nav>
      )}

      {showLoader && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div className="w-full max-w-md p-6 rounded-xl bg-card border border-border shadow-elegant animate-scale-in">
            <div className="space-y-3">
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse-glow" />
              <div className="h-4 w-2/3 bg-muted rounded animate-pulse-glow" />
              <div className="h-4 w-1/2 bg-muted rounded animate-pulse-glow" />
            </div>
            <div className="mt-6 h-2 w-full bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary animate-[fade-in_0.6s_ease-out] w-2/3" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground text-center">Loading data…</p>
          </div>
        </div>
      )}
    </div>
  );
}
