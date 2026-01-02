import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface WorkScheduleSettingsProps {
  selectedMonth: number;
  selectedYear: number;
  performanceId: string | null;
  onScheduleSave: () => void;
}

type DayOfWeek = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

const DAY_LABELS: Record<DayOfWeek, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

const DEFAULT_WORK_DAYS: Record<DayOfWeek, boolean> = {
  sunday: true,
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: false,
  saturday: false,
};

export const WorkScheduleSettings = ({ 
  selectedMonth, 
  selectedYear, 
  performanceId,
  onScheduleSave 
}: WorkScheduleSettingsProps) => {
  const [offDays, setOffDays] = useState<Date[]>([]);
  const [workDays, setWorkDays] = useState<Record<DayOfWeek, boolean>>(DEFAULT_WORK_DAYS);
  const [shiftStartTime, setShiftStartTime] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Load work days settings and shift time from database
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('work_days, shift_start_time')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data?.work_days) {
          setWorkDays(data.work_days as Record<DayOfWeek, boolean>);
        }
        if (data?.shift_start_time) {
          setShiftStartTime(data.shift_start_time);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Fetch off days when performanceId changes
  useEffect(() => {
    const fetchOffDays = async () => {
      if (!performanceId) {
        setOffDays([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('performance_data')
          .select('off_days')
          .eq('id', performanceId)
          .single();

        if (error) throw error;

        const offDaysArray = (data as any)?.off_days;
        if (offDaysArray) {
          const dates = offDaysArray.map((day: number) => {
            return new Date(selectedYear, selectedMonth, day);
          });
          setOffDays(dates);
        } else {
          setOffDays([]);
        }
      } catch (error) {
        console.error('Error fetching off days:', error);
      }
    };

    fetchOffDays();
  }, [performanceId, selectedMonth, selectedYear]);

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

  // Calculate remaining work days in month
  const remainingWorkDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    let remaining = 0;

    // Only calculate for current month
    if (selectedYear !== today.getFullYear() || selectedMonth !== today.getMonth()) {
      // For future months, count all work days
      if (selectedYear > today.getFullYear() || 
          (selectedYear === today.getFullYear() && selectedMonth > today.getMonth())) {
        for (let day = 1; day <= totalDaysInMonth; day++) {
          const date = new Date(selectedYear, selectedMonth, day);
          const dayOfWeek = date.getDay();
          const dayName = (["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as DayOfWeek[])[dayOfWeek];
          const isWorkDay = workDays[dayName];
          const isOffDay = offDays.some(d => d.getDate() === day);
          
          if (isWorkDay && !isOffDay) {
            remaining++;
          }
        }
      }
      return remaining;
    }

    // For current month, start from today or tomorrow based on shift time
    const startDay = shouldCountToday ? currentDay : currentDay + 1;

    for (let day = startDay; day <= totalDaysInMonth; day++) {
      const isOffDay = offDays.some(d => d.getDate() === day);
      
      if (!isOffDay) {
        remaining++;
      }
    }

    return remaining;
  }, [selectedYear, selectedMonth, workDays, offDays, shouldCountToday]);

  // Calculate total work days in month (based only on off days, not weekly pattern)
  const totalWorkDays = useMemo(() => {
    const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    let total = 0;

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const isOffDay = offDays.some(d => d.getDate() === day);
      
      if (!isOffDay) {
        total++;
      }
    }

    return total;
  }, [selectedYear, selectedMonth, offDays]);

  const handleDayClick = (date: Date | undefined) => {
    if (!date) return;
    
    if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) {
      return;
    }

    const exists = offDays.some(d => d.getDate() === date.getDate() && d.getMonth() === date.getMonth());
    
    if (exists) {
      setOffDays(offDays.filter(d => d.getDate() !== date.getDate()));
    } else {
      setOffDays([...offDays, date]);
    }
  };

  const toggleWorkDay = (day: DayOfWeek) => {
    setWorkDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const saveSchedule = async () => {
    if (!user) {
      toast.error("Please log in first");
      return;
    }

    let currentPerfId = performanceId;
    if (!currentPerfId) {
      try {
        const { data: upserted, error: upsertError } = await supabase
          .from('performance_data')
          .upsert({
            year: selectedYear,
            month: selectedMonth,
            user_id: user.id,
            good: 0,
            bad: 0,
            karma_bad: 0,
            genesys_good: 0,
            genesys_bad: 0,
            good_phone: 0,
            good_chat: 0,
            good_email: 0,
          }, { onConflict: 'year,month,user_id' })
          .select()
          .single();
        if (upsertError) throw upsertError;
        currentPerfId = upserted?.id;
      } catch (e) {
        toast.error("Failed to create performance record");
        return;
      }
    }

    setIsSaving(true);
    try {
      const dayNumbers = offDays.map(d => d.getDate());

      // Save off days to performance_data
      const { error: perfError } = await supabase
        .from('performance_data')
        .update({ off_days: dayNumbers } as any)
        .eq('id', currentPerfId);

      if (perfError) throw perfError;

      // Save work days to user_settings
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_settings')
          .update({ work_days: workDays })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            work_days: workDays,
          });

        if (error) throw error;
      }

      toast.success("Work schedule saved successfully!");
      onScheduleSave();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error("Failed to save schedule");
    } finally {
      setIsSaving(false);
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
    <Card className="p-6 border-border animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <CalendarIcon className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Work Schedule</h2>
          <p className="text-sm text-muted-foreground">Select off days and additional holidays for the month</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <Calendar
            mode="multiple"
            selected={offDays}
            onSelect={(_, date) => handleDayClick(date)}
            month={new Date(selectedYear, selectedMonth)}
            className="rounded-md border mx-auto pointer-events-auto"
            modifiers={{
              offDay: offDays
            }}
            modifiersStyles={{
              offDay: { 
                backgroundColor: "hsl(var(--destructive) / 0.1)", 
                color: "hsl(var(--destructive))",
                fontWeight: "bold"
              }
            }}
          />
          <p className="text-xs text-muted-foreground text-center mt-2">
            Click on dates to mark them as off days
          </p>
        </div>

        <div className="flex-1 space-y-4">
          {/* Weekly Work Days Reference */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3">Weekly Work Days Reference</h3>
            <div className="grid grid-cols-2 gap-2">
              {(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as DayOfWeek[]).map((day) => (
                <div key={day} className="flex items-center space-x-2">
                  <Checkbox
                    id={day}
                    checked={workDays[day]}
                    onCheckedChange={() => toggleWorkDay(day)}
                  />
                  <Label htmlFor={day} className="text-sm cursor-pointer">
                    {DAY_LABELS[day]}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: Primary calculation is based on selected off days above
            </p>
          </div>

          {/* Summary */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total days in month:</span>
                <span className="font-medium">{new Date(selectedYear, selectedMonth + 1, 0).getDate()}</span>
              </div>
              <div className="flex justify-between text-destructive">
                <span>Off days selected:</span>
                <span className="font-medium">{offDays.length}</span>
              </div>
              <div className="flex justify-between text-primary pt-2 border-t">
                <span>Total work days:</span>
                <span className="font-medium">{totalWorkDays}</span>
              </div>
              <div className="flex justify-between text-green-600 font-bold">
                <span>Remaining work days:</span>
                <span className="font-medium">{remainingWorkDays}</span>
              </div>
              {shiftStartTime && (
                <div className="text-xs text-muted-foreground pt-2">
                  {shouldCountToday ? "Today is counted (shift not ended)" : "Today excluded (shift ended)"}
                </div>
              )}
            </div>
          </div>

          <Button 
            onClick={saveSchedule} 
            disabled={isSaving} 
            className="w-full"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save Schedule"}
          </Button>
        </div>
      </div>
    </Card>
  );
};