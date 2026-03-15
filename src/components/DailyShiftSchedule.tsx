import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Save, Loader2, Trash2, Sun, Moon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStaticShift, formatTime12H } from "@/lib/staticSchedule";
import { DailyShift } from "@/lib/types";


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
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
              notes: staticShift.notes || null, is_off_day: staticShift.is_off_day,
            };
          }

          return {
            user_id: user.id, shift_date: date,
            shift_start: null, shift_end: null,
            break1_time: null, break1_duration: 15,
            break2_time: null, break2_duration: 30,
            break3_time: null, break3_duration: 15,
            notes: null, is_off_day: false,
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

  const handleEditShift = (shift: DailyShift) => {
    setEditingShift({ ...shift });
    setIsDialogOpen(true);
  };

  const handleSaveShift = async () => {
    if (!editingShift || !user?.id) return;
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
        absence_type: editingShift.is_off_day ? (editingShift.absence_type || 'scheduled_off') : null,
      };

      if (editingShift.id) {
        const { error } = await supabase.from('daily_shifts').update(shiftData).eq('id', editingShift.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('daily_shifts').insert(shiftData).select().single();
        if (error) throw error;
        editingShift.id = data.id;
      }

      const updatedShifts = shifts.map(s => 
        s.shift_date === editingShift.shift_date ? { ...editingShift, ...shiftData } : s
      );
      setShifts(updatedShifts);

      // Sync off_days to performance_data
      await syncOffDays(updatedShifts);

      toast.success("Shift saved");
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

  const calcBreakEnd = (startTime: string, durationMin: number): string => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMin = h * 60 + m + durationMin;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return formatTime12H(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
  };

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const checkCompleted = (shift: DailyShift) => {
    if (shift.shift_date < todayStr) return true;
    if (shift.shift_date === todayStr && !shift.is_off_day && shift.shift_end) {
      const now = new Date();
      const [h, m] = shift.shift_end.split(':').map(Number);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      return now > end;
    }
    return false;
  };

  const stats = useMemo(() => {
    const workDays = shifts.filter(s => !s.is_off_day && s.shift_start).length;
    const offDays = shifts.filter(s => s.is_off_day).length;
    const completed = shifts.filter(s => checkCompleted(s) && !s.is_off_day).length;
    return { workDays, offDays, completed };
  }, [shifts, todayStr]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-xl font-bold font-mono text-primary">{stats.workDays}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Work Days</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xl font-bold font-mono text-destructive">{stats.offDays}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Off Days</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xl font-bold font-mono text-success">{stats.completed}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completed</p>
        </Card>
      </div>

      {/* Shift Cards - full scroll, no max-height restriction */}
      <div className="space-y-1.5">
        {shifts.map((shift) => {
          const completed = checkCompleted(shift);
          const isToday = shift.shift_date === todayStr;
          const dayNum = getDayNumber(shift.shift_date);
          const dayName = getDayName(shift.shift_date);

          return (
            <Card
              key={shift.shift_date}
              className={`p-0 overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                isToday ? 'ring-2 ring-primary border-primary' : ''
              } ${completed ? 'opacity-60' : ''} ${
                shift.is_off_day ? 'border-l-4 border-l-destructive/50' : ''
              }`}
              onClick={() => handleEditShift(shift)}
            >
              <div className="flex items-center gap-0">
                {/* Day Badge */}
                <div className={`w-14 shrink-0 py-3 flex flex-col items-center justify-center ${
                  isToday ? 'bg-primary text-primary-foreground' : 
                  shift.is_off_day ? 'bg-destructive/10 text-destructive' :
                  completed ? 'bg-success/10 text-success' : 'bg-muted/50 text-muted-foreground'
                }`}>
                  <span className="text-lg font-bold font-mono leading-none">{dayNum}</span>
                  <span className="text-[10px] uppercase">{dayName}</span>
                </div>

                {/* Content */}
                <div className="flex-1 px-3 py-2 min-w-0">
                  {shift.is_off_day ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-destructive">Day Off</span>
                      {shift.absence_type === 'sick_leave' && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">🤒 Sick</Badge>}
                      {shift.absence_type === 'unexcused' && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">❌ Unexcused</Badge>}
                      {shift.absence_type === 'scheduled_off' && <Badge variant="outline" className="text-[10px] px-1.5 py-0">📅 Scheduled</Badge>}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* Shift Times */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Sun className="h-3 w-3 text-warning" />
                          <span className="text-sm font-mono font-medium">{formatTime12H(shift.shift_start)}</span>
                        </div>
                        <span className="text-muted-foreground text-xs">→</span>
                        <div className="flex items-center gap-1.5">
                          <Moon className="h-3 w-3 text-primary" />
                          <span className="text-sm font-mono font-medium">{formatTime12H(shift.shift_end)}</span>
                        </div>
                        {isToday && <Badge className="text-[9px] px-1 py-0">Today</Badge>}
                      </div>

                      {/* Breaks Detail */}
                      {(shift.break1_time || shift.break2_time || shift.break3_time) && (
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {shift.break1_time && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              ☕ <span className="font-medium">{formatTime12H(shift.break1_time)}</span>
                              <span className="text-amber-500/60">→</span>
                              <span className="font-medium">{calcBreakEnd(shift.break1_time, shift.break1_duration || 15)}</span>
                              <span className="text-amber-500/50 text-[10px]">{shift.break1_duration || 15}m</span>
                            </span>
                          )}
                          {shift.break2_time && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              🍽️ <span className="font-medium">{formatTime12H(shift.break2_time)}</span>
                              <span className="text-emerald-500/60">→</span>
                              <span className="font-medium">{calcBreakEnd(shift.break2_time, shift.break2_duration || 30)}</span>
                              <span className="text-emerald-500/50 text-[10px]">{shift.break2_duration || 30}m</span>
                            </span>
                          )}
                          {shift.break3_time && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                              ☕ <span className="font-medium">{formatTime12H(shift.break3_time)}</span>
                              <span className="text-violet-500/60">→</span>
                              <span className="font-medium">{calcBreakEnd(shift.break3_time, shift.break3_duration || 15)}</span>
                              <span className="text-violet-500/50 text-[10px]">{shift.break3_duration || 15}m</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {shift.notes && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">📝 {shift.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="pr-2 shrink-0 flex items-center gap-1">
                  {shift.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
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
                      <SelectItem value="scheduled_off">📅 Scheduled Off</SelectItem>
                      <SelectItem value="sick_leave">🤒 Sick Leave</SelectItem>
                      <SelectItem value="unexcused">❌ Unexcused Absence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!editingShift.is_off_day && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Shift Start</Label>
                      <Input type="time" value={editingShift.shift_start || ''}
                        onChange={(e) => setEditingShift(prev => prev ? { ...prev, shift_start: e.target.value } : null)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Shift End</Label>
                      <Input type="time" value={editingShift.shift_end || ''}
                        onChange={(e) => setEditingShift(prev => prev ? { ...prev, shift_end: e.target.value } : null)} />
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
                          <Input type="time" value={editingShift[brk.timeKey] || ''}
                            onChange={(e) => setEditingShift(prev => prev ? { ...prev, [brk.timeKey]: e.target.value } : null)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Duration (min)</Label>
                          <Input type="number" min={5} max={60} value={editingShift[brk.durKey]}
                            onChange={(e) => setEditingShift(prev => prev ? { ...prev, [brk.durKey]: parseInt(e.target.value) || brk.defaultDur } : null)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input placeholder="e.g., English Shift, Ramadan, etc." value={editingShift.notes || ''}
                  onChange={(e) => setEditingShift(prev => prev ? { ...prev, notes: e.target.value } : null)} />
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
