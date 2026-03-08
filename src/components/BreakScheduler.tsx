import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, TimerReset, AlarmClockCheck, Loader2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
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

interface BreakSchedulerProps {
  performanceId?: string | null;
}

export const BreakScheduler = ({ performanceId }: BreakSchedulerProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
  const [shiftEnd, setShiftEnd] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const initialLoadRef = useRef(true);

  // Late break state
  const [lateBreakDialog, setLateBreakDialog] = useState(false);
  const [lateBreakKey, setLateBreakKey] = useState<BreakKey | null>(null);
  const [lateBreakActualTime, setLateBreakActualTime] = useState("");
  const [lateBreakSaving, setLateBreakSaving] = useState(false);

  const shiftStartDate = useMemo(() => {
    if (!shiftStart) return null;
    const [h, m] = shiftStart.split(":").map((x) => parseInt(x, 10));
    if (isNaN(h) || isNaN(m)) return null;
    const now = new Date();
    
    // Calculate shift duration from actual end time or default 9h
    const shiftDurationMs = shiftEnd ? (() => {
      const [eh, em] = shiftEnd.split(":").map((x) => parseInt(x, 10));
      let durationMin = (eh * 60 + em) - (h * 60 + m);
      if (durationMin <= 0) durationMin += 24 * 60; // overnight shift
      return durationMin * 60 * 1000;
    })() : 9 * 3600 * 1000;
    
    const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, h, m, 0, 0);
    const endYesterday = new Date(startYesterday.getTime() + shiftDurationMs);
    if (now >= startYesterday && now <= endYesterday) {
        return startYesterday;
    }

    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    const endToday = new Date(startToday.getTime() + shiftDurationMs);
    if (now >= startToday && now <= endToday) {
        return startToday;
    }

    if (now < startToday) {
        return startToday;
    }
    
    const startTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m, 0, 0);
    return startTomorrow;
  }, [shiftStart, shiftEnd, nextCountdown]);
  
  
  const shiftEndDate = useMemo(() => {
    if (!shiftStartDate) return null;
    if (shiftEnd) {
      const [eh, em] = shiftEnd.split(":").map((x) => parseInt(x, 10));
      const endDate = new Date(shiftStartDate);
      endDate.setHours(eh, em, 0, 0);
      // If end is before start, it's next day
      if (endDate.getTime() <= shiftStartDate.getTime()) {
        endDate.setDate(endDate.getDate() + 1);
      }
      return endDate;
    }
    return new Date(shiftStartDate.getTime() + 9 * 3600 * 1000);
  }, [shiftStartDate, shiftEnd]);
  
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
          // Use daily shift values directly — empty/null means no break scheduled
          todayBreaks.break1 = ds.break1_time || "";
          todayBreaks.break2 = ds.break2_time || "";
          todayBreaks.break3 = ds.break3_time || "";
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

  const openLateBreakDialog = (key: BreakKey) => {
    const now = new Date();
    setLateBreakKey(key);
    setLateBreakActualTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setLateBreakDialog(true);
  };

  const handleSaveLateBreak = async () => {
    if (!lateBreakKey || !lateBreakActualTime || !user?.id) return;
    setLateBreakSaving(true);
    try {
      const scheduledTime = schedule[lateBreakKey];
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      
      const noteContent = `⏰ Late Break — ${BREAK_LABELS[lateBreakKey]}\n` +
        `📅 Date: ${todayStr}\n` +
        `🕐 Scheduled: ${formatTime12H(scheduledTime)}\n` +
        `🕐 Actual: ${formatTime12H(lateBreakActualTime)}\n` +
        `📝 Logged at: ${timeStr}`;

      // Save to daily_notes if we have a performanceId
      if (performanceId) {
        const { error } = await supabase.from("daily_notes").insert({
          performance_id: performanceId,
          note_date: todayStr,
          content: noteContent,
          user_id: user.id,
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["dailyNotes"] });
      }

      toast.success("Late break logged in notes!");
      setLateBreakDialog(false);
    } catch (error) {
      console.error("Error saving late break:", error);
      toast.error("Failed to save late break note");
    } finally {
      setLateBreakSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Break Banner */}
      {activeBreak && (
        <Card className="p-4 border border-primary/30 bg-primary/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-muted">
            <div 
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${(timeLeft / DURATIONS[activeBreak]) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/15">
                <TimerReset className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{BREAK_LABELS[activeBreak]}</p>
                <p className="text-2xl font-mono font-bold text-primary tabular-nums">{formatTimeLeft(timeLeft)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs bg-muted/50 hover:bg-muted"
                onClick={() => {
                  stopCountdown();
                  notify("Break Paused", "Timer paused");
                }}
              >
                Pause
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20"
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
                End
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Shift Overview */}
      <Card className="p-4 border border-border/60">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlarmClockCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Shift & Breaks</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-xs rounded-md ${canNotify ? "text-success" : "text-muted-foreground hover:text-foreground"}`}
            onClick={requestNotificationPermission}
          >
            <Bell className="h-3 w-3 mr-1" />
            {canNotify ? "On" : "Enable"}
          </Button>
        </div>

        {/* Timeline Layout */}
        <div className="relative">
          {/* Shift info */}
          {shiftStartDate && shiftEndDate && (
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Start</p>
                <p className="text-lg font-mono font-bold tabular-nums">{formatTime12H(shiftStart)}</p>
              </div>
              <div className="flex-1 text-center">
                <div className="h-px bg-border relative">
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground bg-card px-1.5">9h</span>
                </div>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">End</p>
                <p className="text-lg font-mono font-bold tabular-nums">{shiftEndDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          )}

          {/* Next event hint */}
          {shiftStartDate && shiftEndDate && !activeBreak && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-muted/50 text-center">
              <span className="text-xs text-muted-foreground">
                {Date.now() < shiftStartDate.getTime() ? `Shift starts at ${formatClock(shiftStartDate)}` :
                 Date.now() <= shiftEndDate.getTime() ? (
                   nextUp ? `Next: ${BREAK_LABELS[nextUp.key]} at ${formatClock(nextUp.start)}` :
                   `Shift ends at ${formatClock(shiftEndDate)}`
                 ) : `Next shift tomorrow`}
              </span>
            </div>
          )}

          {/* Break Cards */}
          <div className="grid grid-cols-3 gap-2">
            {(["break1", "break2", "break3"] as BreakKey[]).map((key) => {
              const isActive = activeBreak === key;
              const isScheduled = schedule[key] && schedule[key].includes(":");
              const isNext = nextUp?.key === key;
              
              return (
                <div
                  key={key}
                  className={`rounded-lg p-3 text-center transition-all duration-300 border ${
                    isActive 
                      ? "border-primary/40 bg-primary/10 shadow-elegant" 
                      : isNext 
                        ? "border-primary/20 bg-primary/5" 
                        : "border-border/40 bg-muted/30"
                  }`}
                >
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {key === "break1" ? "1st" : key === "break2" ? "2nd" : "3rd"}
                  </p>
                  {isScheduled ? (
                    <>
                      <p className={`text-base font-mono font-bold tabular-nums ${isActive ? "text-primary" : isNext ? "text-primary/80" : "text-foreground"}`}>
                        {formatTime12H(schedule[key])}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {key === "break2" ? "30 min" : "15 min"}
                      </p>
                      {isNext && !isActive && (
                        <div className="mt-1.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-primary/15 text-primary">
                            NEXT
                          </span>
                        </div>
                      )}
                      {isScheduled && !isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1.5 h-6 px-2 text-[10px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                          onClick={(e) => { e.stopPropagation(); openLateBreakDialog(key); }}
                        >
                          <Clock className="h-3 w-3 mr-0.5" />
                          Late
                        </Button>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground/50">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Late Break Dialog */}
      <Dialog open={lateBreakDialog} onOpenChange={setLateBreakDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Log Late Break
            </DialogTitle>
          </DialogHeader>
          {lateBreakKey && (
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-1">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{BREAK_LABELS[lateBreakKey]}</p>
                <p className="text-xs text-muted-foreground">
                  Scheduled at: <span className="font-mono font-medium">{formatTime12H(schedule[lateBreakKey])}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Actual break time</Label>
                <Input
                  type="time"
                  value={lateBreakActualTime}
                  onChange={(e) => setLateBreakActualTime(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLateBreakDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSaveLateBreak}
              disabled={lateBreakSaving || !lateBreakActualTime}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {lateBreakSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
              Log Late Break
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
