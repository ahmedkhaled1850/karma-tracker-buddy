import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import { getStaticShift } from "@/lib/staticSchedule";
import { DailyShift } from "@/lib/types";

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

  type BreakKey = "break1" | "break2" | "break3";
  const labelFor = (key: BreakKey) =>
    key === "break1" ? "First Break" : key === "break2" ? "Second Break" : "Third Break";
  const formatHMS = (s: number) => {
    if (isNaN(s)) return "00:00:00";
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
  const [shiftStartStr, setShiftStartStr] = useState<string>("");
  const [shiftEndStr, setShiftEndStr] = useState<string>("");
  
  const [breakDurations, setBreakDurations] = useState<Record<BreakKey, number>>({
    break1: 15 * 60,
    break2: 30 * 60,
    break3: 15 * 60,
  });

  // Load break schedule from database
  useEffect(() => {
    const loadScheduleFromDB = async () => {
      if (!user?.id) return;
      
      try {
        // 1. Load global settings first
        const { data: globalSettings } = await supabase
          .from('user_settings')
          .select('break1_time, break2_time, break3_time, shift_start_time')
          .eq('user_id', user.id)
          .maybeSingle();
        
        let initialSchedule = {
          break1: "11:00",
          break2: "14:00",
          break3: "17:00",
        };
        let initialDurations = {
          break1: 15 * 60,
          break2: 30 * 60,
          break3: 15 * 60,
        };
        let initialShiftStart = "";
        let initialShiftEnd = "";

        if (globalSettings) {
          initialSchedule = {
            break1: globalSettings.break1_time || "11:00",
            break2: globalSettings.break2_time || "14:00",
            break3: globalSettings.break3_time || "17:00",
          };
          initialShiftStart = globalSettings.shift_start_time || "";
        }

        // 2. Load today's shift (DB or Static) to override
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        // Try DB first
        const { data: dbShift } = await supabase
          .from('daily_shifts')
          .select('*')
          .eq('user_id', user.id)
          .eq('shift_date', dateStr)
          .maybeSingle();

        let currentShift: Partial<DailyShift> | null = dbShift as unknown as DailyShift;

        // If not in DB, try static
        if (!currentShift) {
           const staticData = getStaticShift(dateStr);
           if (staticData && !staticData.is_off_day) {
             currentShift = {
               break1_time: staticData.break1_time || null,
               break1_duration: staticData.break1_duration,
               break2_time: staticData.break2_time || null,
               break2_duration: staticData.break2_duration,
               break3_time: staticData.break3_time || null,
               break3_duration: staticData.break3_duration,
               shift_start: staticData.shift_start || null,
               shift_end: staticData.shift_end || null,
             };
           }
        }

        // Apply shift data if available
        if (currentShift) {
          if (currentShift.break1_time) initialSchedule.break1 = currentShift.break1_time;
          if (currentShift.break2_time) initialSchedule.break2 = currentShift.break2_time;
          if (currentShift.break3_time) initialSchedule.break3 = currentShift.break3_time;
          
          if (currentShift.break1_duration) initialDurations.break1 = currentShift.break1_duration * 60;
          if (currentShift.break2_duration) initialDurations.break2 = currentShift.break2_duration * 60;
          if (currentShift.break3_duration) initialDurations.break3 = currentShift.break3_duration * 60;

          if (currentShift.shift_start) initialShiftStart = currentShift.shift_start;
          if (currentShift.shift_end) initialShiftEnd = currentShift.shift_end;
        }

        setBreakSchedule(initialSchedule);
        setBreakDurations(initialDurations);
        setShiftStartStr(initialShiftStart);
        setShiftEndStr(initialShiftEnd);

      } catch (err) {
        console.error('Error loading break schedule:', err);
      }
    };
    
    loadScheduleFromDB();
    
    // Also listen for updates
    const customHandler = () => loadScheduleFromDB();
    window.addEventListener("ktb-schedule-updated", customHandler);
    return () => {
      window.removeEventListener("ktb-schedule-updated", customHandler);
    };
  }, [user?.id]);
  
  const [nextText, setNextText] = useState<string>("");
  const originalTitleRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const [activeBreakInfo, setActiveBreakInfo] = useState<{ key: BreakKey; start: number } | null>(() => {
    const v = localStorage.getItem("ktb_active_break");
    if (!v) return null;
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed.start === "number" ? parsed : null;
    } catch {
      return null;
    }
  });

  // Keep active break in sync even within the same tab ("storage" doesn't fire in same document)
  const readActiveBreakFromStorage = () => {
    const v = localStorage.getItem("ktb_active_break");
    if (!v) return null;
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed.start === "number" ? (parsed as { key: BreakKey; start: number }) : null;
    } catch {
      return null;
    }
  };

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
        try {
          setBreakSchedule(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  // Shift window helper (supports shifts that cross midnight)
  const getShiftWindow = (now: Date) => {
    if (!shiftStartStr) return null;
    const [h, m] = shiftStartStr.split(":").map((x) => parseInt(x, 10));
    if (isNaN(h) || isNaN(m)) return null;

    // Calculate duration
    let duration = 9 * 3600 * 1000;
    if (shiftEndStr) {
      const [eh, em] = shiftEndStr.split(":").map((x) => parseInt(x, 10));
      if (!isNaN(eh) && !isNaN(em)) {
        let startMin = h * 60 + m;
        let endMin = eh * 60 + em;
        if (endMin <= startMin) endMin += 24 * 60; // Crosses midnight
        duration = (endMin - startMin) * 60 * 1000;
      }
    }

    const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, h, m, 0, 0);
    const endYesterday = new Date(startYesterday.getTime() + duration);
    if (now >= startYesterday && now <= endYesterday) {
      return { start: startYesterday, end: endYesterday };
    }

    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    const endToday = new Date(startToday.getTime() + duration);
    if (now >= startToday && now <= endToday) {
      return { start: startToday, end: endToday };
    }

    if (now < startToday) {
      return { start: startToday, end: endToday };
    }

    const startTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m, 0, 0);
    const endTomorrow = new Date(startTomorrow.getTime() + duration);
    return { start: startTomorrow, end: endTomorrow };
  };

  const shiftWindow = useMemo(() => getShiftWindow(new Date()), [shiftStartStr, shiftEndStr]);
  const shiftStartDate = shiftWindow?.start ?? null;
  const shiftEndDate = shiftWindow?.end ?? null;

  const nextBreak = useMemo(() => {
    if (!shiftStartDate || !shiftEndDate) return null;

    const nowMs = Date.now();
    const startMs = shiftStartDate.getTime();
    const endMs = shiftEndDate.getTime();

    // Only show "next break" while inside the shift window
    if (nowMs < startMs || nowMs > endMs) return null;

    const breaksInShift = (["break1", "break2", "break3"] as BreakKey[])
      .map((k) => {
        const [h, m] = breakSchedule[k].split(":").map((x) => parseInt(x, 10));
        const dt = new Date(
          shiftStartDate.getFullYear(),
          shiftStartDate.getMonth(),
          shiftStartDate.getDate(),
          h || 0,
          m || 0,
          0,
          0
        );
        if (dt.getTime() < startMs) dt.setDate(dt.getDate() + 1);
        return { key: k, start: dt };
      })
      .filter((b) => b.start.getTime() >= startMs && b.start.getTime() <= endMs)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    return breaksInShift.find((b) => b.start.getTime() > nowMs) || null;
  }, [breakSchedule, shiftStartDate, shiftEndDate]);

  const computeCircleText = () => {
    const nowMs = Date.now();

    const active = activeBreakInfo ?? readActiveBreakFromStorage();
    // Use ref to avoid triggering re-renders from within the interval
    if (active && (!activeBreakInfo || activeBreakInfo.start !== active.start || activeBreakInfo.key !== active.key)) {
      // Schedule state update outside of render to avoid re-render loops
      queueMicrotask(() => setActiveBreakInfo(active));
    }

    // If a break is active, show break countdown
    if (active) {
      const dur = breakDurations[active.key] || 15 * 60;
      const elapsed = Math.floor((nowMs - active.start) / 1000);
      if (elapsed < dur) {
        const left = Math.max(0, dur - elapsed);
        return `Break left ${formatHMS(left)}`;
      }
      // If break is expired, fall through to normal schedule display
    }

    const now = new Date();
    const window = getShiftWindow(now);
    const start = window?.start ?? null;
    const end = window?.end ?? null;

    if (!start || !end) {
      // Fallback: no shift configured — show countdown to next scheduled break
      const upcoming = (['break1', 'break2', 'break3'] as BreakKey[])
        .map((k) => {
          const [h, m] = breakSchedule[k].split(":").map((x) => parseInt(x, 10));
          let dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
          if (dt.getTime() <= now.getTime()) dt.setDate(dt.getDate() + 1);
          return dt.getTime();
        })
        .sort((a, b) => a - b)[0];

      if (upcoming) {
        return `Next break in ${formatHMS(Math.max(0, Math.floor((upcoming - nowMs) / 1000)))}`;
      }
      return "";
    }

    const startMs = start.getTime();
    const endMs = end.getTime();

    // Before shift: countdown to shift start
    if (nowMs < startMs) {
      return `Next shift in ${formatHMS(Math.max(0, Math.floor((startMs - nowMs) / 1000)))}`;
    }

    // After shift: countdown to next shift
    if (nowMs > endMs) {
      const nextStart = startMs + 24 * 3600 * 1000;
      return `Next shift in ${formatHMS(Math.max(0, Math.floor((nextStart - nowMs) / 1000)))}`;
    }

    // During shift: countdown to next break (within this shift) or shift end
    const breaksInShift = (["break1", "break2", "break3"] as BreakKey[])
      .map((k) => {
        const [h, m] = breakSchedule[k].split(":").map((x) => parseInt(x, 10));
        const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate(), h || 0, m || 0, 0, 0);
        if (dt.getTime() < startMs) dt.setDate(dt.getDate() + 1);
        return { key: k, start: dt.getTime() };
      })
      .filter((b) => b.start >= startMs && b.start <= endMs)
      .sort((a, b) => a.start - b.start);

    const next = breaksInShift.find((b) => b.start > nowMs);
    if (next) {
      return `Next break in ${formatHMS(Math.max(0, Math.floor((next.start - nowMs) / 1000)))}`;
    }

    return `Shift ends in ${formatHMS(Math.max(0, Math.floor((endMs - nowMs) / 1000)))}`;
  };
  // Use refs to avoid re-creating the interval on every state change
  const breakScheduleRef = useRef(breakSchedule);
  breakScheduleRef.current = breakSchedule;
  const activeBreakInfoRef = useRef(activeBreakInfo);
  activeBreakInfoRef.current = activeBreakInfo;
  const shiftStartStrRef = useRef(shiftStartStr);
  shiftStartStrRef.current = shiftStartStr;
  const shiftEndStrRef = useRef(shiftEndStr);
  shiftEndStrRef.current = shiftEndStr;
  const breakDurationsRef = useRef(breakDurations);
  breakDurationsRef.current = breakDurations;

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
  }, []);
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

      <div id="ktb-floating-circle" className="fixed bottom-6 right-6 z-50">
        <div
          className="relative h-28 w-28 rounded-full bg-gradient-to-br from-card to-muted shadow-xl flex items-center justify-center select-none cursor-pointer hover:scale-110 transition-all duration-300 group"
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
          {/* Outer glow pulse */}
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-primary/20 to-primary-glow/20 blur-md animate-pulse-glow group-hover:from-primary/40 group-hover:to-primary-glow/40 transition-all duration-500" />
          {/* Background circle */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-card via-card to-muted border-2 border-primary/25 group-hover:border-primary/50 transition-colors" />
          {/* Spinning ring */}
          <div className="absolute inset-1 rounded-full border-2 border-primary/30 animate-[spin_6s_linear_infinite]" style={{ borderTopColor: "transparent", borderRightColor: "transparent" }} />
          {/* Second spinning ring (opposite) */}
          <div className="absolute inset-2 rounded-full border border-primary/15 animate-[spin_8s_linear_infinite_reverse]" style={{ borderBottomColor: "transparent", borderLeftColor: "transparent" }} />
          {/* Inner content */}
          <div className="relative text-[0.7rem] font-bold text-foreground text-center leading-tight px-3">
            {nextText || "⏱️"}
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
