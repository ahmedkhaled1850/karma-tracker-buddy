import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Gauge, Save, X } from "lucide-react";
import { toast } from "sonner";

interface ManualProductivityCardProps {
  userId: string;
  selectedMonth: number;
  selectedYear: number;
  onSaved?: () => void;
}

export const ManualProductivityCard = ({ userId, selectedMonth, selectedYear, onSaved }: ManualProductivityCardProps) => {
  const [value, setValue] = useState<string>("");
  const [saved, setSaved] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const monthLabel = new Date(selectedYear, selectedMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("performance_data")
        .select("manual_productivity")
        .eq("user_id", userId)
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .maybeSingle();
      const mp = (data as any)?.manual_productivity;
      setSaved(mp != null ? Number(mp) : null);
      setValue(mp != null ? String(mp) : "");
    };
    load();
  }, [userId, selectedMonth, selectedYear]);

  const save = async () => {
    const n = Number(value);
    if (isNaN(n) || n < 0 || n > 100) {
      toast.error("Enter a value between 0 and 100");
      return;
    }
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("performance_data")
        .select("id")
        .eq("user_id", userId)
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("performance_data").update({ manual_productivity: n } as any).eq("id", existing.id);
      } else {
        await supabase.from("performance_data").insert({
          user_id: userId,
          year: selectedYear,
          month: selectedMonth,
          manual_productivity: n,
        } as any);
      }
      setSaved(n);
      toast.success(`Productivity saved: ${n}%`);
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const clear = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("performance_data")
        .select("id")
        .eq("user_id", userId)
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from("performance_data").update({ manual_productivity: null } as any).eq("id", existing.id);
      }
      setSaved(null);
      setValue("");
      toast.success("Cleared — using auto productivity");
      onSaved?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-3 bg-card/80 backdrop-blur-sm border-border/60">
      <div className="flex items-center gap-2 mb-2">
        <Gauge className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Manual Productivity
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">{monthLabel}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">
        Override productivity score for this month. Used in KPI & Salary calculation.
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 85"
          className="h-9 text-sm"
        />
        <span className="text-xs text-muted-foreground">%</span>
        <Button onClick={save} disabled={loading} size="sm" className="h-9">
          <Save className="h-3.5 w-3.5 mr-1" /> Save
        </Button>
        {saved != null && (
          <Button onClick={clear} disabled={loading} size="sm" variant="ghost" className="h-9">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {saved != null && (
        <p className="text-[11px] text-success mt-2">
          ✓ Active: {saved}% applied to KPI for {monthLabel}
        </p>
      )}
    </Card>
  );
};
