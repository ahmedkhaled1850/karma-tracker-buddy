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
    
    const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, h, m, 0, 0);
    const endYesterday = new Date(startYesterday.getTime() + 9 * 3600 * 1000);
    if (now >= startYesterday && now <= endYesterday) {
        return startYesterday;
    }

    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    const endToday = new Date(startToday.getTime() + 9 * 3600 * 1000);
    if (now >= startToday && now <= endToday) {
        return startToday;
    }

    if (now < startToday) {
        return startToday;
    }
    
    const startTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m, 0, 0);
    return startTomorrow;
  }, [shiftStart, nextCountdown]);
  
  
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
        const { data: globalSettings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        let todayShiftStart = globalSettings?.shift_start_time || "";
        let todayBreaks: Record<BreakKey, string> = {
          break1: globalSettings?.break1_time || "11:00",
          break2: globalSettings?.break2_time || "14:00",
          break3: globalSettings?.break3_time || "17:00",
        };

        // Check daily_shifts for today
        const todayStr = new Date().toISOString().split("T")[0];
        const { data: dailyShift } = await supabase
          .from("daily_shifts")
          .select("*")
          .eq("user_id", user.id)
          .eq("shift_date", todayStr)
          .maybeSingle();

        if (dailyShift) {
          const ds = dailyShift as unknown as DailyShift;
          if (ds.shift_start) todayShiftStart = ds.shift_start;
          if (ds.break1_time) todayBreaks.break1 = ds.break1_time;
          if (ds.break2_time) todayBreaks.break2 = ds.break2_time;
          if (ds.break3_time) todayBreaks.break3 = ds.break3_time;
        } else {
          // Fallback to static schedule
          const staticShift = getStaticShift(todayStr);
          if (staticShift && !staticShift.is_off_day) {
            if (staticShift.shift_start) todayShiftStart = staticShift.shift_start;
            if (staticShift.break1_time) todayBreaks.break1 = staticShift.break1_time;
            if (staticShift.break2_time) todayBreaks.break2 = staticShift.break2_time;
            if (staticShift.break3_time) todayBreaks.break3 = staticShift.break3_time;
          }
        }

        setShiftStart(todayShiftStart);
        setSchedule(todayBreaks);
      } catch (error) {
        console.error("Error loading break settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Restore active break from localStorage
  useEffect(() => {
    if (!initialLoadRef.current) return;
    initialLoadRef.current = false;
    const stored = localStorage.getItem("ktb_active_break");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.key && parsed.start) {
          const elapsed = Math.floor((Date.now() - parsed.start) / 1000);
          const duration = DURATIONS[parsed.key as BreakKey];
          const remaining = duration - elapsed;
          if (remaining > 0) {
            setActiveBreak(parsed.key as BreakKey);
            setTimeLeft(remaining);
            setCurrentStart(parsed.start);
            setCurrentBreakKey(parsed.key as BreakKey);
          } else {
            localStorage.removeItem("ktb_active_break");
          }
        }
      } catch {
        localStorage.removeItem("ktb_active_break");
      }
    }
  }, []);

  // Save break log
  useEffect(() => {
    localStorage.setItem("ktb_break_log", JSON.stringify(breakLog));
  }, [breakLog]);

  // Timer effect
  useEffect(() => {
    if (activeBreak) {
      if (timeLeft <= 0) {
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
    const activeBreaks = (["break1", "break2", "break3"] as BreakKey[]).filter(k => schedule[k] && schedule[k].includes(":"));
    
    if (shiftStartDate && shiftEndDate) {
      const entries = activeBreaks.map((k) => {
        const [h, m] = schedule[k].split(":").map((x) => parseInt(x, 10));
        let start = new Date(
          shiftStartDate.getFullYear(),
          shiftStartDate.getMonth(),
          shiftStartDate.getDate(),
          h, m, 0, 0
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
    const entries = activeBreaks.map((k) => {
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

  // Broadcast next event info to header
  useEffect(() => {
    const getNextEventLabel = () => {
      if (activeBreak) return BREAK_LABELS[activeBreak];
      if (!shiftStartDate || !shiftEndDate) {
        return nextUp ? BREAK_LABELS[nextUp.key] : "";
      }
      const now = Date.now();
      if (now < shiftStartDate.getTime()) return "Shift Start";
      if (now <= shiftEndDate.getTime()) {
        return nextUp ? BREAK_LABELS[nextUp.key] : "Shift End";
      }
      return "Next Shift";
    };

    const countdown = activeBreak ? formatTimeLeft(timeLeft) : nextCountdown;
    const label = getNextEventLabel();
    const detail = { countdown, label };
    
    try {
      localStorage.setItem("ktb_next_event", JSON.stringify(detail));
      window.dispatchEvent(new CustomEvent("ktb_next_event", { detail }));
    } catch {}
  }, [nextCountdown, activeBreak, timeLeft, nextUp, shiftStartDate, shiftEndDate]);

  // Schedule auto-start for breaks
  useEffect(() => {
    autoStartTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    autoStartTimeoutsRef.current = [];
    if (!shiftStartDate || !shiftEndDate) return;
    const now = Date.now();
    (["break1", "break2", "break3"] as BreakKey[]).forEach((key) => {
      if (!schedule[key] || !schedule[key].includes(":")) return;
      const [h, m] = schedule[key].split(":").map((x) => parseInt(x, 10));
      const breakTime = new Date(
        shiftStartDate.getFullYear(),
        shiftStartDate.getMonth(),
        shiftStartDate.getDate(),
        h, m, 0, 0
      );
      if (breakTime.getTime() < shiftStartDate.getTime()) {
        breakTime.setDate(breakTime.getDate() + 1);
      }
      const delay = breakTime.getTime() - now;
      if (delay > 0 && breakTime.getTime() <= shiftEndDate.getTime()) {
        const id = window.setTimeout(() => {
          if (!activeBreak) {
            setActiveBreak(key);
            setTimeLeft(DURATIONS[key]);
            setCurrentStart(Date.now());
            setCurrentBreakKey(key);
            localStorage.setItem("ktb_active_break", JSON.stringify({ key, start: Date.now() }));
            notify("Break Started", `${BREAK_LABELS[key]} has started automatically`);
          }
        }, delay);
        autoStartTimeoutsRef.current.push(id);
      }
    });
    return () => {
      autoStartTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, [schedule, shiftStartDate, shiftEndDate, activeBreak]);

  // Schedule notifications
  useEffect(() => {
    scheduleNotifications();
    scheduleShiftNotifications();
  }, [schedule, shiftStartDate, shiftEndDate]);

  const notify = (title: string, body: string) => {
    toast(title, { description: body });
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "/favicon.ico" }); } catch {}
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      toast.success("Notifications enabled!");
    } else {
      toast.error("Notification permission denied");
    }
  };

  const scheduleNotifications = () => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
    if (!shiftStartDate || !shiftEndDate) return;
    (["break1", "break2", "break3"] as BreakKey[]).forEach((key) => {
      if (!schedule[key] || !schedule[key].includes(":")) return;
      const [h, m] = schedule[key].split(":").map((x) => parseInt(x, 10));
      const breakTime = new Date(
        shiftStartDate.getFullYear(),
        shiftStartDate.getMonth(),
        shiftStartDate.getDate(),
        h, m, 0, 0
      );
      if (breakTime.getTime() < shiftStartDate.getTime()) {
        breakTime.setDate(breakTime.getDate() + 1);
      }
      // Notify 1 min before
      const end = new Date(breakTime.getTime() + DURATIONS[key] * 1000);
      const beforeEndMs = end.getTime() - Date.now() - 60 * 1000;
      if (beforeEndMs > 0) {
        const id = window.setTimeout(() => {
          notify("Break Ending Soon", `1 minute left in ${BREAK_LABELS[key]} (ends at ${formatClock(end)})`);
        }, beforeEndMs);
        timeoutsRef.current.push(id);
      }
    });
  };
  
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
            {shiftStartDate && shiftEndDate && (
              <span className="text-sm text-muted-foreground">
                {Date.now() < shiftStartDate.getTime() ? `Next shift at ${formatClock(shiftStartDate)}` :
                 Date.now() <= shiftEndDate.getTime() ? (
                   nextUp ? `Next: ${BREAK_LABELS[nextUp.key]} at ${formatClock(nextUp.start)}` :
                   `Shift ends at ${formatClock(shiftEndDate)}`
                 ) : `Next shift at ${formatClock(new Date(shiftStartDate.getTime() + 24 * 3600 * 1000))}`}
              </span>
            )}
            <Button
              variant={canNotify ? "secondary" : "default"}
              size="sm"
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
                  {schedule[key] && schedule[key].includes(":") ? formatTime12H(schedule[key]) : <span className="text-muted-foreground">-</span>}
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                {schedule[key] && schedule[key].includes(":") ? "Automatic Schedule" : "No break scheduled"}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {activeBreak && (
        <Card className="p-4 border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TimerReset className="h-5 w-5 text-primary" />
              <span className="font-medium">{BREAK_LABELS[activeBreak]}</span>
              <span className="text-lg font-mono font-bold">{formatTimeLeft(timeLeft)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  stopCountdown();
                  notify("Break Paused", "Timer paused");
                }}
              >
                Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
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
          </div>
        </Card>
      )}
    </div>
  );
};
