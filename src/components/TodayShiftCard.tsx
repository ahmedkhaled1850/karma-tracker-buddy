import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Coffee, Sparkles, Moon, Sun, Star, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getEgyptTime, formatTime12H } from "@/lib/timeUtils";
import { DailyShift } from "@/lib/types";

export const TodayShiftCard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shift, setShift] = useState<DailyShift | null>(null);
  const [otHours, setOtHours] = useState({
    day: 0,
    night: 0,
    special: 0
  });

  const loadTodayShift = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const todayStr = getEgyptTime().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("daily_shifts")
        .select("*")
        .eq("user_id", user.id)
        .eq("shift_date", todayStr)
        .maybeSingle();

      if (error) throw error;
      
      const ds = data as unknown as DailyShift;
      setShift(ds);
      if (ds) {
        setOtHours({
          day: Number(ds.ot_hours_day || 0),
          night: Number(ds.ot_hours_night || 0),
          special: Number(ds.ot_hours_special || 0)
        });
      }
    } catch (err) {
      console.error("Error loading today shift:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodayShift();
  }, [user]);

  const handleSaveOT = async () => {
    if (!user || !shift) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("daily_shifts")
        .update({
          ot_hours_day: otHours.day,
          ot_hours_night: otHours.night,
          ot_hours_special: otHours.special
        } as any)
        .eq("id", shift.id);

      if (error) throw error;
      toast.success("Overtime updated successfully! 🚀");
    } catch (err) {
      console.error("Error saving OT:", err);
      toast.error("Failed to save overtime");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 animate-pulse bg-muted/20 border-border/50 h-[300px]">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 w-32 bg-muted rounded" />
          <div className="h-8 w-24 bg-muted rounded-full" />
        </div>
        <div className="space-y-4">
          <div className="h-12 w-full bg-muted rounded" />
          <div className="h-24 w-full bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (!shift || shift.is_off_day) {
    return (
      <Card className="p-8 bg-gradient-hero border border-primary/10 relative overflow-hidden text-center">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <Coffee className="h-12 w-12 text-primary mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-bold text-foreground">Enjoy your Off Day! 🌴</h3>
        <p className="text-muted-foreground mt-2">No shift scheduled for today. Recharge and relax.</p>
        <Badge variant="outline" className="mt-4 bg-primary/5 text-primary border-primary/20">
          Scheduled: Off
        </Badge>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background via-background/95 to-primary/5 shadow-premium group">
      {/* Dynamic Background Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/15 transition-all duration-500" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/15 transition-all duration-500" />

      <div className="p-5 md:p-6 relative space-y-6">
        {/* Header: Shift Times */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Today's Shift</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl font-bold text-foreground">{formatTime12H(shift.shift_start)}</span>
                <span className="text-muted-foreground font-medium">to</span>
                <span className="text-xl font-bold text-foreground">{formatTime12H(shift.shift_end)}</span>
              </div>
            </div>
          </div>
          <Badge className="bg-success/10 text-success border-success/20 animate-pulse-subtle">
            Active Now
          </Badge>
        </div>

        {/* Breaks Grid */}
        <div className="space-y-3">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-primary" />
            Scheduled Breaks
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {[shift.break1_time, shift.break2_time, shift.break3_time].map((b, i) => b && (
              <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-primary/30 transition-all text-center group/break">
                <Coffee className="h-4 w-4 text-muted-foreground mx-auto mb-1 group-hover/break:text-primary transition-colors" />
                <span className="text-xs font-bold text-foreground block">{formatTime12H(b)}</span>
                <span className="text-[9px] text-muted-foreground uppercase">{i === 1 ? "30 min" : "15 min"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Overtime Section */}
        <div className="pt-4 border-t border-border/40 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Logged Overtime</Label>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-[10px] font-semibold gap-1.5 border-primary/20 hover:bg-primary/5 active:scale-95 transition-all"
              onClick={handleSaveOT}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save OT
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {/* Day OT */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-orange-500">
                <Sun className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase">Day (1.35x)</span>
              </div>
              <Input 
                type="number" 
                step="0.5"
                min="0"
                className="h-10 bg-muted/30 border-border/40 text-center font-bold focus:ring-primary/20" 
                value={otHours.day}
                onChange={(e) => setOtHours({...otHours, day: parseFloat(e.target.value) || 0})}
              />
            </div>

            {/* Night OT */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-indigo-500">
                <Moon className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase">Night (1.70x)</span>
              </div>
              <Input 
                type="number" 
                step="0.5"
                min="0"
                className="h-10 bg-muted/30 border-border/40 text-center font-bold focus:ring-primary/20"
                value={otHours.night}
                onChange={(e) => setOtHours({...otHours, night: parseFloat(e.target.value) || 0})}
              />
            </div>

            {/* Special OT */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-yellow-500">
                <Star className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase">Spec (3.0x)</span>
              </div>
              <Input 
                type="number" 
                step="0.5"
                min="0"
                className="h-10 bg-muted/30 border-border/40 text-center font-bold focus:ring-primary/20"
                value={otHours.special}
                onChange={(e) => setOtHours({...otHours, special: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>
          
          <p className="text-[10px] text-muted-foreground leading-tight px-1 italic">
            * Overtime will be calculated automatically in your Expected Salary card.
          </p>
        </div>
      </div>
    </Card>
  );
};
