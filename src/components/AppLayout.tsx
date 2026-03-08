import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { Menu, Settings, LogOut, Plus, Minus, ListChecks, BarChart3, NotebookText, ClipboardList, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut, isLoading } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
      // Persist sidebar state
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('sidebarCollapsed');
          return saved === 'true';
      }
      return false;
  });

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
  const email = user?.email || "";
  const initials = name ? name.slice(0, 2).toUpperCase() : "";

  
  const [initialLoading, setInitialLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 400);
    return () => clearTimeout(t);
  }, []);
  // Only show loader on initial load or auth loading, NOT on background refetches
  const showLoader = initialLoading || isLoading;

  const links = [
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Work Schedule", href: "/work-schedule", icon: Calendar },
  ];

  const navigate = useNavigate();

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
        
        {/* Mobile Header */}
        <header className="md:hidden border-b bg-card sticky top-0 z-40 backdrop-blur-sm">
          <div className="container px-4 py-3 flex items-center justify-between">
            <span className="font-bold text-lg bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Big Brother
            </span>
            <div className="flex items-center gap-2">
                <Card className="px-2 py-1 flex items-center gap-2 border-none shadow-none bg-transparent">
                    <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                </Card>
                <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64">
                    <div className="h-full flex flex-col bg-card">
                    <div className="p-6 border-b">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Big Brother
                        </h1>
                    </div>
                    <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                        <div className="space-y-1">
                            {[
                              { tab: "overview", name: "Overview 📊", icon: BarChart3 },
                              { tab: "tickets", name: "Tickets 🎫", icon: ListChecks },
                              { tab: "analytics", name: "Analytics 📈", icon: BarChart3 },
                              { tab: "notes", name: "Notes & Schedule 📝", icon: NotebookText },
                              { tab: "log", name: "Log 📋", icon: ClipboardList },
                            ].map((tl) => {
                              const Icon = tl.icon;
                              const mobileActiveTab = (() => { try { return localStorage.getItem("ktb_active_tab") || "overview"; } catch { return "overview"; } })();
                              const isActive = location.pathname === "/" && mobileActiveTab === tl.tab;
                              return (
                                <Button
                                  key={tl.tab}
                                  variant="ghost"
                                  className={cn(
                                    "w-full justify-start gap-3 transition-all",
                                    isActive && "bg-primary/10 text-primary border border-primary/20 font-medium"
                                  )}
                                  onClick={() => {
                                    localStorage.setItem("ktb_active_tab", tl.tab);
                                    try { window.dispatchEvent(new CustomEvent("ktb_tab_change", { detail: tl.tab })); } catch {}
                                    navigate("/");
                                  }}
                                >
                                  <Icon className="h-5 w-5" />
                                  <span>{tl.name}</span>
                                </Button>
                              );
                            })}
                        </div>
                        {links.map((link) => {
                        const Icon = link.icon;
                        const isActive = location.pathname === link.href;
                        
                        return (
                            <Link key={link.href} to={link.href}>
                            <Button
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                "w-full justify-start gap-3 mb-1",
                                isActive && "bg-secondary font-medium"
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                {link.name}
                            </Button>
                            </Link>
                        );
                        })}
                    </div>
                    <div className="p-4 border-t">
                        <div className="mb-4 px-2">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <p className="text-xs text-muted-foreground truncate">{email}</p>
                        </div>
                        <Button variant="outline" className="w-full justify-start gap-3" onClick={signOut}>
                        <LogOut className="h-5 w-5" />
                        Sign Out
                        </Button>
                    </div>
                    </div>
                </SheetContent>
                </Sheet>
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
                <div className="text-xs text-muted-foreground">{email}</div>
              </div>
            </div>
            <div className="flex items-center justify-center">
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

        <main className="flex-1 container mx-auto px-4 py-6 md:px-8 md:py-8 animate-fade-in">
            {children}
        </main>
      </div>


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
