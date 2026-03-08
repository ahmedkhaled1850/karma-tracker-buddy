import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MonthSelector } from "@/components/MonthSelector";
import { WorkScheduleSettings } from "@/components/WorkScheduleSettings";
import { DailyShiftSchedule } from "@/components/DailyShiftSchedule";
import { ExpectedSalary } from "@/components/ExpectedSalary";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CalendarOff, Clock, Briefcase, ShieldAlert, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  const [absenceStats, setAbsenceStats] = useState({ sick: 0, unexcused: 0, scheduled: 0 });

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
      const scheduled = (data || []).filter(d => d.absence_type === 'scheduled_off').length;
      setAbsenceStats({ sick, unexcused, scheduled });
    };
    loadAbsenceStats();
  }, [user?.id, selectedMonth, selectedYear, refreshKey]);

  const handleRecordAbsence = async () => {
    if (!user?.id) return;
    setAbsenceSaving(true);
    try {
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

      toast.success("Absence recorded successfully");
      setAbsenceDialogOpen(false);
      setAbsenceNotes("");
      setRefreshKey(k => k + 1);
    } catch (error) {
      console.error(error);
      toast.error("Failed to record absence");
    } finally {
      setAbsenceSaving(false);
    }
  };

  const totalAbsence = absenceStats.sick + absenceStats.unexcused;
  const absenceGateScore = totalAbsence <= 1 ? 100 : totalAbsence === 2 ? 75 : 0;

  const [kpiScore, setKpiScore] = useState(0);

  useEffect(() => {
    const loadKpi = async () => {
      if (!user?.id) return;
      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;

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

      const { data: perfData } = await supabase
        .from('performance_data')
        .select('good, bad, genesys_good, genesys_bad')
        .eq('user_id', user.id)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
        .maybeSingle();

      let csatScore = 100;
      if (perfData) {
        const totalGood = (perfData.good || 0) + (perfData.genesys_good || 0);
        const totalBad = (perfData.bad || 0) + (perfData.genesys_bad || 0);
        const total = totalGood + totalBad;
        if (total > 0) {
          const csatPct = (totalGood / total) * 100;
          csatScore = csatPct >= 93 ? 100 : csatPct >= 90 ? 75 : csatPct >= 87 ? 50 : 0;
        }
      }

      const gate = totalAbsence <= 1 ? 100 : totalAbsence === 2 ? 75 : 0;
      const final = ((prodScore * 0.5 + csatScore * 0.5) * gate) / 100;
      setKpiScore(final);
    };
    loadKpi();
  }, [user?.id, selectedMonth, selectedYear, totalAbsence]);

  const monthName = new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Work Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage shifts, off days & absences for <span className="font-medium text-foreground">{monthName}</span>
          </p>
        </div>
        <Button onClick={() => setAbsenceDialogOpen(true)} variant="destructive" size="sm" className="gap-2 self-start">
          <CalendarOff className="h-4 w-4" />
          Record Absence
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Absence Gate */}
        <Card className={`p-4 border-l-4 ${absenceGateScore === 100 ? 'border-l-success' : absenceGateScore === 75 ? 'border-l-warning' : 'border-l-destructive'}`}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Absence Gate</span>
          </div>
          <p className={`text-2xl font-bold font-mono ${absenceGateScore === 100 ? 'text-success' : absenceGateScore === 75 ? 'text-warning' : 'text-destructive'}`}>
            {absenceGateScore}%
          </p>
        </Card>

        {/* Sick Days */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">🤒 Sick</span>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">{absenceStats.sick}</p>
          <p className="text-[10px] text-muted-foreground">days this month</p>
        </Card>

        {/* Unexcused */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">❌ Unexcused</span>
          </div>
          <p className={`text-2xl font-bold font-mono ${absenceStats.unexcused > 0 ? 'text-destructive' : 'text-foreground'}`}>{absenceStats.unexcused}</p>
          <p className="text-[10px] text-muted-foreground">days this month</p>
        </Card>

        {/* Scheduled Off */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">📅 Scheduled</span>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground">{absenceStats.scheduled}</p>
          <p className="text-[10px] text-muted-foreground">no KPI impact</p>
        </Card>
      </div>

      {/* Expected Salary */}
      {user?.id && (
        <ExpectedSalary userId={user.id} kpiScore={kpiScore} />
      )}

      {/* Month Selector */}
      <MonthSelector
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
      />

      {/* Tabs */}
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="daily" className="gap-2">
            <Clock className="h-4 w-4" />
            Daily Shifts
          </TabsTrigger>
          <TabsTrigger value="offdays" className="gap-2">
            <Calendar className="h-4 w-4" />
            Off Days Calendar
          </TabsTrigger>
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

      {/* Record Absence Dialog */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-destructive" />
              Record Absence
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={absenceDate}
                onChange={(e) => setAbsenceDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Absence Type</Label>
              <Select value={absenceType} onValueChange={setAbsenceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sick_leave">🤒 Sick Leave</SelectItem>
                  <SelectItem value="unexcused">❌ Unexcused Absence</SelectItem>
                  <SelectItem value="scheduled_off">📅 Requested Leave</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {absenceType === 'scheduled_off' 
                  ? '⚡ Requested leave does not affect the Absence Gate'
                  : '⚠️ This absence type affects the Absence Gate score'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={absenceNotes}
                onChange={(e) => setAbsenceNotes(e.target.value)}
                placeholder="Reason for absence..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbsenceDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRecordAbsence} disabled={absenceSaving}>
              {absenceSaving ? "Saving..." : "Record Absence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
