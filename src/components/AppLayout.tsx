import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIsFetching, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { Menu, LayoutDashboard, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

  const isFetching = useIsFetching();
  const [initialLoading, setInitialLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 400);
    return () => clearTimeout(t);
  }, []);
  // Only show loader on initial load or auth loading, NOT on background refetches
  const showLoader = initialLoading || isLoading;

  const links = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  type BreakKey = "break1" | "break2" | "break3";
  const labelFor = (key: BreakKey) =>
    key === "break1" ? "First Break" : key === "break2" ? "Second Break" : "Third Break";
  const parseTimeToDate = (time: string) => {
    const [h, m] = time.split(":").map((x) => parseInt(x, 10));
    const now = new Date();
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    if (dt.getTime() <= now.getTime()) {
      dt.setDate(dt.getDate() + 1);
    }
    return dt;
  };
  const formatHMS = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };
  const [breakSchedule, setBreakSchedule] = useState<Record<BreakKey, string>>({
    break1: "11:00",
    break2: "14:00",
    break3: "17:00",
  });
  useEffect(() => {
    const loadSchedule = () => {
      const stored = localStorage.getItem("ktb_break_schedule");
      if (stored) {
        try {
          setBreakSchedule(JSON.parse(stored));
        } catch {}
      }
    };
    
    loadSchedule();

    const handler = (e: StorageEvent) => {
      if (e.key === "ktb_break_schedule" && e.newValue) {
        try {
          setBreakSchedule(JSON.parse(e.newValue));
        } catch {}
      }
    };
    
    const customHandler = () => loadSchedule();

    window.addEventListener("storage", handler);
    window.addEventListener("ktb-schedule-updated", customHandler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("ktb-schedule-updated", customHandler);
    };
  }, []);
  
  const [nextText, setNextText] = useState<string>("");
  const originalTitleRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const canNotify = ((): boolean => {
    return ("Notification" in window) && Notification.permission === "granted";
  })();
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {}
    }
  };
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      o.start();
      setTimeout(() => {
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
        o.stop(ctx.currentTime + 0.85);
      }, 800);
    } catch {}
  };
  const notify = (title: string, body: string) => {
    toast.message(title, { description: body });
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch {}
    }
    playBeep();
  };
  const [activeBreakInfo, setActiveBreakInfo] = useState<{ key: BreakKey; start: number } | null>(() => {
    const v = localStorage.getItem("ktb_active_break");
    if (!v) return null;
    try { return JSON.parse(v); } catch { return null; }
  });
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "ktb_active_break") {
        try {
          setActiveBreakInfo(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setActiveBreakInfo(null);
        }
      }
      if (e.key === "ktb_break_schedule" && e.newValue) {
        try { setBreakSchedule(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  const [shiftStartStr, setShiftStartStr] = useState<string>(() => localStorage.getItem("ktb_shift_start_time") || "");
  useEffect(() => {
    const loadShiftStart = () => {
      setShiftStartStr(localStorage.getItem("ktb_shift_start_time") || "");
    };

    const handler = (e: StorageEvent) => {
      if (e.key === "ktb_shift_start_time") {
        setShiftStartStr(e.newValue || "");
      }
    };

    const customHandler = () => loadShiftStart();

    window.addEventListener("storage", handler);
    window.addEventListener("ktb-schedule-updated", customHandler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("ktb-schedule-updated", customHandler);
    };
  }, []);
  const shiftStartDate = useMemo(() => {
    if (!shiftStartStr) return null;
    const [h, m] = shiftStartStr.split(":").map((x) => parseInt(x, 10));
    if (isNaN(h) || isNaN(m)) return null;
    const now = new Date();
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    return dt;
  }, [shiftStartStr]);
  const shiftEndDate = useMemo(() => {
    if (!shiftStartDate) return null;
    return new Date(shiftStartDate.getTime() + 9 * 3600 * 1000);
  }, [shiftStartDate]);
  const nextBreak = useMemo(() => {
    const now = new Date();
    const todayEntries = (["break1", "break2", "break3"] as BreakKey[]).map((k) => {
      const [h, m] = breakSchedule[k].split(":").map((x) => parseInt(x, 10));
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
      return { key: k, start: dt };
    }).sort((a, b) => a.start.getTime() - b.start.getTime());
    if (shiftStartDate && shiftEndDate) {
      const startBound = shiftStartDate.getTime();
      const endBound = shiftEndDate.getTime();
      const upcoming = todayEntries.find(e => e.start.getTime() > now.getTime() && e.start.getTime() >= startBound && e.start.getTime() <= endBound);
      return upcoming || null;
    }
    const upcoming = todayEntries.find(e => e.start.getTime() > now.getTime());
    return upcoming || null;
  }, [breakSchedule, shiftStartDate, shiftEndDate]);
  const DURATIONS: Record<BreakKey, number> = { break1: 15 * 60, break2: 30 * 60, break3: 15 * 60 };
  const computeCircleText = () => {
    const nowMs = Date.now();
    if (activeBreakInfo) {
      const dur = DURATIONS[activeBreakInfo.key];
      const elapsed = Math.floor((nowMs - activeBreakInfo.start) / 1000);
      const left = Math.max(0, dur - elapsed);
      return left > 0 ? `Break left ${formatHMS(left)}` : `Break left 00:00:00`;
    }

    const events: { label: string, time: number }[] = [];

    if (shiftStartStr) {
       const [h, m] = shiftStartStr.split(":").map(x => parseInt(x, 10));
       const now = new Date();
       
       // Check if currently in shift
       let s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
       let e = new Date(s.getTime() + 9 * 3600 * 1000);
       
       let inShift = false;
       let shiftEnd = 0;
       
       if (nowMs >= s.getTime() && nowMs <= e.getTime()) {
           inShift = true;
           shiftEnd = e.getTime();
       } else {
           // Check Yesterday's start (for overnight)
           let sPrev = new Date(s.getTime() - 24 * 3600 * 1000);
           let ePrev = new Date(sPrev.getTime() + 9 * 3600 * 1000);
           if (nowMs >= sPrev.getTime() && nowMs <= ePrev.getTime()) {
               inShift = true;
               shiftEnd = ePrev.getTime();
           }
       }
       
       if (inShift) {
           events.push({ label: "Shift ends", time: shiftEnd });
       } else {
           // Not in shift. Next event is Shift Start.
           let nextS = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
           if (nextS.getTime() <= nowMs) {
               nextS.setDate(nextS.getDate() + 1);
           }
           events.push({ label: "Next shift", time: nextS.getTime() });
       }
    }

    // Breaks
    (["break1", "break2", "break3"] as BreakKey[]).forEach((k) => {
        const [h, m] = breakSchedule[k].split(":").map((x) => parseInt(x, 10));
        const now = new Date();
        let dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
        if (dt.getTime() <= nowMs) {
            dt.setDate(dt.getDate() + 1);
        }
        events.push({ label: "Next break", time: dt.getTime() });
    });

    events.sort((a, b) => a.time - b.time);
    
    if (events.length > 0) {
        const next = events[0];
        const s = Math.floor((next.time - nowMs) / 1000);
        return `${next.label} in ${formatHMS(s)}`;
    }
    
    return "";
  };
  useEffect(() => {
    if (originalTitleRef.current === null) originalTitleRef.current = document.title;
    const id = window.setInterval(() => {
      const text = computeCircleText();
      setNextText(text);
      const m = text.match(/(\d+):(\d+):(\d+)/);
      if (m) {
        const h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const totalMin = h * 60 + min;
        if (/Next break/.test(text)) {
          if (totalMin === 10) document.title = `Next break in 10m`;
          else if (totalMin === 5) document.title = `⏳ Next break in 5m`;
        } else if (/Shift ends/.test(text) && totalMin === 5) {
          document.title = `⏳ Shift ends in 5m`;
        } else if (originalTitleRef.current) {
          document.title = originalTitleRef.current;
        }
      }
    }, 1000);
    return () => {
      window.clearInterval(id);
      if (originalTitleRef.current) document.title = originalTitleRef.current;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakSchedule, activeBreakInfo, shiftStartStr]);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    setDragPos({ x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragPos) return;
    const dx = e.clientX - dragPos.x;
    const dy = e.clientY - dragPos.y;
    const el = document.getElementById("ktb-floating-circle");
    if (el) {
      const rect = el.getBoundingClientRect();
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.left = `${rect.left + dx}px`;
      el.style.top = `${rect.top + dy}px`;
    }
    setDragPos({ x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };
  const onCircleClick = () => {
    localStorage.setItem("ktb_active_tab", "notes");
    navigate("/");
  };

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
                    <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
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
        <header className="hidden md:flex justify-between items-center p-4 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
            <span className="font-bold text-lg bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Big Brother
            </span>
            <Card className="px-3 py-2 flex items-center gap-3 border-none shadow-none bg-transparent">
              <div className="text-right">
                <div className="text-sm font-medium">{name}</div>
                <div className="text-xs text-muted-foreground">{email}</div>
              </div>
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Card>
        </header>

        <main className="flex-1 container mx-auto px-4 py-6 md:px-8 md:py-8 animate-fade-in">
            {children}
        </main>
      </div>

      <div id="ktb-floating-circle" className="fixed bottom-6 right-6 z-50">
        <div
          className="relative h-16 w-16 rounded-full border-2 border-primary/50 bg-card shadow-lg flex items-center justify-center select-none cursor-pointer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={onCircleClick}
          title={
            shiftStartDate && shiftEndDate
              ? (Date.now() < shiftStartDate.getTime()
                  ? `Next shift at ${shiftStartDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : (Date.now() <= shiftEndDate.getTime()
                      ? (nextBreak ? `Next: ${labelFor(nextBreak.key)} at ${nextBreak.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : `Shift ends at ${shiftEndDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`)
                      : `Next shift at ${new Date(shiftStartDate.getTime() + 24 * 3600 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`))
              : (nextBreak ? `Next: ${labelFor(nextBreak.key)} at ${nextBreak.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "")
          }
        >
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-spin" style={{ borderTopColor: "transparent" }} />
          <div className="text-[11px] font-mono text-foreground text-center leading-tight px-2">
            {nextText || "— —"}
          </div>
        </div>
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
