import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Save, Loader2, Trash2, Clock, ChevronDown, ChevronUp, Sun, Moon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStaticShift, formatTime12H } from "@/lib/staticSchedule";
import { DailyShift } from "@/lib/types";

interface DailyShiftScheduleProps {
  selectedMonth: number;
  selectedYear: number;
}

export const DailyShiftSchedule = ({ selectedMonth, selectedYear }: DailyShiftScheduleProps) => {
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
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      days.push(`${year}-${month}-${dayStr}`);
    }
    return days;
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    const loadShifts = async () => {
      if (!user?.id) return;
      setIsLoading(true);
      try {
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${new Date(selectedYear, selectedMonth + 1, 0).getDate()}`;

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
              user_id: user.id,
              shift_date: date,
              shift_start: staticShift.shift_start || null,
              shift_end: staticShift.shift_end || null,
              break1_time: staticShift.break1_time || null,
              break1_duration: staticShift.break1_duration || 15,
              break2_time: staticShift.break2_time || null,
              break2_duration: staticShift.break2_duration || 30,
              break3_time: staticShift.break3_time || null,
              break3_duration: staticShift.break3_duration || 15,
              notes: staticShift.notes || null,
              is_off_day: staticShift.is_off_day,
            };
          }

          return {
            user_id: user.id,
            shift_date: date,
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

  const handleEditShift = (shift: DailyShift) => {
    setEditingShift({ ...shift });
    setIsDialogOpen(true);
  };

  const handleSaveShift = async () => {
    if (!editingShift || !user?.id) return;
    setIsSaving(true);
    try {
      const shiftData = {
        user_id: user.id,
        shift_date: editingShift.shift_date,
        shift_start: editingShift.is_off_day ? null : editingShift.shift_start,
        shift_end: editingShift.is_off_day ? null : editingShift.shift_end,
        break1_time: editingShift.is_off_day ? null : editingShift.break1_time,
        break1_duration: editingShift.break1_duration || 15,
        break2_time: editingShift.is_off_day ? null : editingShift.break2_time,
        break2_duration: editingShift.break2_duration || 30,
        break3_time: editingShift.is_off_day ? null : editingShift.break3_time,
        break3_duration: editingShift.break3_duration || 15,
        notes: editingShift.notes,
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

      setShifts(prev => prev.map(s => 
        s.shift_date === editingShift.shift_date ? { ...editingShift, ...shiftData } : s
      ));

      toast.success("Shift saved");
      setIsDialogOpen(false);
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
      setShifts(prev => prev.map(s => 
        s.shift_date === shift.shift_date ? {
          ...s, id: undefined, shift_start: null, shift_end: null,
          break1_time: null, break2_time: null, break3_time: null,
          notes: null, is_off_day: false,
        } : s
      ));
      toast.success("Shift data cleared");
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error("Failed to delete shift");
    }
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getDayNumber = (dateStr: string) => {
    return parseInt(dateStr.split('-')[2], 10);
  };

  const isToday = (dateStr: string) => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
  };

  const isCompleted = (shift: DailyShift) => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (shift.shift_date < todayStr) return true;
    if (shift.shift_date === todayStr && !shift.is_off_day && shift.shift_end) {
      const [h, m] = shift.shift_end.split(':').map(Number);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      return now > end;
    }
    return false;
  };

  const stats = useMemo(() => {
    const workDays = shifts.filter(s => !s.is_off_day && s.shift_start).length;
    const offDays = shifts.filter(s => s.is_off_day).length;
    const completed = shifts.filter(s => isCompleted(s) && !s.is_off_day).length;
    return { workDays, offDays, completed };
  }, [shifts]);

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

      {/* Shift Cards */}
      <ScrollArea className="max-h-[600px]">
        <div className="space-y-1.5">
          {shifts.map((shift) => {
            const completed = isCompleted(shift);
            const today = isToday(shift.shift_date);
            const dayNum = getDayNumber(shift.shift_date);
            const dayName = getDayName(shift.shift_date);

            return (
              <Card
                key={shift.shift_date}
                className={`p-0 overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                  today ? 'ring-2 ring-primary border-primary' : ''
                } ${completed ? 'opacity-60' : ''} ${
                  shift.is_off_day ? 'border-l-4 border-l-destructive/50' : ''
                }`}
                onClick={() => handleEditShift(shift)}
              >
                <div className="flex items-center gap-0">
                  {/* Day Badge */}
                  <div className={`w-14 shrink-0 py-3 flex flex-col items-center justify-center ${
                    today ? 'bg-primary text-primary-foreground' : 
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
                        {shift.break1_time && (
                          <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{shift.break1_duration || 15}+{shift.break2_duration || 30}+{shift.break3_duration || 15}m</span>
                          </div>
                        )}
                      </div>
                    )}
                    {shift.notes && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{shift.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pr-2 shrink-0">
                    {shift.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                    {today && <Badge className="text-[9px] px-1 py-0">Today</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

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
                <Checkbox
                  id="is_off_day"
                  checked={editingShift.is_off_day}
                  onCheckedChange={(checked) => 
                    setEditingShift(prev => prev ? { ...prev, is_off_day: !!checked } : null)
                  }
                />
                <Label htmlFor="is_off_day" className="text-sm font-medium">Day Off</Label>
              </div>

              {editingShift.is_off_day && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Absence Type</Label>
                  <Select
                    value={editingShift.absence_type || 'scheduled_off'}
                    onValueChange={(value) => 
                      setEditingShift(prev => prev ? { ...prev, absence_type: value } : null)
                    }
                  >
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
                      <Label htmlFor="shift_start">Shift Start</Label>
                      <Input id="shift_start" type="time" value={editingShift.shift_start || ''}
                        onChange={(e) => setEditingShift(prev => prev ? { ...prev, shift_start: e.target.value } : null)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shift_end">Shift End</Label>
                      <Input id="shift_end" type="time" value={editingShift.shift_end || ''}
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
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" placeholder="e.g., English Shift, Ramadan, etc." value={editingShift.notes || ''}
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
