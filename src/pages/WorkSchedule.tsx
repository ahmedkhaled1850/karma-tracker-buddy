import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MonthSelector } from "@/components/MonthSelector";
import { WorkScheduleSettings } from "@/components/WorkScheduleSettings";
import { DailyShiftSchedule } from "@/components/DailyShiftSchedule";
import { ExpectedSalary } from "@/components/ExpectedSalary";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function WorkSchedule() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [performanceId, setPerformanceId] = useState<string | null>(null);
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [absenceDate, setAbsenceDate] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });
  const [absenceType, setAbsenceType] = useState<string>("sick_leave");
  const [absenceNotes, setAbsenceNotes] = useState("");
  const [absenceSaving, setAbsenceSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Absence summary for the month
  const [absenceStats, setAbsenceStats] = useState({ sick: 0, unexcused: 0 });

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

  // Load absence stats
  useEffect(() => {
    const loadAbsenceStats = async () => {
      if (!user?.id) return;
      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;

      const { data } = await supabase
        .from('daily_shifts')
        .select('absence_type')
        .eq('user_id', user.id)
        .eq('is_off_day', true)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate);

      const sick = (data || []).filter(d => d.absence_type === 'sick_leave').length;
      const unexcused = (data || []).filter(d => d.absence_type === 'unexcused').length;
      setAbsenceStats({ sick, unexcused });
    };
    loadAbsenceStats();
  }, [user?.id, selectedMonth, selectedYear, refreshKey]);

  const handleRecordAbsence = async () => {
    if (!user?.id) return;
    setAbsenceSaving(true);
    try {
      // Check if shift already exists for this date
      const { data: existing } = await supabase
        .from('daily_shifts')
        .select('id')
        .eq('user_id', user.id)
        .eq('shift_date', absenceDate)
        .maybeSingle();

      const shiftData = {
        user_id: user.id,
        shift_date: absenceDate,
        is_off_day: true,
        absence_type: absenceType,
        shift_start: null,
        shift_end: null,
        break1_time: null,
        break2_time: null,
        break3_time: null,
        notes: absenceNotes || null,
      };

      if (existing) {
        await supabase.from('daily_shifts').update(shiftData).eq('id', existing.id);
      } else {
        await supabase.from('daily_shifts').insert(shiftData);
      }

      toast.success("تم تسجيل الغياب بنجاح");
      setAbsenceDialogOpen(false);
      setAbsenceNotes("");
      setRefreshKey(k => k + 1);
    } catch (error) {
      console.error(error);
      toast.error("فشل في تسجيل الغياب");
    } finally {
      setAbsenceSaving(false);
    }
  };

  const totalAbsence = absenceStats.sick + absenceStats.unexcused;
  const absenceGateScore = totalAbsence <= 1 ? 100 : totalAbsence === 2 ? 75 : 0;

  // Calculate KPI score for salary estimation
  // We need productivity and CSAT data
  const [kpiScore, setKpiScore] = useState(0);

  useEffect(() => {
    const loadKpi = async () => {
      if (!user?.id) return;
      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;

      // Productivity
      const { data: callsData } = await supabase
        .from('daily_survey_calls')
        .select('total_calls')
        .eq('user_id', user.id)
        .gte('call_date', startDate)
        .lte('call_date', endDate);

      const validDays = (callsData || []).filter(r => (r.total_calls || 0) > 0);
      const totalCalls = validDays.reduce((s, r) => s + (r.total_calls || 0), 0);
      const avg = validDays.length > 0 ? totalCalls / validDays.length : 0;
      const prodScore = avg >= 30 ? 100 : avg >= 28 ? 75 : avg >= 26 ? 50 : 0;

      // CSAT from performance_data
      const { data: perfData } = await supabase
        .from('performance_data')
        .select('good, bad, genesys_good, genesys_bad')
        .eq('user_id', user.id)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .maybeSingle();

      let csatScore = 100; // default if no surveys
      if (perfData) {
        const totalGood = (perfData.good || 0) + (perfData.genesys_good || 0);
        const totalBad = (perfData.bad || 0) + (perfData.genesys_bad || 0);
        const total = totalGood + totalBad;
        if (total > 0) {
          const csatPct = (totalGood / total) * 100;
          csatScore = csatPct >= 93 ? 100 : csatPct >= 90 ? 75 : csatPct >= 87 ? 50 : 0;
        }
      }

      // Absence gate
      const gate = totalAbsence <= 1 ? 100 : totalAbsence === 2 ? 75 : 0;

      const final = ((prodScore * 0.5 + csatScore * 0.5) * gate) / 100;
      setKpiScore(final);
    };
    loadKpi();
  }, [user?.id, selectedMonth, selectedYear, totalAbsence]);
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Work Schedule</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage your monthly off days and daily shift schedules.
            </p>
          </div>
          <Button onClick={() => setAbsenceDialogOpen(true)} variant="destructive" size="sm" className="gap-2">
            <CalendarOff className="h-4 w-4" />
            سجّل غياب
          </Button>
        </div>

        {/* Absence Gate Summary */}
        <div className="mt-4 flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Absence Gate:</span>
          </div>
          <Badge variant={absenceGateScore === 100 ? "default" : absenceGateScore === 75 ? "secondary" : "destructive"}>
            {absenceGateScore}%
          </Badge>
          <span className="text-xs text-muted-foreground">
            ({totalAbsence} absence day{totalAbsence !== 1 ? 's' : ''})
          </span>
          {absenceStats.sick > 0 && (
            <Badge variant="secondary" className="text-xs">{absenceStats.sick} Sick</Badge>
          )}
          {absenceStats.unexcused > 0 && (
            <Badge variant="destructive" className="text-xs">{absenceStats.unexcused} Unexcused</Badge>
          )}
        </div>
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
              key={refreshKey}
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

      {/* Record Absence Dialog */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-destructive" />
              تسجيل يوم غياب
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={absenceDate}
                onChange={(e) => setAbsenceDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>نوع الغياب</Label>
              <Select value={absenceType} onValueChange={setAbsenceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sick_leave">🤒 إجازة مرضية (Sick Leave)</SelectItem>
                  <SelectItem value="unexcused">❌ غياب بدون عذر (Unexcused)</SelectItem>
                  <SelectItem value="scheduled_off">📅 إجازة مطلوبة (Requested Leave)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {absenceType === 'scheduled_off' 
                  ? '⚡ الإجازة المطلوبة لا تؤثر على الـ Absence Gate'
                  : '⚠️ هذا النوع من الغياب يؤثر على الـ Absence Gate'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea
                value={absenceNotes}
                onChange={(e) => setAbsenceNotes(e.target.value)}
                placeholder="سبب الغياب..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbsenceDialogOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleRecordAbsence} disabled={absenceSaving}>
              {absenceSaving ? "جاري الحفظ..." : "تسجيل الغياب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
