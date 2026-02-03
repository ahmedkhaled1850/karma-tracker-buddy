import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Save, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getStaticShift, formatTime12H } from "@/lib/staticSchedule";
import { DailyShift } from "@/lib/types";

interface DailyShiftScheduleProps {
  selectedMonth: number;
  selectedYear: number;
}

const formatTimeDisplay = (time: string | null, duration?: number): string => {
  if (!time) return "-";
  const timeStr = formatTime12H(time);
  const durationStr = duration ? ` (${duration}m)` : "";
  return `${timeStr}${durationStr}`;
};

export const DailyShiftSchedule = ({ selectedMonth, selectedYear }: DailyShiftScheduleProps) => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<DailyShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingShift, setEditingShift] = useState<DailyShift | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Generate all days in the month
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

  // Load shifts from database
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

        // Create a map of existing shifts
        const shiftsMap = new Map((data || []).map(s => [s.shift_date, s]));

        // Generate shifts for all days, using existing data or defaults
        const allShifts: DailyShift[] = daysInMonth.map(date => {
          const existing = shiftsMap.get(date);
          if (existing) {
            return existing as DailyShift;
          }
          
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
            shift_start: null,
            shift_end: null,
            break1_time: null,
            break1_duration: 15,
            break2_time: null,
            break2_duration: 30,
            break3_time: null,
            break3_duration: 15,
            notes: null,
            is_off_day: false,
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
      };

      if (editingShift.id) {
        const { error } = await supabase
          .from('daily_shifts')
          .update(shiftData)
          .eq('id', editingShift.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('daily_shifts')
          .insert(shiftData)
          .select()
          .single();

        if (error) throw error;
        editingShift.id = data.id;
      }

      // Update local state
      setShifts(prev => prev.map(s => 
        s.shift_date === editingShift.shift_date ? { ...editingShift, ...shiftData } : s
      ));

      toast.success("Shift saved successfully");
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
      const { error } = await supabase
        .from('daily_shifts')
        .delete()
        .eq('id', shift.id);

      if (error) throw error;

      // Reset local state
      setShifts(prev => prev.map(s => 
        s.shift_date === shift.shift_date ? {
          ...s,
          id: undefined,
          shift_start: null,
          shift_end: null,
          break1_time: null,
          break2_time: null,
          break3_time: null,
          notes: null,
          is_off_day: false,
        } : s
      ));

      toast.success("Shift data cleared");
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error("Failed to delete shift");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Count statistics
  const stats = useMemo(() => {
    const workDays = shifts.filter(s => !s.is_off_day && s.shift_start).length;
    const offDays = shifts.filter(s => s.is_off_day).length;
    return { workDays, offDays };
  }, [shifts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="p-6 border-border animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Daily Shift Schedule</h2>
            <p className="text-sm text-muted-foreground">
              Click on a row to edit shift times and breaks
            </p>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Work Days: <span className="font-bold text-primary">{stats.workDays}</span>
          </span>
          <span className="text-muted-foreground">
            Off Days: <span className="font-bold text-destructive">{stats.offDays}</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead className="w-[60px]">Day</TableHead>
              <TableHead className="w-[90px]">Shift Start</TableHead>
              <TableHead className="w-[90px]">Shift End</TableHead>
              <TableHead className="w-[100px]">Break 1</TableHead>
              <TableHead className="w-[100px]">Break 2 (Lunch)</TableHead>
              <TableHead className="w-[100px]">Break 3</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift) => {
              const isCompleted = (() => {
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                
                if (shift.shift_date < todayStr) return true;
                
                if (shift.shift_date === todayStr) {
                  // If it's an off day today, we don't mark it as completed/crossed out yet unless day is over?
                  // User said "shift finished". If no shift (off day), maybe wait until tomorrow.
                  // But for "past days", definitely yes.
                  // Let's stick to strict shift end check for today.
                  if (shift.is_off_day) return false; 
                  
                  if (shift.shift_end) {
                    const [h, m] = shift.shift_end.split(':').map(Number);
                    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
                    return now > end;
                  }
                }
                return false;
              })();

              return (
              <TableRow 
                key={shift.shift_date}
                className={`cursor-pointer hover:bg-muted/50 transition-colors
                  ${shift.is_off_day && !isCompleted ? 'bg-destructive/5' : ''}
                  ${isCompleted ? 'bg-green-50/50 text-green-700 dark:bg-green-900/10 dark:text-green-400' : ''}
                `}
                onClick={() => handleEditShift(shift)}
              >
                <TableCell className={`font-medium ${isCompleted ? 'line-through' : ''}`}>{formatDate(shift.shift_date)}</TableCell>
                <TableCell className={`text-muted-foreground ${isCompleted ? 'line-through' : ''}`}>{getDayName(shift.shift_date)}</TableCell>
                <TableCell className={isCompleted ? 'line-through' : ''}>
                  {shift.is_off_day ? <span className="text-destructive font-medium">OFF</span> : formatTime12H(shift.shift_start)}
                </TableCell>
                <TableCell className={isCompleted ? 'line-through' : ''}>
                  {shift.is_off_day ? <span className="text-destructive font-medium">OFF</span> : formatTime12H(shift.shift_end)}
                </TableCell>
                <TableCell className={isCompleted ? 'line-through' : ''}>{shift.is_off_day ? "-" : formatTimeDisplay(shift.break1_time, shift.break1_duration)}</TableCell>
                <TableCell className={isCompleted ? 'line-through' : ''}>{shift.is_off_day ? "-" : formatTimeDisplay(shift.break2_time, shift.break2_duration)}</TableCell>
                <TableCell className={isCompleted ? 'line-through' : ''}>{shift.is_off_day ? "-" : formatTimeDisplay(shift.break3_time, shift.break3_duration)}</TableCell>
                <TableCell className={`max-w-[200px] truncate ${isCompleted ? 'line-through' : ''}`}>{shift.notes || "-"}</TableCell>
                <TableCell>
                  {shift.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteShift(shift);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit Shift - {editingShift ? formatDate(editingShift.shift_date) : ''}
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
                <Label htmlFor="is_off_day" className="text-sm font-medium">
                  Day Off
                </Label>
              </div>

              {!editingShift.is_off_day && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shift_start">Shift Start</Label>
                      <Input
                        id="shift_start"
                        type="time"
                        value={editingShift.shift_start || ''}
                        onChange={(e) => 
                          setEditingShift(prev => prev ? { ...prev, shift_start: e.target.value } : null)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shift_end">Shift End</Label>
                      <Input
                        id="shift_end"
                        type="time"
                        value={editingShift.shift_end || ''}
                        onChange={(e) => 
                          setEditingShift(prev => prev ? { ...prev, shift_end: e.target.value } : null)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Breaks</Label>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="break1_time" className="text-xs">Break 1 Time</Label>
                        <Input
                          id="break1_time"
                          type="time"
                          value={editingShift.break1_time || ''}
                          onChange={(e) => 
                            setEditingShift(prev => prev ? { ...prev, break1_time: e.target.value } : null)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="break1_duration" className="text-xs">Duration (min)</Label>
                        <Input
                          id="break1_duration"
                          type="number"
                          min={5}
                          max={60}
                          value={editingShift.break1_duration}
                          onChange={(e) => 
                            setEditingShift(prev => prev ? { ...prev, break1_duration: parseInt(e.target.value) || 15 } : null)
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="break2_time" className="text-xs">Break 2 (Lunch) Time</Label>
                        <Input
                          id="break2_time"
                          type="time"
                          value={editingShift.break2_time || ''}
                          onChange={(e) => 
                            setEditingShift(prev => prev ? { ...prev, break2_time: e.target.value } : null)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="break2_duration" className="text-xs">Duration (min)</Label>
                        <Input
                          id="break2_duration"
                          type="number"
                          min={5}
                          max={60}
                          value={editingShift.break2_duration}
                          onChange={(e) => 
                            setEditingShift(prev => prev ? { ...prev, break2_duration: parseInt(e.target.value) || 30 } : null)
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="break3_time" className="text-xs">Break 3 Time</Label>
                        <Input
                          id="break3_time"
                          type="time"
                          value={editingShift.break3_time || ''}
                          onChange={(e) => 
                            setEditingShift(prev => prev ? { ...prev, break3_time: e.target.value } : null)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="break3_duration" className="text-xs">Duration (min)</Label>
                        <Input
                          id="break3_duration"
                          type="number"
                          min={5}
                          max={60}
                          value={editingShift.break3_duration}
                          onChange={(e) => 
                            setEditingShift(prev => prev ? { ...prev, break3_duration: parseInt(e.target.value) || 15 } : null)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="e.g., English Shift, Ramadan, etc."
                  value={editingShift.notes || ''}
                  onChange={(e) => 
                    setEditingShift(prev => prev ? { ...prev, notes: e.target.value } : null)
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveShift} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
