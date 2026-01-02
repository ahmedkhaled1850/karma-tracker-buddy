import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MonthSelector } from "@/components/MonthSelector";
import { WorkScheduleSettings } from "@/components/WorkScheduleSettings";
import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WorkSchedule() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [performanceId, setPerformanceId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadPerformance = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from("performance_data")
          .select("id")
          .eq("year", selectedYear)
          .eq("month", selectedMonth)
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        setPerformanceId(data?.id || null);
      } catch {
        setPerformanceId(null);
      }
    };
    loadPerformance();
  }, [user?.id, selectedMonth, selectedYear]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Work Schedule</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your monthly off days to calculate accurate working days and daily targets.
        </p>
      </Card>
      <div className="space-y-6">
        <MonthSelector
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
        />
        <Card className="p-4 border-border bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button 
              onClick={() => {
                try { localStorage.setItem("ktb_quick_rating", "good"); } catch {}
                navigate("/");
                toast.success("Opening quick Add Good Rating…");
              }}
              className="h-12"
            >
              <Plus className="mr-2 h-5 w-5" /> Add Good Rating
            </Button>
            <Button 
              onClick={() => {
                try { localStorage.setItem("ktb_quick_rating", "bad"); } catch {}
                navigate("/");
                toast.error("Opening quick Add Bad Rating…");
              }}
              variant="destructive"
              className="h-12"
            >
              <Minus className="mr-2 h-5 w-5" /> Add Bad Rating
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Uses Dashboard dialog and saves automatically.
          </p>
        </Card>
        <WorkScheduleSettings
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          performanceId={performanceId}
          onScheduleSave={() => toast.success("Work schedule updated")}
        />
      </div>
    </div>
  );
}
