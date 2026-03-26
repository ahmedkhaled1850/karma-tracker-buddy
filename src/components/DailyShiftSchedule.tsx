import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Save, Loader2, Trash2, Copy, Building, Clock, ArrowRight, Sparkles } from "lucide-react";
import { formatTime12H } from "@/lib/timeUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStaticShift } from "@/lib/staticSchedule";
import { DailyShift } from "@/lib/types";
import { TimeInput24 } from "@/components/TimeInput24";


interface DailyShiftScheduleProps {
  selectedMonth: number;
  selectedYear: number;
  performanceId?: string | null;
  onShiftChanged?: () => void;
}

export const DailyShiftSchedule = ({ selectedMonth, selectedYear, performanceId, onShiftChanged }: DailyShiftScheduleProps) => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<DailyShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingShift, setEditingShift] = useState<DailyShift | null>(null);
  const [selectedRepeatDays, setSelectedRepeatDays] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPastShifts, setShowPastShifts] = useState(false);

  const daysInMonth = useMemo(() => {
    const days: string[] = [];
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      days.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    }
    return days;
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    const loadShifts = async () => {
      if (!user?.id) return;
      setIsLoading(true);
      try {
        const startDate = daysInMonth[0];
        const endDate = daysInMonth[daysInMonth.length - 1];

        const { data, error } = await supabase
          .from('daily_shifts')
          .select('*')
          .eq('user_id', user.id)
          .gte('shift_date', startDate)
          .lte('shift_date', endDate)
          .order('shift_date', { ascending: true });

        if (error) throw error;

        const shiftsMap = new Map((data || []).map(s => [s.shift_date, s]));

        const allShifts: DailyShift[] = daysInMonth.map(date => {
          const existing = shiftsMap.get(date);
          if (existing) return existing as DailyShift;
          
          const staticShift = getStaticShift(date);
          if (staticShift) {
            return {
              user_id: user.id, shift_date: date,
              shift_start: staticShift.shift_start || null, shift_end: staticShift.shift_end || null,
              break1_time: staticShift.break1_time || null, break1_duration: staticShift.break1_duration || 15,
              break2_time: staticShift.break2_time || null, break2_duration: staticShift.break2_duration || 30,
              break3_time: staticShift.break3_time || null, break3_duration: staticShift.break3_duration || 15,
              notes: staticShift.notes || null, is_off_day: staticShift.is_off_day, is_site_day: false,
            };
          }

          return {
            user_id: user.id, shift_date: date,
            shift_start: null, shift_end: null,
            break1_time: null, break1_duration: 15,
            break2_time: null, break2_duration: 30,
            break3_time: null, break3_duration: 15,
            notes: null, is_off_day: false, is_site_day: false,
          };
        });

        setShifts(allShifts);
      } catch (error) {
        console.error('Error loading shifts:', error);
        toast.error("Failed to load shift data");
      } finally {
        setIsLoading(false);
      }
    };
    loadShifts();
  }, [user?.id, selectedMonth, selectedYear, daysInMonth]);

  // Sync off_days to performance_data whenever shifts change
  const syncOffDays = useCallback(async (currentShifts: DailyShift[]) => {
    if (!user?.id) return;
    
    const offDayNumbers = currentShifts
      .filter(s => s.is_off_day)
      .map(s => parseInt(s.shift_date.split('-')[2], 10));

    let perfId = performanceId;
    
    // Find or create performance_data record
    if (!perfId) {
      try {
        const { data: existing } = await supabase
          .from('performance_data')
          .select('id')
          .eq('year', selectedYear)
          .eq('month', selectedMonth)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          perfId = existing.id;
        } else {
          const { data: inserted, error } = await supabase
            .from('performance_data')
            .insert({
              year: selectedYear,
              month: selectedMonth,
              user_id: user.id,
              good: 0, bad: 0, karma_bad: 0,
              genesys_good: 0, genesys_bad: 0,
              good_phone: 0, good_chat: 0, good_email: 0,
            })
            .select('id')
            .single();
          if (error) throw error;
          perfId = inserted?.id;
        }
      } catch (err) {
        console.error('Error syncing off days:', err);
        return;
      }
    }

    if (perfId) {
      await supabase
        .from('performance_data')
        .update({ off_days: offDayNumbers } as any)
        .eq('id', perfId);
    }
  }, [user?.id, performanceId, selectedMonth, selectedYear]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const { pastShifts, todayShift, tomorrowShift, upcomingShifts } = useMemo(() => {
    const past = shifts.filter(s => s.shift_date < todayStr);
    const today = shifts.find(s => s.shift_date === todayStr);
    const tomorrow = shifts.find(s => s.shift_date === tomorrowStr);
    const upcoming = shifts.filter(s => s.shift_date > (tomorrow ? tomorrowStr : todayStr));
    
    return { pastShifts: past, todayShift: today, tomorrowShift: tomorrow, upcomingShifts: upcoming };
  }, [shifts, todayStr, tomorrowStr]);

  const handleEditShift = (shift: DailyShift) => {
    setEditingShift({ ...shift });
    setSelectedRepeatDays([]);
    setIsDialogOpen(true);
  };

  const ShiftCard = ({ shift, isPast = false }: { shift: DailyShift, isPast?: boolean }) => {
    const completed = checkCompleted(shift);
    const dayNum = getDayNumber(shift.shift_date);
    const dayName = getDayName(shift.shift_date);

    return (
      <Card
        key={shift.shift_date}
        className={`group relative overflow-hidden cursor-pointer transition-all border-none bg-card hover:bg-accent/40 ${
          completed || isPast ? 'opacity-40 grayscale-[0.5]' : 'shadow-sm hover:shadow-md'
        } ${
          shift.is_off_day ? 'bg-destructive/[0.02]' : ''
        }`}
        onClick={() => handleEditShift(shift)}
      >
        {!shift.is_off_day && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors" />
        )}
        {shift.is_off_day && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive/20 group-hover:bg-destructive/60 transition-colors" />
        )}

        <div className="flex items-center p-4 gap-4">
          <div className={`w-12 h-12 shrink-0 rounded-2xl flex flex-col items-center justify-center font-black transition-colors ${
            shift.is_off_day ? 'bg-destructive/5 text-destructive/60' :
            completed ? 'bg-success/5 text-success/60' : 'bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary transition-all duration-300'
          }`}>
            <span className="text-lg leading-none">{dayNum}</span>
            <span className="text-[9px] uppercase tracking-tighter opacity-60">{dayName}</span>
          </div>

          <div className="flex-1 min-w-0">
            {shift.is_off_day ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tighter text-muted-foreground/60 uppercase">Day Off</span>
                {shift.absence_type !== 'none' && (
                  <Badge variant="outline" className="text-[7px] h-3.5 py-0 uppercase opacity-50 border-destructive/20">
                    {shift.absence_type?.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm font-mono font-black">
                    <span className="text-foreground/80">{formatTime12H(shift.shift_start)}</span>
                    <span className="text-muted-foreground/20 text-[9px] font-black">→</span>
                    <span className="text-foreground/80">{formatTime12H(shift.shift_end)}</span>
                  </div>
                  {shift.is_site_day && (
                    <div className="flex items-center text-[9px] font-black text-indigo-500/80 uppercase">
                      <Building className="h-2.5 w-2.5 mr-1" /> SITE
                    </div>
                  )}
                </div>
                {shift.notes && <p className="text-[10px] text-muted-foreground/60 line-clamp-1">{shift.notes}</p>}
              </div>
            )}
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            {shift.id && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/30 hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const handleSaveShift = async () => {
    if (!editingShift || !user?.id) return;

    if (!editingShift.is_off_day && (!editingShift.shift_start || !editingShift.shift_end)) {
      toast.error("Please set both Shift Start and Shift End");
      return;
    }

    setIsSaving(true);
    try {
      const toNull = (v: string | null | undefined) => (v && v.trim() !== '' ? v : null);
      const shiftData = {
        user_id: user.id,
        shift_date: editingShift.shift_date,
        shift_start: editingShift.is_off_day ? null : toNull(editingShift.shift_start),
        shift_end: editingShift.is_off_day ? null : toNull(editingShift.shift_end),
        break1_time: editingShift.is_off_day ? null : toNull(editingShift.break1_time),
        break1_duration: editingShift.break1_duration || 15,
        break2_time: editingShift.is_off_day ? null : toNull(editingShift.break2_time),
        break2_duration: editingShift.break2_duration || 30,
        break3_time: editingShift.is_off_day ? null : toNull(editingShift.break3_time),
        break3_duration: editingShift.break3_duration || 15,
        notes: toNull(editingShift.notes),
        is_off_day: editingShift.is_off_day,
        is_site_day: editingShift.is_off_day ? false : (editingShift.is_site_day || false),
        absence_type: editingShift.is_off_day ? (editingShift.absence_type || 'scheduled_off') : null,
      };

      const datesToProcess = [editingShift.shift_date, ...selectedRepeatDays];
      
      const results = await Promise.all(datesToProcess.map(async (dateStr) => {
        const existing = shifts.find(s => s.shift_date === dateStr);
        const currentData = { ...shiftData, shift_date: dateStr };
        if (existing?.id) {
          const { data, error } = await supabase.from('daily_shifts').update(currentData).eq('id', existing.id).select('*').single();
          if (error) throw error;
          return data as DailyShift;
        } else {
          const { data, error } = await supabase.from('daily_shifts').insert(currentData).select('*').single();
          if (error) throw error;
          return data as DailyShift;
        }
      }));

      const resultsMap = new Map(results.map(r => [r.shift_date, r]));
      const updatedShifts = shifts.map(s => resultsMap.get(s.shift_date) || s);

      setShifts(updatedShifts);
      await syncOffDays(updatedShifts);

      toast.success(datesToProcess.length > 1 ? `Saved shifts for ${datesToProcess.length} days` : "Shift saved");
      setIsDialogOpen(false);
      onShiftChanged?.();
    } catch (error) {
      console.error('Error saving shift:', error);
      toast.error("Failed to save shift");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShift = async (shift: DailyShift) => {
    if (!shift.id) return;
    try {
      const { error } = await supabase.from('daily_shifts').delete().eq('id', shift.id);
      if (error) throw error;
      const updatedShifts = shifts.map(s => 
        s.shift_date === shift.shift_date ? {
          ...s, id: undefined, shift_start: null, shift_end: null,
          break1_time: null, break2_time: null, break3_time: null,
          notes: null, is_off_day: false, absence_type: undefined,
        } : s
      );
      setShifts(updatedShifts);
      await syncOffDays(updatedShifts);
      toast.success("Shift data cleared");
      onShiftChanged?.();
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error("Failed to delete shift");
    }
  };

  const getDayName = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
  const getDayNumber = (dateStr: string) => parseInt(dateStr.split('-')[2], 10);
  const checkCompleted = (shift: DailyShift) => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (shift.shift_date < todayStr) return true;
    if (shift.shift_date > todayStr) return false;
    if (shift.is_off_day) return false;

    const [endH, endM] = (shift.shift_end || "00:00").split(":").map(Number);
    const endTime = new Date();
    endTime.setHours(endH, endM, 0, 0);
    return now > endTime;
  };

  const stats = useMemo(() => {
    const workDays = shifts.filter(s => !s.is_off_day && s.shift_start).length;
    const offDays = shifts.filter(s => s.is_off_day).length;
    const completed = shifts.filter(s => checkCompleted(s) && !s.is_off_day).length;
    return { workDays, offDays, completed };
  }, [shifts, todayStr]);

  const handleCopySchedule = async () => {
    try {
      const lines = shifts.map(shift => {
        const dateDesc = `${getDayNumber(shift.shift_date)} ${getDayName(shift.shift_date)}`;
        if (shift.is_off_day) {
          const type = 
            shift.absence_type === 'sick_leave' ? 'Sick Leave' : 
            shift.absence_type === 'unexcused' ? 'Unexcused' : 'Day Off';
          return `${dateDesc}: ${type}${shift.notes ? ` - ${shift.notes}` : ''}`;
        }
        if (!shift.shift_start || !shift.shift_end) return `${dateDesc}: Not Set`;
        
        let breaks = [];
        if (shift.break1_time) breaks.push(formatTime12H(shift.break1_time));
        if (shift.break2_time) breaks.push(formatTime12H(shift.break2_time));
        if (shift.break3_time) breaks.push(formatTime12H(shift.break3_time));
        
        const breaksStr = breaks.length > 0 ? ` (Breaks: ${breaks.join(', ')})` : '';
        const notesStr = shift.notes ? ` - ${shift.notes}` : '';
        
        return `${dateDesc}: ${formatTime12H(shift.shift_start)} to ${formatTime12H(shift.shift_end)}${breaksStr}${notesStr}`;
      });
      
      const monthName = new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const textBlock = `Schedule for ${monthName}:\n\n` + lines.join('\n');
      
      await navigator.clipboard.writeText(textBlock);
      toast.success("Schedule copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy schedule");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Today's Focus Hero Card */}
      {todayShift && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground ml-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="uppercase tracking-widest text-[10px] font-bold">Today's Duty</span>
          </div>
          <Card 
            className="relative overflow-hidden border-none shadow-2xl cursor-pointer group transition-all active:scale-[0.98]"
            onClick={() => handleEditShift(todayShift)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-primary to-primary-focus group-hover:opacity-95 transition-opacity" />
            
            <div className="relative p-6 text-white space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-white/60 font-medium uppercase tracking-widest text-[10px]">Current Focus</p>
                  <h3 className="text-3xl font-black tracking-tighter">
                    {todayShift.is_off_day ? 'Refreshing Off Day' : 'Duty On Record'}
                  </h3>
                </div>
                {todayShift.is_site_day && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-none backdrop-blur-md px-3 py-1 gap-1.5 animate-pulse">
                    <Building className="h-3.5 w-3.5" /> SITE
                  </Badge>
                )}
              </div>

              {todayShift.is_off_day ? (
                <div className="flex items-center gap-2 text-white/90">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">🏝️</div>
                  <span className="text-sm font-bold uppercase tracking-widest opacity-80">Recharge Mode</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10 group-hover:bg-white/15 transition-colors">
                    <Clock className="h-6 w-6 text-primary-foreground/70" />
                    <div>
                      <p className="text-[9px] text-white/50 uppercase font-black tracking-widest">Shift Hours</p>
                      <div className="flex items-center gap-2 text-lg font-mono font-black">
                        <span>{formatTime12H(todayShift.shift_start)}</span>
                        <ArrowRight className="h-3 w-3 opacity-40 shrink-0" />
                        <span>{formatTime12H(todayShift.shift_end)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 content-center items-center">
                    {todayShift.break1_time && <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-lg border border-white/5 whitespace-nowrap">☕ {formatTime12H(todayShift.break1_time)}</span>}
                    {todayShift.break2_time && <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-lg border border-white/5 whitespace-nowrap">🍽️ {formatTime12H(todayShift.break2_time)}</span>}
                    {todayShift.break3_time && <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-lg border border-white/5 whitespace-nowrap">☕ {formatTime12H(todayShift.break3_time)}</span>}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tomorrow Quick View */}
      {tomorrowShift && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground ml-1">
            <Calendar className="h-4 w-4" />
            <span className="uppercase tracking-widest text-[10px] font-bold">Tomorrow</span>
          </div>
          <Card 
            className={`cursor-pointer transition-all hover:translate-x-1 border-none bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm hover:shadow-md group overflow-hidden ${
              tomorrowShift.is_off_day ? 'border-l-4 border-l-destructive/50' : 'border-l-4 border-l-indigo-500'
            }`}
            onClick={() => handleEditShift(tomorrowShift)}
          >
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl flex flex-col items-center justify-center font-black ${
                  tomorrowShift.is_off_day ? 'bg-destructive/10 text-destructive' : 'bg-indigo-500 text-white'
                }`}>
                  <span className="text-lg leading-none">{getDayNumber(tomorrowShift.shift_date)}</span>
                  <span className="text-[9px] uppercase tracking-tighter opacity-80">{getDayName(tomorrowShift.shift_date)}</span>
                </div>
                <div className="space-y-1">
                  {tomorrowShift.is_off_day ? (
                    <span className="font-bold text-destructive/80 shrink-0 uppercase tracking-widest text-xs">Off Day Schedule</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm font-mono font-black">
                         <span>{formatTime12H(tomorrowShift.shift_start)}</span>
                         <span className="text-muted-foreground/30 text-[9px]">TO</span>
                         <span>{formatTime12H(tomorrowShift.shift_end)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                        {tomorrowShift.is_site_day && <span className="text-indigo-600 dark:text-indigo-400 font-black">🏢 Site Work</span>}
                        {tomorrowShift.notes && <span>• {tomorrowShift.notes}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {tomorrowShift.break1_time && <span className="text-[9px] font-bold bg-indigo-500/5 text-indigo-600/60 transition-colors px-1.5 py-0.5 rounded border border-indigo-500/10">☕ {formatTime12H(tomorrowShift.break1_time)}</span>}
                        {tomorrowShift.break2_time && <span className="text-[9px] font-bold bg-indigo-500/5 text-indigo-600/60 transition-colors px-1.5 py-0.5 rounded border border-indigo-500/10">🍽️ {formatTime12H(tomorrowShift.break2_time)}</span>}
                        {tomorrowShift.break3_time && <span className="text-[9px] font-bold bg-indigo-500/5 text-indigo-600/60 transition-colors px-1.5 py-0.5 rounded border border-indigo-500/10">☕ {formatTime12H(tomorrowShift.break3_time)}</span>}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </div>
          </Card>
        </div>
      )}

      {/* Stats and Actions Row */}
      <div className="flex items-center gap-2 mt-10">
        <div className="grid grid-cols-3 gap-2 flex-1">
          <Card className="p-3 text-center border-none bg-muted/40 shadow-none">
            <p className="text-xl font-bold font-mono text-primary">{stats.workDays}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Work</p>
          </Card>
          <Card className="p-3 text-center border-none bg-muted/40 shadow-none">
            <p className="text-xl font-bold font-mono text-destructive">{stats.offDays}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Off</p>
          </Card>
          <Card className="p-3 text-center border-none bg-muted/40 shadow-none">
            <p className="text-xl font-bold font-mono text-success">{stats.completed}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Done</p>
          </Card>
        </div>
        <Button 
          variant="outline" 
          className="h-[74px] px-3 flex flex-col gap-1 text-[10px] shrink-0 items-center justify-center transition-all hover:bg-primary hover:text-white border-dashed bg-muted/20 border-muted-foreground/20 font-bold uppercase tracking-widest" 
          onClick={handleCopySchedule}
        >
          <Copy className="h-4 w-4 mb-0.5" />
          <span>Sync</span>
        </Button>
      </div>

      {/* Sequential Timeline */}
      <div className="space-y-4 pt-4 relative">
        <div className="flex items-center justify-between ml-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            <Calendar className="h-3.5 w-3.5" />
            <span>Upcoming Schedule</span>
          </div>
          <Button 
            variant="ghost" size="sm" 
            className="text-[10px] h-7 font-bold uppercase tracking-tighter gap-1.5 text-muted-foreground border border-dotted border-muted-foreground/20"
            onClick={() => setShowPastShifts(!showPastShifts)}
          >
            {showPastShifts ? 'Hide History' : `Show History (${pastShifts.length})`}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Past Shifts Column */}
          {showPastShifts && pastShifts.map((shift) => (
            <ShiftCard key={shift.shift_date} shift={shift} isPast={true} />
          ))}

          {/* Regular Sequential List */}
          {upcomingShifts.map((shift) => (
            <ShiftCard key={shift.shift_date} shift={shift} />
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Edit Shift — {editingShift ? new Date(editingShift.shift_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : ''}
            </DialogTitle>
          </DialogHeader>
          
          {editingShift && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="is_off_day" checked={editingShift.is_off_day}
                  onCheckedChange={(checked) => setEditingShift(prev => prev ? { ...prev, is_off_day: !!checked } : null)} />
                <Label htmlFor="is_off_day" className="text-sm font-medium">Day Off</Label>
              </div>

              {editingShift.is_off_day && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Absence Type</Label>
                  <Select value={editingShift.absence_type || 'scheduled_off'}
                    onValueChange={(value) => setEditingShift(prev => prev ? { ...prev, absence_type: value } : null)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="casual_leave">Casual Leave</SelectItem>
                      <SelectItem value="sick_leave">Sick Leave</SelectItem>
                      <SelectItem value="annual_leave">Annual Leave</SelectItem>
                      <SelectItem value="no_show">No Show No Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!editingShift.is_off_day && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Shift Start</Label>
                      <TimeInput24 value={editingShift.shift_start || ''}
                        onChange={(val) => setEditingShift(prev => prev ? { ...prev, shift_start: val } : null)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Shift End</Label>
                      <TimeInput24 value={editingShift.shift_end || ''}
                        onChange={(val) => setEditingShift(prev => prev ? { ...prev, shift_end: val } : null)} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Breaks</Label>
                    {[
                      { label: "Break 1", timeKey: "break1_time" as const, durKey: "break1_duration" as const, defaultDur: 15 },
                      { label: "Break 2 (Lunch)", timeKey: "break2_time" as const, durKey: "break2_duration" as const, defaultDur: 30 },
                      { label: "Break 3", timeKey: "break3_time" as const, durKey: "break3_duration" as const, defaultDur: 15 },
                    ].map(brk => (
                      <div key={brk.timeKey} className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{brk.label} Time</Label>
                          <TimeInput24 value={(editingShift[brk.timeKey] as string) || ''}
                            onChange={(val) => setEditingShift(prev => prev ? { ...prev, [brk.timeKey]: val } : null)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Duration (min)</Label>
                          <Input type="number" min={5} max={60} value={editingShift[brk.durKey]}
                            onChange={(e) => setEditingShift(prev => prev ? { ...prev, [brk.durKey]: parseInt(e.target.value) || brk.defaultDur } : null)} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2 pt-4 border-t border-border mt-3">
                    <Checkbox
                      id="site-day"
                      checked={editingShift.is_site_day || false}
                      onCheckedChange={(checked) => setEditingShift(prev => prev ? { ...prev, is_site_day: checked as boolean } : null)}
                    />
                    <Label htmlFor="site-day" className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      Worked from Site (Eligible for transport allowance)
                    </Label>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input placeholder="e.g., English Shift, Ramadan, etc." value={editingShift.notes || ''}
                  onChange={(e) => setEditingShift(prev => prev ? { ...prev, notes: e.target.value } : null)} />
              </div>

              <div className="space-y-2 pt-2 border-t mt-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Copy className="h-4 w-4" /> Repeat for other days
                </Label>
                <Select
                  value=""
                  onValueChange={(val) => {
                    if (!selectedRepeatDays.includes(val) && val !== editingShift.shift_date) {
                      setSelectedRepeatDays([...selectedRepeatDays, val]);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Add days to duplicate this shift..." /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {shifts.filter(s => s.shift_date !== editingShift.shift_date).map(s => (
                      <SelectItem key={s.shift_date} value={s.shift_date}>
                        {getDayNumber(s.shift_date)} {getDayName(s.shift_date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRepeatDays.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedRepeatDays.sort().map(d => (
                      <Badge key={d} variant="secondary" className="text-xs cursor-pointer hover:bg-destructive/20" onClick={() => setSelectedRepeatDays(prev => prev.filter(x => x !== d))}>
                        {getDayNumber(d)} {getDayName(d)} <Trash2 className="h-3 w-3 ml-1 text-muted-foreground" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveShift} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
