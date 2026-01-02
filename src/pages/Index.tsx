import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, Save, Plus, Minus, LogOut, User, ThumbsUp, ThumbsDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard } from "@/components/MetricCard";
import { PercentageDisplay } from "@/components/PercentageDisplay";
import { GoalsSection } from "@/components/GoalsSection";
import { TicketsTable, Ticket } from "@/components/TicketsTable";
import { ChannelAnalytics } from "@/components/ChannelAnalytics";
import { MonthSelector } from "@/components/MonthSelector";
import { WeeklyProgress } from "@/components/WeeklyProgress";
import { DailyChangeLog } from "@/components/DailyChangeLog";
import { MonthComparison } from "@/components/MonthComparison";
import { GenesysTicketForm } from "@/components/GenesysTicketForm";
import { FCRMetric } from "@/components/FCRMetric";
import { DailyTarget } from "@/components/DailyTarget";
import { SmartRatingDialog } from "@/components/SmartRatingDialog";
import { HoldTicketsSection, HoldTicket } from "@/components/HoldTicketsSection";
import { DailyNotesSection, DailyNote } from "@/components/DailyNotesSection";
import { BreakScheduler } from "@/components/BreakScheduler";
import { BestProductiveTime } from "@/components/BestProductiveTime";
import { MonthEndForecast } from "@/components/MonthEndForecast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface WeeklyData {
  week: number;
  csat: number;
  dsat: number;
}

interface GenesysTicket {
  id?: string;
  ticketLink: string;
  ratingScore: number;
  customerPhone: string;
  ticketDate: string;
}

interface MonthlyData {
  good: number;
  bad: number;
  karmaBad: number;
  genesysGood: number;
  genesysBad: number;
  fcr: number;
  tickets: Ticket[];
  goodByChannel: {
    phone: number;
    chat: number;
    email: number;
  };
}

interface TodayStats {
  good: number;
  bad: number;
}

const Index = () => {
  const { user, signOut } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [performanceId, setPerformanceId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ktb_active_tab") || "overview";
    }
    return "overview";
  });
  useEffect(() => {
    localStorage.setItem("ktb_active_tab", activeTab);
  }, [activeTab]);
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "ktb_active_tab" && e.newValue) {
        setActiveTab(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  
  // Smart rating dialog state
  const [smartDialogOpen, setSmartDialogOpen] = useState(false);
  const [smartDialogType, setSmartDialogType] = useState<'good' | 'bad' | null>(null);
  
  // Today's stats for daily target
  const [todayStats, setTodayStats] = useState<TodayStats>({ good: 0, bad: 0 });
  
  const [data, setData] = useState<MonthlyData>({
    good: 0,
    bad: 0,
    karmaBad: 0,
    genesysGood: 0,
    genesysBad: 0,
    fcr: 0,
    tickets: [],
    goodByChannel: { phone: 0, chat: 0, email: 0 },
  });

  const [previousData, setPreviousData] = useState<MonthlyData | null>(null);
  const [previousMonthData, setPreviousMonthData] = useState<MonthlyData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [genesysTickets, setGenesysTickets] = useState<GenesysTicket[]>([]);
  const [offDays, setOffDays] = useState<number[] | null>(null);
  const [monthlyChanges, setMonthlyChanges] = useState<any[]>([]);
  const [shiftStartTime, setShiftStartTime] = useState<string | null>(null);
  const [hasRestored, setHasRestored] = useState(false);

  // Check if today should be counted based on shift time
  const shouldCountToday = useMemo(() => {
    if (!shiftStartTime) return true; // Default: count today
    
    const now = new Date();
    const [hours, minutes] = shiftStartTime.split(':').map(Number);
    
    // Create shift end time (shift start + 9 hours)
    const shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours + 9, minutes);
    
    // If current time is before shift end, count today
    return now <= shiftEnd;
  }, [shiftStartTime]);

  const remainingWorkingDays = useMemo(() => {
    const today = new Date();
    // Only calculate for current month
    if (selectedMonth !== today.getMonth() || selectedYear !== today.getFullYear()) {
      return undefined;
    }

    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const currentDay = today.getDate();
    let working = 0;

    // Start from today or tomorrow based on shift time
    const startDay = shouldCountToday ? currentDay : currentDay + 1;

    for (let d = startDay; d <= lastDay; d++) {
      if (offDays !== null) {
        // User has defined schedule (explicit off days)
        if (!offDays.includes(d)) working++;
      } else {
        // Default: all days are work days except those marked as off
        working++;
      }
    }
    return working;
  }, [offDays, selectedMonth, selectedYear, shouldCountToday]);

  // Load shift time from user_settings
  useEffect(() => {
    const loadShiftTime = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('shift_start_time')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!error && data?.shift_start_time) {
          setShiftStartTime(data.shift_start_time);
        }
      } catch (error) {
        console.error('Error loading shift time:', error);
      }
    };
    loadShiftTime();
  }, [user]);

  // Load data from database when month/year changes or user changes
  useEffect(() => {
    if (user) {
      loadMonthData();
      loadPreviousMonthData();
    }
  }, [selectedMonth, selectedYear, user]);

  const loadMonthData = async () => {
    if (!user) return;
    
    try {
      const { data: perfData, error } = await supabase
        .from('performance_data')
        .select('*, tickets(*)')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (perfData) {
        setPerformanceId(perfData.id);
        setOffDays((perfData as any).off_days);
        const loadedData = {
          good: perfData.good || 0,
          bad: perfData.bad || 0,
          karmaBad: perfData.karma_bad || 0,
          genesysGood: perfData.genesys_good || 0,
          genesysBad: perfData.genesys_bad || 0,
          fcr: typeof (perfData as any).fcr === 'number' ? (perfData as any).fcr : 0,
          goodByChannel: {
            phone: perfData.good_phone || 0,
            chat: perfData.good_chat || 0,
            email: perfData.good_email || 0,
          },
          tickets: (perfData.tickets || []).map((t: any) => ({
            id: t.id,
            ticketId: t.ticket_id,
            type: t.type,
            channel: t.channel,
            note: t.note || "",
          })),
        };
        setData(loadedData);
        setPreviousData(loadedData);
        
        // Calculate weekly data from daily changes
        await calculateWeeklyDataFromChanges(perfData.id);
        
        // Load today's stats from daily changes
        await loadTodayStats(perfData.id);
        await loadMonthlyChanges(perfData.id);
        
        // Load Genesys tickets
        const { data: genesysTicketsFromDB, error: genesysError } = await supabase
          .from('genesys_tickets')
          .select('*')
          .eq('performance_id', perfData.id);
        
        if (!genesysError && genesysTicketsFromDB) {
          setGenesysTickets(genesysTicketsFromDB.map((t: any) => ({
            id: t.id,
            ticketLink: t.ticket_link,
            ratingScore: t.rating_score,
            customerPhone: t.customer_phone || "",
            ticketDate: t.ticket_date,
          })));
        }
      } else {
        // No data for this month, reset to empty
        setPerformanceId(null);
        setOffDays(null);
        const emptyData = {
          good: 0,
          bad: 0,
          karmaBad: 0,
          genesysGood: 0,
          genesysBad: 0,
          fcr: 0,
          tickets: [],
          goodByChannel: { phone: 0, chat: 0, email: 0 },
        };
        setData(emptyData);
        setPreviousData(emptyData);
        setWeeklyData([]);
        setGenesysTickets([]);
        setTodayStats({ good: 0, bad: 0 });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    }
  };

  const loadMonthlyChanges = async (perfId: string) => {
    try {
      const { data: changes, error } = await supabase
        .from('daily_changes')
        .select('*')
        .eq('performance_id', perfId)
        .order('created_at');
      if (error) throw error;
      setMonthlyChanges(changes || []);
    } catch (e) {
      setMonthlyChanges([]);
    }
  };

  const restoreFromDailyChanges = async () => {
    if (!user || !performanceId) return;
    try {
      const { data: changes, error } = await supabase
        .from('daily_changes')
        .select('*')
        .eq('performance_id', performanceId);
      if (error) return;
      const totals = changes.reduce(
        (acc: { good: number; bad: number; karmaBad: number; genesysGood: number; genesysBad: number }, c: any) => {
          const amt = Number(c.change_amount) || 0;
          if (c.field_name === 'good') acc.good += amt;
          else if (c.field_name === 'bad') acc.bad += amt;
          else if (c.field_name === 'karma_bad') acc.karmaBad += amt;
          else if (c.field_name === 'genesys_good') acc.genesysGood += amt;
          else if (c.field_name === 'genesys_bad') acc.genesysBad += amt;
          return acc;
        },
        { good: 0, bad: 0, karmaBad: 0, genesysGood: 0, genesysBad: 0 }
      );
      setData(prev => ({
        ...prev,
        good: totals.good,
        bad: totals.bad,
        karmaBad: totals.karmaBad,
        genesysGood: totals.genesysGood,
        genesysBad: totals.genesysBad,
      }));
      const up = {
        id: performanceId,
        year: selectedYear,
        month: selectedMonth,
        good: totals.good,
        bad: totals.bad,
        karma_bad: totals.karmaBad,
        genesys_good: totals.genesysGood,
        genesys_bad: totals.genesysBad,
        fcr: data.fcr,
        good_phone: data.goodByChannel.phone,
        good_chat: data.goodByChannel.chat,
        good_email: data.goodByChannel.email,
        user_id: user.id,
      } as any;
      await supabase.from('performance_data').upsert(up, { onConflict: 'year,month,user_id' });
      
      // Update previousData to prevent double-counting changes on next save
      setPreviousData(prev => ({
        ...prev!,
        good: totals.good,
        bad: totals.bad,
        karmaBad: totals.karmaBad,
        genesysGood: totals.genesysGood,
        genesysBad: totals.genesysBad,
      }));
      
      setHasRestored(true);
      toast.success('Restored month totals from history');
    } catch {}
  };

  // Reconcile daily changes with performance data to fix any discrepancies
  useEffect(() => {
    const reconcileData = async () => {
      if (!performanceId || !user || !monthlyChanges) return;

      const currentGood = data.good;
      const currentBad = data.bad;
      
      let changesGood = 0;
      let changesBad = 0;
      
      monthlyChanges.forEach((c: any) => {
        const amt = Number(c.change_amount) || 0;
        if (c.field_name === 'good') changesGood += amt;
        else if (c.field_name === 'bad') changesBad += amt;
      });

      // Check for discrepancies in Good ratings
      if (changesGood !== currentGood) {
        const diff = changesGood - currentGood;
        if (diff > 0) {
          // We have extra changes, delete the most recent ones
          console.log(`Found ${diff} extra good ratings in logs. Cleaning up...`);
          const changesToDelete = monthlyChanges
            .filter((c: any) => c.field_name === 'good' && c.change_amount > 0)
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, diff);
            
          if (changesToDelete.length > 0) {
            const idsToDelete = changesToDelete.map((c: any) => c.id);
            await supabase.from('daily_changes').delete().in('id', idsToDelete);
            // Refresh changes
            loadMonthlyChanges(performanceId);
            loadTodayStats(performanceId);
            toast.success('Fixed data discrepancy in Good ratings');
          }
        }
      }

      // Check for discrepancies in Bad ratings
      if (changesBad !== currentBad) {
        const diff = changesBad - currentBad;
        if (diff > 0) {
          // We have extra changes, delete the most recent ones
          console.log(`Found ${diff} extra bad ratings in logs. Cleaning up...`);
          const changesToDelete = monthlyChanges
            .filter((c: any) => c.field_name === 'bad' && c.change_amount > 0)
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, diff);
            
          if (changesToDelete.length > 0) {
            const idsToDelete = changesToDelete.map((c: any) => c.id);
            await supabase.from('daily_changes').delete().in('id', idsToDelete);
            // Refresh changes
            loadMonthlyChanges(performanceId);
            loadTodayStats(performanceId);
            toast.success('Fixed data discrepancy in Bad ratings');
          }
        }
      }
    };

    // Debounce the reconciliation
    const timer = setTimeout(() => {
      reconcileData();
    }, 2000);

    return () => clearTimeout(timer);
  }, [performanceId, monthlyChanges, data.good, data.bad, user]);

  useEffect(() => {
    if (
      performanceId &&
      !hasRestored &&
      monthlyChanges &&
      monthlyChanges.length > 0 &&
      data.good === 0 &&
      data.bad === 0 &&
      data.karmaBad === 0 &&
      data.genesysGood === 0 &&
      data.genesysBad === 0
    ) {
      restoreFromDailyChanges();
    }
  }, [performanceId, monthlyChanges, data, hasRestored]);

  const loadTodayStats = async (perfId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: changes, error } = await supabase
        .from('daily_changes')
        .select('*')
        .eq('performance_id', perfId)
        .eq('change_date', today);

      if (error) throw error;
      
      let todayGood = 0;
      let todayBad = 0;
      
      if (changes) {
        changes.forEach((change: any) => {
          if (change.field_name === 'good' || change.field_name === 'genesys_good') {
            todayGood += change.change_amount;
          } else if (change.field_name === 'bad' || change.field_name === 'genesys_bad' || change.field_name === 'karma_bad') {
            todayBad += change.change_amount;
          }
        });
      }
      
      setTodayStats({ good: Math.max(0, todayGood), bad: Math.max(0, todayBad) });
    } catch (error) {
      console.error('Error loading today stats:', error);
    }
  };

  const loadPreviousMonthData = async () => {
    if (!user) return;
    
    try {
      let prevMonth = selectedMonth - 1;
      let prevYear = selectedYear;
      
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      
      const { data: perfData, error } = await supabase
        .from('performance_data')
        .select('*')
        .eq('year', prevYear)
        .eq('month', prevMonth)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (perfData) {
        setPreviousMonthData({
          good: perfData.good || 0,
          bad: perfData.bad || 0,
          karmaBad: perfData.karma_bad || 0,
          genesysGood: perfData.genesys_good || 0,
          genesysBad: perfData.genesys_bad || 0,
          fcr: typeof (perfData as any).fcr === 'number' ? (perfData as any).fcr : 0,
          goodByChannel: {
            phone: perfData.good_phone || 0,
            chat: perfData.good_chat || 0,
            email: perfData.good_email || 0,
          },
          tickets: [],
        });
      } else {
        setPreviousMonthData(null);
      }
    } catch (error) {
      console.error('Error loading previous month data:', error);
    }
  };

  const calculateWeeklyDataFromChanges = async (performanceId: string) => {
    try {
      // Get all daily changes for this performance period
      const { data: changes, error } = await supabase
        .from('daily_changes')
        .select('*')
        .eq('performance_id', performanceId)
        .order('change_date');

      if (error) throw error;
      if (!changes || changes.length === 0) {
        setWeeklyData([]);
        return;
      }

      // Group changes by week
      const weeklyStats: Record<number, { csat: number; dsat: number }> = {
        1: { csat: 0, dsat: 0 },
        2: { csat: 0, dsat: 0 },
        3: { csat: 0, dsat: 0 },
        4: { csat: 0, dsat: 0 },
      };

      changes.forEach((change: any) => {
        const date = new Date(change.change_date);
        const dayOfMonth = date.getDate();
        
        // Calculate week number based on day ranges
        let weekNumber;
        if (dayOfMonth <= 7) weekNumber = 1;
        else if (dayOfMonth <= 14) weekNumber = 2;
        else if (dayOfMonth <= 21) weekNumber = 3;
        else weekNumber = 4;
        
        if (change.field_name === 'good' || change.field_name === 'genesys_good') {
          weeklyStats[weekNumber].csat += change.change_amount;
        } else if (change.field_name === 'bad' || change.field_name === 'genesys_bad') {
          weeklyStats[weekNumber].dsat += change.change_amount;
        }
      });

      const calculatedWeeklyData = Object.entries(weeklyStats).map(([week, stats]) => ({
        week: parseInt(week),
        csat: stats.csat,
        dsat: stats.dsat,
      }));

      setWeeklyData(calculatedWeeklyData);
    } catch (error) {
      console.error('Error calculating weekly data:', error);
      setWeeklyData([]);
    }
  };

  const saveToDatabase = async () => {
    if (!user) {
      toast.error('You must be logged in first');
      return;
    }
    
    setIsSaving(true);
    try {
      let currentPerformanceId = performanceId;

      // Track daily changes
      const today = new Date().toISOString().split('T')[0];
      const changes: Array<{
        field_name: string;
        old_value: number;
        new_value: number;
        change_amount: number;
      }> = [];

      if (previousData && currentPerformanceId) {
        const fieldsToTrack = [
          { key: 'good', field: 'good' },
          { key: 'bad', field: 'bad' },
          { key: 'karmaBad', field: 'karma_bad' },
          { key: 'genesysGood', field: 'genesys_good' },
          { key: 'genesysBad', field: 'genesys_bad' },
        ];

        fieldsToTrack.forEach(({ key, field }) => {
          const oldVal = previousData[key as keyof MonthlyData] as number;
          const newVal = data[key as keyof MonthlyData] as number;
          if (oldVal !== newVal) {
            changes.push({
              field_name: field,
              old_value: oldVal,
              new_value: newVal,
              change_amount: newVal - oldVal,
            });
          }
        });
      }

      // Upsert performance data
      const upsertData: any = {
        year: selectedYear,
        month: selectedMonth,
        good: data.good,
        bad: data.bad,
        karma_bad: data.karmaBad,
        genesys_good: data.genesysGood,
        genesys_bad: data.genesysBad,
        fcr: data.fcr,
        good_phone: data.goodByChannel.phone,
        good_chat: data.goodByChannel.chat,
        good_email: data.goodByChannel.email,
        user_id: user.id,
      };

      // Only include id if we're updating existing record
      if (performanceId) {
        upsertData.id = performanceId;
      }

      const { data: perfData, error: perfError } = await supabase
        .from('performance_data')
        .upsert(upsertData, {
          onConflict: 'year,month,user_id',
        })
        .select()
        .single();

      if (perfError) throw perfError;

      currentPerformanceId = perfData.id;
      setPerformanceId(currentPerformanceId);

      // Insert daily changes with time
      if (changes.length > 0) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        const changesToInsert = changes.map(change => ({
          performance_id: currentPerformanceId,
          change_date: today,
          change_time: currentTime,
          user_id: user.id,
          ...change,
        }));

        const { error: changesError } = await supabase
          .from('daily_changes')
          .insert(changesToInsert);

        if (changesError) {
          console.error('Error saving daily changes:', changesError);
        }
      }

      // Delete existing tickets for this performance record
      const { error: deleteError } = await supabase
        .from('tickets')
        .delete()
        .eq('performance_id', currentPerformanceId);

      if (deleteError) throw deleteError;

      // Insert new tickets
      if (data.tickets.length > 0) {
        const ticketsToInsert = data.tickets.map(ticket => ({
          performance_id: currentPerformanceId,
          ticket_id: ticket.ticketId,
          type: ticket.type,
          channel: ticket.channel,
          note: ticket.note,
          user_id: user.id,
        }));

        const { error: ticketsError } = await supabase
          .from('tickets')
          .insert(ticketsToInsert);

        if (ticketsError) throw ticketsError;
      }

      // Save Genesys tickets
      await supabase
        .from('genesys_tickets')
        .delete()
        .eq('performance_id', currentPerformanceId);

      if (genesysTickets.length > 0) {
        const genesysTicketsToInsert = genesysTickets.map(ticket => ({
          performance_id: currentPerformanceId,
          ticket_link: ticket.ticketLink,
          rating_score: ticket.ratingScore,
          customer_phone: ticket.customerPhone,
          ticket_date: ticket.ticketDate,
          user_id: user.id,
        }));

        const { error: genesysError } = await supabase
          .from('genesys_tickets')
          .insert(genesysTicketsToInsert);

        if (genesysError) throw genesysError;
      }

      // Update previous data snapshot
      setPreviousData({ ...data });

      toast.success('Data saved successfully!');
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error('Failed to save data');
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save preferences
  const autosaveMode = (user?.user_metadata as Record<string, unknown> | undefined)?.autosaveMode as
    | "manual"
    | "immediate"
    | "hourly"
    | undefined;
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    // Mark initialized once initial data load completes
    if (previousData) {
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousData]);

  // Auto-save hourly
  useEffect(() => {
    if (autosaveMode !== "hourly" || !initialized) return;
    const interval = setInterval(() => {
      if (!isSaving) {
        saveToDatabase();
      }
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveMode, initialized]);

  // Auto-save after changes (debounced)
  useEffect(() => {
    if (autosaveMode !== "immediate" || !initialized) return;
    const timeout = setTimeout(() => {
      if (!isSaving) {
        saveToDatabase();
      }
    }, 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveMode, initialized, data, genesysTickets]);

  const updateMetric = useCallback((field: keyof Pick<MonthlyData, "good" | "bad" | "karmaBad">, increment: boolean) => {
    setData((prev) => {
      const updatedValue = Math.max(0, prev[field] + (increment ? 1 : -1));
      let updatedTickets = prev.tickets;
      if (field === "bad") {
        if (increment) {
          const newTicket: Ticket = {
            id: crypto.randomUUID(),
            ticketId: "",
            type: "DSAT",
            channel: "Phone",
            note: "",
          };
          updatedTickets = [...prev.tickets, newTicket];
        } else {
          const idx = prev.tickets.findIndex(t => t.type === "DSAT");
          if (idx !== -1) {
            updatedTickets = [...prev.tickets.slice(0, idx), ...prev.tickets.slice(idx + 1)];
          }
        }
      }
      return {
        ...prev,
        [field]: updatedValue,
        tickets: updatedTickets,
      };
    });
    setTimeout(() => {
      if (!isSaving) {
        saveToDatabase();
      }
    }, 0);
  }, []);

  const updateGoodRatings = useCallback((channel: keyof MonthlyData["goodByChannel"], value: number) => {
    setData((prev) => ({
      ...prev,
      goodByChannel: { ...prev.goodByChannel, [channel]: Math.max(0, value) },
    }));
  }, []);

  const totalGood = useMemo(() => data.good + data.genesysGood, [data.good, data.genesysGood]);
  const totalBad = useMemo(() => data.bad + data.genesysBad, [data.bad, data.genesysBad]);

  // Smart rating handlers
  const openSmartDialog = useCallback((type: 'good' | 'bad') => {
    setSmartDialogType(type);
    setSmartDialogOpen(true);
  }, []);

  const handleSmartGoodRating = useCallback((
    channel: 'phone' | 'chat' | 'email', 
    isGenesys: boolean, 
    genesysData?: { ticketLink: string; ratingScore: number; customerPhone: string }
  ) => {
    if (isGenesys && genesysData) {
      // Add Genesys ticket
      const isGoodRating = genesysData.ratingScore >= 7 && genesysData.ratingScore <= 9;
      
      setGenesysTickets(prev => [...prev, {
        ticketLink: genesysData.ticketLink,
        ratingScore: genesysData.ratingScore,
        customerPhone: genesysData.customerPhone,
        ticketDate: new Date().toISOString().split('T')[0],
      }]);
      if (isGoodRating) {
        setTodayStats(prev => ({ ...prev, good: prev.good + 1 }));
        toast.success('Genesys good rating added! 📞');
      } else {
        setTodayStats(prev => ({ ...prev, bad: prev.bad + 1 }));
        toast.error('Genesys bad rating added');
      }
      setTimeout(() => {
        if (!isSaving) {
          saveToDatabase();
        }
      }, 0);
    } else {
      // Add regular good rating to channel
      setData(prev => ({
        ...prev,
        good: prev.good + 1,
        goodByChannel: {
          ...prev.goodByChannel,
          [channel]: prev.goodByChannel[channel] + 1,
        },
      }));
      setTodayStats(prev => ({ ...prev, good: prev.good + 1 }));
      toast.success(`Good rating added to ${channel.charAt(0).toUpperCase() + channel.slice(1)}! ✨`);
      setTimeout(() => {
        if (!isSaving) {
          saveToDatabase();
        }
      }, 0);
    }
  }, []);

  const handleSmartBadRating = useCallback((ticket: {
    ticketId: string;
    type: 'DSAT' | 'Karma';
    channel: 'Phone' | 'Chat' | 'Email';
    note: string;
  }) => {
    // Add ticket
    setData(prev => ({
      ...prev,
      tickets: [...prev.tickets, {
        id: crypto.randomUUID(),
        ticketId: ticket.ticketId,
        type: ticket.type,
        channel: ticket.channel,
        note: ticket.note,
      }],
      bad: ticket.type === 'DSAT' ? prev.bad + 1 : prev.bad,
      karmaBad: ticket.type === 'Karma' ? prev.karmaBad + 1 : prev.karmaBad,
    }));
    
    setTodayStats(prev => ({ ...prev, bad: prev.bad + 1 }));
    toast.error(`${ticket.type} ticket added - target affected ⚠️`);
    setTimeout(() => {
      if (!isSaving) {
        saveToDatabase();
      }
    }, 0);
  }, []);

  useEffect(() => {
    // Sync genesysGood/genesysBad from genesysTickets to keep metrics consistent
    const counts = genesysTickets.reduce(
      (acc, t) => {
        const isGood = t.ratingScore >= 7 && t.ratingScore <= 9;
        if (isGood) acc.good += 1;
        else acc.bad += 1;
        return acc;
      },
      { good: 0, bad: 0 }
    );
    setData(prev => ({ ...prev, genesysGood: counts.good, genesysBad: counts.bad }));
  }, [genesysTickets]);

  useEffect(() => {
    // Support both custom events and localStorage flag for cross-route trigger
    const customHandler = (e: Event) => {
      const ce = e as CustomEvent;
      const val = ce.detail as 'good' | 'bad';
      if (val === 'good' || val === 'bad') {
        openSmartDialog(val);
      }
    };
    window.addEventListener("ktb_quick_rating", customHandler as EventListener);
    try {
      const key = localStorage.getItem("ktb_quick_rating");
      if (key === "good" || key === "bad") {
        openSmartDialog(key as 'good' | 'bad');
        localStorage.removeItem("ktb_quick_rating");
      }
    } catch {}
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "ktb_quick_rating" && e.newValue) {
        const val = e.newValue;
        if (val === "good" || val === "bad") {
          openSmartDialog(val as 'good' | 'bad');
          try { localStorage.removeItem("ktb_quick_rating"); } catch {}
        }
      }
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("ktb_quick_rating", customHandler as EventListener);
      window.removeEventListener("storage", storageHandler);
    };
  }, [openSmartDialog]);
  // Calculate daily target impact
  const dailyTargetImpact = useMemo(() => {
    const today = new Date();
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const remainingDays = lastDay - today.getDate();
    const weekendDays = Math.ceil(remainingDays / 7) * 2;
    const workDays = Math.max(1, remainingDays - weekendDays);
    
    const totalKarma = totalGood + totalBad + data.karmaBad;
    const neededFor95 = Math.max(0, Math.ceil((0.95 * totalKarma - totalGood) / 0.05));
    const currentTarget = Math.ceil(neededFor95 / workDays);
    
    const newTotalKarma = totalKarma + 1;
    const newNeeded = Math.max(0, Math.ceil((0.95 * newTotalKarma - totalGood) / 0.05));
    const newTarget = Math.ceil(newNeeded / workDays);
    
    return {
      newTarget,
      compensation: newTarget - currentTarget,
    };
  }, [selectedMonth, selectedYear, totalGood, totalBad, data.karmaBad]);

  const totalSurveys = useMemo(() => totalGood + totalBad, [totalGood, totalBad]);
  const csat = useMemo(() => totalSurveys > 0 ? (totalGood / totalSurveys) * 100 : 0, [totalGood, totalSurveys]);
  
  const totalKarmaBase = useMemo(() => totalGood + totalBad + data.karmaBad, [totalGood, totalBad, data.karmaBad]);
  const karma = useMemo(() => totalKarmaBase > 0 ? (totalGood / totalKarmaBase) * 100 : 0, [totalGood, totalKarmaBase]);

  const badByChannel = useMemo(() => data.tickets.reduce(
    (acc, ticket) => {
      if (ticket.type === "DSAT") {
        acc[ticket.channel.toLowerCase() as keyof typeof acc]++;
      }
      return acc;
    },
    { phone: data.genesysBad, chat: 0, email: 0 }
  ), [data.tickets, data.genesysBad]);

  const karmaByChannel = useMemo(() => data.tickets.reduce(
    (acc, ticket) => {
      if (ticket.type === "Karma") {
        acc[ticket.channel.toLowerCase() as keyof typeof acc]++;
      }
      return acc;
    },
    { phone: 0, chat: 0, email: 0 }
  ), [data.tickets]);

  const goodByChannelWithGenesys = useMemo(() => ({
    phone: data.goodByChannel.phone + data.genesysGood,
    chat: data.goodByChannel.chat,
    email: data.goodByChannel.email,
  }), [data.goodByChannel, data.genesysGood]);
  
  const insights = useMemo(() => {
    if (!monthlyChanges || monthlyChanges.length === 0) {
      return { bestHour: null, forecastKarma: null };
    }
    const byHour: Record<string, number> = {};
    const dayAgg: Record<string, { good: number; bad: number }> = {};
    monthlyChanges.forEach((c: any) => {
      const isGood = c.field_name === 'good' || c.field_name === 'genesys_good';
      const isBad = c.field_name === 'bad' || c.field_name === 'genesys_bad' || c.field_name === 'karma_bad';
      const dt = c.created_at ? new Date(c.created_at) : new Date(c.change_date);
      const hourKey = dt.toLocaleTimeString([], { hour: '2-digit' });
      const dayKey = dt.toISOString().split('T')[0];
      if (isGood) {
        byHour[hourKey] = (byHour[hourKey] || 0) + Math.max(0, c.change_amount);
      }
      if (!dayAgg[dayKey]) dayAgg[dayKey] = { good: 0, bad: 0 };
      if (isGood) dayAgg[dayKey].good += Math.max(0, c.change_amount);
      if (isBad) dayAgg[dayKey].bad += Math.max(0, c.change_amount);
    });
    let bestHour: { hour: string; count: number } | null = null;
    Object.entries(byHour).forEach(([h, count]) => {
      if (!bestHour || count > bestHour.count) bestHour = { hour: h, count };
    });
    const days = Object.values(dayAgg);
    const avgGood = days.length ? days.reduce((s, d) => s + d.good, 0) / days.length : 0;
    const avgBad = days.length ? days.reduce((s, d) => s + d.bad, 0) / days.length : 0;
    const remaining = remainingWorkingDays ?? 0;
    const projectedGood = totalGood + Math.round(avgGood * remaining);
    const projectedBad = totalBad + Math.round(avgBad * remaining);
    const base = projectedGood + projectedBad + data.karmaBad;
    const forecastKarma = base > 0 ? (projectedGood / base) * 100 : null;
    return { bestHour, forecastKarma };
  }, [monthlyChanges, remainingWorkingDays, totalGood, totalBad, data.karmaBad]);

  const exportToCSV = () => {
    const monthName = new Date(selectedYear, selectedMonth).toLocaleString("en-US", { month: "long" });
    const csv = [
      ["Metric", "Value"],
      ["Month", `${monthName} ${selectedYear}`],
      ["Good Ratings", data.good],
      ["Genesys Good", data.genesysGood],
      ["Total Good (All)", totalGood],
      ["Bad Ratings (DSAT)", data.bad],
      ["Genesys Bad (DSAT)", data.genesysBad],
      ["Total Bad (All)", totalBad],
      ["Karma Bad", data.karmaBad],
      ["CSAT %", csat.toFixed(2)],
      ["Karma %", karma.toFixed(2)],
      [""],
      ["Channel", "Good", "DSAT", "Karma", "Success Rate %"],
      ["Phone", goodByChannelWithGenesys.phone, badByChannel.phone, karmaByChannel.phone,
        ((goodByChannelWithGenesys.phone / (goodByChannelWithGenesys.phone + badByChannel.phone || 1)) * 100).toFixed(1)],
      ["Chat", data.goodByChannel.chat, badByChannel.chat, karmaByChannel.chat,
        ((data.goodByChannel.chat / (data.goodByChannel.chat + badByChannel.chat || 1)) * 100).toFixed(1)],
      ["Email", data.goodByChannel.email, badByChannel.email, karmaByChannel.email,
        ((data.goodByChannel.email / (data.goodByChannel.email + badByChannel.email || 1)) * 100).toFixed(1)],
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-${monthName}-${selectedYear}.csv`;
    a.click();
    toast.success("CSV exported successfully!");
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-primary opacity-[0.08] rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-success opacity-[0.06] rounded-full blur-[100px]"></div>
      </div>

      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40 shadow-sm animate-slide-up">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-2 animate-fade-in">
                Big Brother
              </h1>
              <p className="text-base text-muted-foreground">The big brother who will care for you at work and help you</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={saveToDatabase} 
                disabled={isSaving}
                size="lg"
              >
                <Save className="mr-2 h-5 w-5" /> 
                {isSaving ? 'Saving...' : 'Save All'}
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="lg">
                <Download className="mr-2 h-5 w-5" /> Export CSV
              </Button>
              <Button onClick={signOut} variant="ghost" size="lg">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Goals - Sticky Headers */}
      <div className="sticky top-[136px] z-30 space-y-0">
        <GoalsSection
          currentValue={totalGood}
          totalNegatives={totalBad}
          metricName="CSAT"
          targets={[88, 90, 95]}
        />
        <GoalsSection
          currentValue={totalGood}
          totalNegatives={totalBad + data.karmaBad}
          metricName="Karma"
          targets={[88, 90, 95]}
        />
      </div>

      <main className="container mx-auto px-6 py-10 mt-6 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="space-y-4">
            <div className="w-full">
              <TabsList className="w-full flex flex-wrap items-center justify-start gap-3 p-3 h-auto">
                <TabsTrigger value="overview" className="flex-none min-w-[160px] px-4 py-2 text-sm md:text-base">Overview 📊</TabsTrigger>
                <TabsTrigger value="tickets" className="flex-none min-w-[160px] px-4 py-2 text-sm md:text-base">Tickets 🎫</TabsTrigger>
                <TabsTrigger value="analytics" className="flex-none min-w-[160px] px-4 py-2 text-sm md:text-base">Analytics 📈</TabsTrigger>
                <TabsTrigger value="notes" className="flex-none min-w-[200px] px-4 py-2 text-sm md:text-base">Notes & Schedule 📝</TabsTrigger>
                <TabsTrigger value="log" className="flex-none min-w-[160px] px-4 py-2 text-sm md:text-base">Log 📋</TabsTrigger>
              </TabsList>
            </div>
            <div className="w-full flex justify-end">
              <MonthSelector
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onMonthChange={setSelectedMonth}
                onYearChange={setSelectedYear}
              />
            </div>
          </div>

          <TabsContent value="overview" className="space-y-8 animate-fade-in focus-visible:outline-none">
            {/* Main Performance Cards - CSAT & Karma */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-scale-in">
              <PercentageDisplay
                title="Customer Satisfaction (CSAT)"
                percentage={csat}
                subtitle={`${totalGood} good out of ${totalSurveys} total surveys`}
              />
              <PercentageDisplay
                title="Karma Score"
                percentage={karma}
                subtitle={`${totalGood} good out of ${totalKarmaBase} total interactions`}
              />
            </div>

            {/* Daily Target */}
            <div className="animate-fade-in">
              <DailyTarget
                currentGood={totalGood}
                totalNegatives={totalBad}
                karmaBad={data.karmaBad}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                todayGood={todayStats.good}
                todayBad={todayStats.bad}
                remainingWorkingDays={remainingWorkingDays}
              />
            </div>

            {/* Smart Rating Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => openSmartDialog('good')} 
                size="lg" 
                className="h-16 text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <Plus className="mr-2 h-6 w-6" /> Add Good Rating
              </Button>
              <Button 
                onClick={() => openSmartDialog('bad')} 
                size="lg" 
                variant="destructive"
                className="h-16 text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <Minus className="mr-2 h-6 w-6" /> Add Bad Rating
              </Button>
            </div>

            {/* Metrics Cards */}
            <div>
              <h2 className="text-2xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">📊 Rating Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                  title="Good Ratings"
                  value={totalGood}
                  onIncrement={() => updateMetric("good", true)}
                  onDecrement={() => updateMetric("good", false)}
                  color="primary"
                  icon={ThumbsUp}
                />
                <MetricCard
                  title="Bad Ratings (DSAT)"
                  value={totalBad}
                  onIncrement={() => updateMetric("bad", true)}
                  onDecrement={() => updateMetric("bad", false)}
                  color="destructive"
                  icon={ThumbsDown}
                />
                <MetricCard
                  title="Karma Bad"
                  value={data.karmaBad}
                  onIncrement={() => updateMetric("karmaBad", true)}
                  onDecrement={() => updateMetric("karmaBad", false)}
                  color="warning"
                  icon={AlertTriangle}
                />
              </div>
            </div>
            
             {/* FCR Metric */}
            <div className="animate-fade-in">
              <FCRMetric
                value={data.fcr}
                onChange={(value) => setData((prev) => ({ ...prev, fcr: value }))}
                previousValue={previousMonthData?.fcr}
              />
            </div>
          </TabsContent>

          <TabsContent value="tickets" className="space-y-6 animate-fade-in focus-visible:outline-none">
             {/* Genesys & Tickets Section */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">🎫 Tickets Management</h2>
              
              {/* Genesys Tickets Form */}
              <GenesysTicketForm
                tickets={genesysTickets}
                onTicketsChange={setGenesysTickets}
              />

              {/* Tickets Table */}
              <TicketsTable
                tickets={data.tickets}
                onTicketsChange={(tickets) => setData((prev) => ({ ...prev, tickets }))}
              />
            </div>
             
             {/* Show Hold Tickets here too if needed, but keeping in Overview for priority */}
             <div className="mt-8">
               <h3 className="text-xl font-semibold mb-4">Hold Tickets Management</h3>
               <HoldTicketsSection
                  performanceId={performanceId}
                />
             </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 animate-fade-in focus-visible:outline-none">
            {/* Analytics Section */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">📈 Analytics & Progress</h2>
              
              {/* Month Comparison */}
              <div className="animate-fade-in">
                <MonthComparison
                  currentMonth={{
                    good: data.good,
                    bad: data.bad,
                    genesysGood: data.genesysGood,
                    genesysBad: data.genesysBad,
                    karmaBad: data.karmaBad,
                    fcr: data.fcr,
                  }}
                  previousMonth={previousMonthData}
                  currentMonthName={new Date(selectedYear, selectedMonth).toLocaleString("en-US", { month: "long" })}
                  previousMonthName={new Date(selectedYear, selectedMonth - 1).toLocaleString("en-US", { month: "long" })}
                />
              </div>

              {/* Weekly Progress */}
              <WeeklyProgress
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                weeklyData={weeklyData}
                currentKarma={karma}
              />
              
              {/* Best Productive Time */}
              <BestProductiveTime changes={monthlyChanges} />

              {/* Month-end Forecast */}
              <MonthEndForecast
                currentGood={totalGood}
                currentBad={totalBad}
                karmaBad={data.karmaBad}
                remainingWorkDays={remainingWorkingDays}
                previousMonthData={previousMonthData}
                dailyChanges={monthlyChanges}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />

              {/* Daily Change Log - Moved to separate tab */}
              {/* <DailyChangeLog performanceId={performanceId} /> */}

              {/* Channel Analytics */}
                <ChannelAnalytics
                  goodRatings={goodByChannelWithGenesys}
                  badRatings={badByChannel}
                  karmaRatings={karmaByChannel}
                  totalGood={totalGood}
                />
            </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-6 animate-fade-in focus-visible:outline-none">
              <DailyNotesSection performanceId={performanceId} />
              <div className="space-y-4">
                <h3 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">Break Time ⏱️</h3>
                <BreakScheduler />
              </div>
          </TabsContent>

          <TabsContent value="log" className="space-y-6 animate-fade-in focus-visible:outline-none">
             {/* Daily Change Log */}
             <div className="space-y-6">
               <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">📋 Site Log History</h2>
               <DailyChangeLog performanceId={performanceId} />
             </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border bg-card mt-16 animate-fade-in">
        <div className="container mx-auto px-6 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Big Brother • The big brother who will care for you at work and help you
          </p>
          <p className="text-xs text-muted-foreground mt-2">Made with Ahmed Khaled's magic</p>
        </div>
      </footer>
      {/* Smart Rating Dialog */}
      <SmartRatingDialog
        isOpen={smartDialogOpen}
        onClose={() => setSmartDialogOpen(false)}
        ratingType={smartDialogType}
        onAddGoodRating={handleSmartGoodRating}
        onAddBadRating={handleSmartBadRating}
        dailyTargetImpact={dailyTargetImpact}
      />
    </div>
  );
};

export default Index;
