import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MonthSelector } from "@/components/MonthSelector";
import { WorkScheduleSettings } from "@/components/WorkScheduleSettings";
import { DailyShiftSchedule } from "@/components/DailyShiftSchedule";
import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function WorkSchedule() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [performanceId, setPerformanceId] = useState<string | null>(null);

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
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Work Schedule</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your monthly off days and daily shift schedules.
        </p>
      </Card>

      <div className="space-y-6">
        <MonthSelector
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
        />

        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily">Daily Shift Schedule</TabsTrigger>
            <TabsTrigger value="offdays">Off Days Calendar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="daily" className="mt-4">
            <DailyShiftSchedule
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
            />
          </TabsContent>
          
          <TabsContent value="offdays" className="mt-4">
            <WorkScheduleSettings
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              performanceId={performanceId}
              onScheduleSave={() => toast.success("Work schedule updated")}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
