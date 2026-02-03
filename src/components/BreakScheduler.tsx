import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, TimerReset, AlarmClockCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStaticShift, formatTime12H } from "@/lib/staticSchedule";
import { DailyShift } from "@/lib/types";

type BreakKey = "break1" | "break2" | "break3";

const DURATIONS: Record<BreakKey, number> = {
  break1: 15 * 60,
  break2: 30 * 60,
  break3: 15 * 60,
};

const BREAK_LABELS: Record<BreakKey, string> = {
  break1: "First Break",
  break2: "Second Break",
  break3: "Third Break",
};

export const BreakScheduler = () => {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<Record<BreakKey, string>>({
    break1: "11:00",
    break2: "14:00",
    break3: "17:00",
  });
  const [activeBreak, setActiveBreak] = useState<BreakKey | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const autoStartTimeoutsRef = useRef<number[]>([]);
  const [currentStart, setCurrentStart] = useState<number | null>(null);
  const [currentBreakKey, setCurrentBreakKey] = useState<BreakKey | null>(null);
  const [breakLog, setBreakLog] = useState<Array<{ key: BreakKey; start: number; end?: number; durationSec?: number }>>(() => {
    const v = localStorage.getItem("ktb_break_log");
    if (!v) return [];
    try { return JSON.parse(v); } catch { return []; }
  });
  const [nextCountdown, setNextCountdown] = useState<string>("");
  const [shiftStart, setShiftStart] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const initialLoadRef = useRef(true);

  const shiftStartDate = useMemo(() => {
    if (!shiftStart) return null;
    const [h, m] = shiftStart.split(":").map((x) => parseInt(x, 10));
    if (isNaN(h) || isNaN(m)) return null;
    const now = new Date();
    
    // Check if we are currently in a shift started yesterday (crossing midnight)
    const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, h, m, 0, 0);
    const endYesterday = new Date(startYesterday.getTime() + 9 * 3600 * 1000);
    if (now >= startYesterday && now <= endYesterday) {
        return startYesterday;
    }

    // Check if we are currently in a shift started today
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    const endToday = new Date(startToday.getTime() + 9 * 3600 * 1000);
    if (now >= startToday && now <= endToday) {
        return startToday;
    }

    // Not currently in a shift. Find the next start.
    if (now < startToday) {
        return startToday;
    }
    
    // If now > endToday, next shift is tomorrow
    const startTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m, 0, 0);
    return startTomorrow;
  }, [shiftStart, nextCountdown]); // Re-calculate when countdown updates (every second) or shiftStart changes
  
  
  const shiftEndDate = useMemo(() => {
    if (!shiftStartDate) return null;
    return new Date(shiftStartDate.getTime() + 9 * 3600 * 1000);
  }, [shiftStartDate]);
  
  const shiftTimeoutsRef = useRef<number[]>([]);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        // 1. Load global settings first
        const { data: globalSettings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        let initialSchedule = {
          break1: "11:00",
          break2: "14:00",
          break3: "17:00",
        };
        let initialShiftStart = "";

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
               break2_time: staticData.break2_time || null,
               break3_time: staticData.break3_time || null,
               shift_start: staticData.shift_start || null,
             };
           }
        }

        // Apply shift data if available
        if (currentShift) {
          if (currentShift.break1_time) initialSchedule.break1 = currentShift.break1_time;
          if (currentShift.break2_time) initialSchedule.break2 = currentShift.break2_time;
          if (currentShift.break3_time) initialSchedule.break3 = currentShift.break3_time;
          if (currentShift.shift_start) initialShiftStart = currentShift.shift_start;
        }

        setSchedule(initialSchedule);
        setShiftStart(initialShiftStart);

        try {
          localStorage.setItem("ktb_break_schedule", JSON.stringify(initialSchedule));
          if (initialShiftStart) {
            localStorage.setItem("ktb_shift_start_time", initialShiftStart);
          }
        } catch {}

        initialLoadRef.current = false;
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  useEffect(() => {
    localStorage.setItem("ktb_break_log", JSON.stringify(breakLog));
  }, [breakLog]);

  useEffect(() => {
    if (activeBreak) {
      if (currentStart) {
        const elapsed = Math.floor((Date.now() - currentStart) / 1000);
        const left = Math.max(0, DURATIONS[activeBreak] - elapsed);
        setTimeLeft(left);
      } else {
        setTimeLeft(DURATIONS[activeBreak]);
      }
      startCountdown();
    }
    return () => {
      stopCountdown();
    };
  }, [activeBreak]);

  const canNotify = ((): boolean => {
    return ("Notification" in window) && Notification.permission === "granted";
  })();

  const nextUp = useMemo(() => {
    if (loading) return null;
    const now = new Date();
    // If shift window is known, compute relative to shift
    if (shiftStartDate && shiftEndDate) {
      const entries = (["break1", "break2", "break3"] as BreakKey[]).map((k) => {
        const [h, m] = schedule[k].split(":").map((x) => parseInt(x, 10));
        let start = new Date(
          shiftStartDate.getFullYear(),
          shiftStartDate.getMonth(),
          shiftStartDate.getDate(),
          h,
          m,
          0,
          0
        );
        if (start.getTime() < shiftStartDate.getTime()) {
          start.setDate(start.getDate() + 1);
        }
        return { key: k, start };
      });
      entries.sort((a, b) => a.start.getTime() - b.start.getTime());
      const next = entries.find(
        (e) => e.start.getTime() > now.getTime() && e.start.getTime() <= shiftEndDate.getTime()
      );
      return next || null;
    }
    // Fallback: compute next scheduled break today/tomorrow even without shift window
    const entries = (["break1", "break2", "break3"] as BreakKey[]).map((k) => {
      const [h, m] = schedule[k].split(":").map((x) => parseInt(x, 10));
      let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
      if (start.getTime() <= now.getTime()) {
        start.setDate(start.getDate() + 1);
      }
      return { key: k, start };
    });
    entries.sort((a, b) => a.start.getTime() - b.start.getTime());
    return entries[0] || null;
  }, [schedule, shiftStartDate, shiftEndDate, nextCountdown, loading]);

  useEffect(() => {
    if (activeBreak) {
      setNextCountdown("");
      return;
    }
    const id = window.setInterval(() => {
      const now = Date.now();
      if (shiftStartDate && shiftEndDate) {
        const startMs = shiftStartDate.getTime();
        const endMs = shiftEndDate.getTime();
        if (now < startMs) {
          const s = Math.max(0, Math.floor((startMs - now) / 1000));
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = s % 60;
          setNextCountdown(`${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`);
          return;
        }
        if (now <= endMs) {
          if (nextUp) {
            const s = Math.max(0, Math.floor((nextUp.start.getTime() - now) / 1000));
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            setNextCountdown(`${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`);
            return;
          }
          const s = Math.max(0, Math.floor((endMs - now) / 1000));
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = s % 60;
          setNextCountdown(`${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`);
          return;
        }
        const tomorrowStart = startMs + 24 * 3600 * 1000;
        const s = Math.max(0, Math.floor((tomorrowStart - now) / 1000));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        setNextCountdown(`${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`);
        return;
      }
      if (nextUp) {
        const diff = Math.max(0, nextUp.start.getTime() - now);
        const s = Math.floor(diff / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        setNextCountdown(`${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`);
      } else {
        setNextCountdown("");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeBreak, nextUp, shiftStartDate, shiftEndDate]);

  // Schedule auto-start for breaks
  useEffect(() => {
    if (!loading && !initialLoadRef.current) {
      scheduleAutoStart();
    }
    return () => {
      autoStartTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      autoStartTimeoutsRef.current = [];
    };
  }, [schedule, loading]);

  useEffect(() => {
    // Don't auto-request notification permission on mount (browsers often block it without a user gesture).
    // Scheduling still works; OS notifications will appear once the user enables them via the button.
    if (!loading && !initialLoadRef.current) {
      clearScheduled();
      scheduleNotifications();
      scheduleShiftNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialLoadRef.current]);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported in this browser");
      return;
    }

    if (Notification.permission === "granted") {
      toast.success("Notifications are enabled");
      return;
    }

    try {
      const res = await Notification.requestPermission();
      if (res === "granted") toast.success("Notifications enabled");
      else toast.error("Notifications blocked — allow them in browser settings");
    } catch {
      toast.error("Could not enable notifications");
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
    // In-app toast always
    toast.message(title, {
      description: body,
      action:
        "Notification" in window && Notification.permission !== "granted"
          ? {
              label: "Enable",
              onClick: requestNotificationPermission,
            }
          : undefined,
    });

    // OS notification (requires permission)
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch {}
    }

    playBeep();
  };

  const clearScheduled = () => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
  };


  function scheduleAutoStart() {
    autoStartTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    autoStartTimeoutsRef.current = [];

    (["break1", "break2", "break3"] as BreakKey[]).forEach((key) => {
      const now = new Date();
      const [h, m] = schedule[key].split(":").map((x) => parseInt(x, 10));
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
      const end = new Date(start.getTime() + DURATIONS[key] * 1000);
      const msUntilStart = start.getTime() - Date.now();
      if (msUntilStart > 0) {
        const id = window.setTimeout(() => {
          setActiveBreak(key);
          setCurrentStart(start.getTime());
          setCurrentBreakKey(key);
          localStorage.setItem("ktb_active_break", JSON.stringify({ key, start: start.getTime() }));
          notify("Break Started", `${BREAK_LABELS[key]} has started`);
        }, msUntilStart);
        autoStartTimeoutsRef.current.push(id);
      } else if (Date.now() < end.getTime()) {
        setActiveBreak(key);
        setCurrentStart(start.getTime());
        setCurrentBreakKey(key);
        localStorage.setItem("ktb_active_break", JSON.stringify({ key, start: start.getTime() }));
      }
    });
  }

  function scheduleNotifications() {
    (["break1", "break2", "break3"] as BreakKey[]).forEach((key) => {
      const now = new Date();
      const [h, m] = schedule[key].split(":").map((x) => parseInt(x, 10));
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
      const end = new Date(start.getTime() + DURATIONS[key] * 1000);
      const beforeStartMs = start.getTime() - Date.now() - 5 * 60 * 1000;
      const beforeEndMs = end.getTime() - Date.now() - 60 * 1000;
      if (beforeStartMs > 0) {
        const id = window.setTimeout(() => {
          notify("Break Reminder", `${BREAK_LABELS[key]} starts in 5 minutes at ${formatClock(start)}`);
        }, beforeStartMs);
        timeoutsRef.current.push(id);
      }
      if (Date.now() < end.getTime() && beforeEndMs > 0) {
        const id = window.setTimeout(() => {
          notify("Break Ending Soon", `1 minute left in ${BREAK_LABELS[key]} (ends at ${formatClock(end)})`);
        }, beforeEndMs);
        timeoutsRef.current.push(id);
      }
    });
  }
  
  const scheduleShiftNotifications = () => {
    shiftTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    shiftTimeoutsRef.current = [];
    if (!shiftStartDate || !shiftEndDate) return;
    const beforeStartMs = shiftStartDate.getTime() - Date.now() - 5 * 60 * 1000;
    const beforeEndMs = shiftEndDate.getTime() - Date.now() - 5 * 60 * 1000;
    if (beforeStartMs > 0) {
      const id = window.setTimeout(() => {
        notify("Shift Reminder", "Shift starts in 5 minutes");
      }, beforeStartMs);
      shiftTimeoutsRef.current.push(id);
    }
    if (beforeEndMs > 0) {
      const id = window.setTimeout(() => {
        notify("Shift Ending Soon", "Shift ends in 5 minutes");
      }, beforeEndMs);
      shiftTimeoutsRef.current.push(id);
    }
  };

  const startCountdown = () => {
    stopCountdown();
    intervalRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopCountdown();
          notify("Break Ended", `${BREAK_LABELS[activeBreak as BreakKey]} has ended`);
          if (currentStart && currentBreakKey) {
            const end = Date.now();
            const durationSec = Math.round((end - currentStart) / 1000);
            setBreakLog((prev) => [...prev, { key: currentBreakKey, start: currentStart, end, durationSec }]);
          }
          setActiveBreak(null);
          setCurrentStart(null);
          setCurrentBreakKey(null);
          localStorage.removeItem("ktb_active_break");
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as unknown as number;
  };

  const stopCountdown = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const formatClock = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatTimeLeft = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlarmClockCheck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Break Schedule</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={canNotify ? "secondary" : "default"}
              onClick={requestNotificationPermission}
            >
              <Bell className="mr-2 h-4 w-4" />
              {canNotify ? "Notifications On" : "Enable Notifications"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2 rounded-lg border p-4 bg-muted/20">
            <Label className="text-xs text-muted-foreground">Shift Start Time</Label>
            <div className="text-2xl font-mono font-medium">
              {formatTime12H(shiftStart)}
            </div>
            <div className="text-xs text-muted-foreground">
              {shiftStartDate ? `Ends at ${shiftEndDate?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "9-hour shift"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["break1", "break2", "break3"] as BreakKey[]).map((key) => (
            <div key={key} className="space-y-3 rounded-lg border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="font-medium">{BREAK_LABELS[key]}</span>
                <span className="text-xs text-muted-foreground">
                  {key === "break2" ? "30 min" : "15 min"}
                </span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start Time</Label>
                <div className="text-xl font-mono">
                  {formatTime12H(schedule[key])}
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Automatic Schedule
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TimerReset className="h-5 w-5 text-primary" />
            <span className="font-medium">Current Break</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {shiftStartDate && shiftEndDate ? (
              Date.now() < shiftStartDate.getTime() ? `Next shift at ${formatClock(shiftStartDate)}` :
              Date.now() <= shiftEndDate.getTime() ? (
                nextUp ? `Next: ${BREAK_LABELS[nextUp.key]} at ${formatClock(nextUp.start)}` :
                `Shift ends at ${formatClock(shiftEndDate)}`
              ) : `Next shift at ${formatClock(new Date(shiftStartDate.getTime() + 24 * 3600 * 1000))}`
            ) : (
              nextUp ? `Next: ${BREAK_LABELS[nextUp.key]} at ${formatClock(nextUp.start)}` : ""
            )}
          </span>
        </div>
        
        {/* Large circular timer display */}
        <div className="flex justify-center py-6">
          <div className="relative w-48 h-48 rounded-full border-4 border-primary/20 flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="absolute inset-2 rounded-full border-2 border-primary/30" />
            <div className="text-center">
              <div className="text-4xl font-mono font-bold text-foreground">
                {activeBreak
                  ? formatTimeLeft(timeLeft)
                  : nextCountdown || "00:00:00"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {activeBreak
                  ? BREAK_LABELS[activeBreak]
                  : shiftStartDate && shiftEndDate
                    ? (Date.now() < shiftStartDate.getTime()
                        ? "Until shift starts"
                        : (Date.now() <= shiftEndDate.getTime()
                            ? (nextUp ? "Until next break" : "Until shift ends")
                            : "No active shift"))
                    : (nextUp ? "Until next break" : "")}
              </div>
            </div>
          </div>
        </div>

        {activeBreak && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                stopCountdown();
                notify("Break Paused", "Timer paused");
              }}
            >
              Pause
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const end = Date.now();
                if (currentStart && currentBreakKey) {
                  const durationSec = Math.round((end - currentStart) / 1000);
                  setBreakLog((prev) => [...prev, { key: currentBreakKey, start: currentStart, end, durationSec }]);
                  notify("Break Ended", `Duration: ${formatTimeLeft(durationSec)}`);
                }
                setActiveBreak(null);
                setCurrentStart(null);
                setCurrentBreakKey(null);
                localStorage.removeItem("ktb_active_break");
              }}
            >
              End Break
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
