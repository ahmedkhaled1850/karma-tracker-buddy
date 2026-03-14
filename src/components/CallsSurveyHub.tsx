import { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Send, TrendingUp, CheckCircle, AlertTriangle, Calendar, Edit2, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CallsSurveyHubProps {
  userId: string;
  selectedMonth: number;
  selectedYear: number;
  remainingWorkDays?: number;
}

interface DailySurveyData {
  id?: string;
  call_date: string;
  total_calls: number;
  surveys_sent: number;
}

const getProductivityScore = (avg: number) => {
  if (avg >= 30) return 100;
  if (avg >= 28) return 75;
  if (avg >= 26) return 50;
  return 0;
};

const getScoreColor = (score: number) => {
  if (score === 100) return "text-green-500";
  if (score === 75) return "text-yellow-500";
  if (score === 50) return "text-orange-500";
  return "text-destructive";
};

const CallsSurveyHub = ({ userId, selectedMonth, selectedYear, remainingWorkDays }: CallsSurveyHubProps) => {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [todayData, setTodayData] = useState<DailySurveyData>({
    call_date: todayStr,
    total_calls: 0,
    surveys_sent: 0,
  });
  const [monthlyData, setMonthlyData] = useState<DailySurveyData[]>([]);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<{ date: string; calls: number; surveys: number } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Generate all days of the selected month
  const allDaysOfMonth = useMemo(() => {
    const days: string[] = [];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(dateStr);
    }
    return days;
  }, [selectedMonth, selectedYear]);

  const monthlyDataMap = useMemo(() => {
    const map: Record<string, DailySurveyData> = {};
    monthlyData.forEach(d => { map[d.call_date] = d; });
    return map;
  }, [monthlyData]);

  // Load today's data
  useEffect(() => {
    const loadTodayData = async () => {
      const { data, error } = await supabase
        .from("daily_survey_calls")
        .select("*")
        .eq("user_id", userId)
        .eq("call_date", todayStr)
        .maybeSingle();

      if (data && !error) {
        setTodayData({
          id: data.id,
          call_date: data.call_date,
          total_calls: data.total_calls,
          surveys_sent: data.surveys_sent,
        });
      }
      initializedRef.current = true;
    };

    if (userId) loadTodayData();
  }, [userId, todayStr]);

  // Load monthly data
  const loadMonthlyData = async () => {
    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-31`;

    const { data, error } = await supabase
      .from("daily_survey_calls")
      .select("*")
      .eq("user_id", userId)
      .gte("call_date", startDate)
      .lte("call_date", endDate)
      .order("call_date", { ascending: true });

    if (data && !error) {
      setMonthlyData(data);
    }
  };

  useEffect(() => {
    if (userId) loadMonthlyData();
  }, [userId, selectedMonth, selectedYear]);

  // === Productivity KPI calculations ===
  const productivityMetrics = useMemo(() => {
    const validDays = monthlyData.filter(r => (r.total_calls || 0) > 0);
    const totalCalls = validDays.reduce((sum, r) => sum + (r.total_calls || 0), 0);
    const recordedDays = validDays.length;
    const avgCalls = recordedDays > 0 ? totalCalls / recordedDays : 0;
    const score = getProductivityScore(avgCalls);
    
    const days = remainingWorkDays ?? 1;
    const totalDays = recordedDays + days;
    const callsNeeded100 = Math.max(0, Math.ceil(30 * totalDays - totalCalls));
    const callsPerDay100 = Math.ceil(callsNeeded100 / Math.max(1, days));
    const callsNeeded75 = Math.max(0, Math.ceil(28 * totalDays - totalCalls));
    const callsPerDay75 = Math.ceil(callsNeeded75 / Math.max(1, days));
    
    return { totalCalls, recordedDays, avgCalls, score, callsPerDay100, callsPerDay75, callsNeeded100, days };
  }, [monthlyData, remainingWorkDays]);

  // === Survey conversion calculations ===
  const requiredSurveys = Math.ceil(todayData.total_calls * 0.85);
  const todayConversionRate = todayData.total_calls > 0
    ? (todayData.surveys_sent / todayData.total_calls) * 100
    : 0;
  const isTodayMet = todayData.surveys_sent >= requiredSurveys && todayData.total_calls > 0;

  const monthlyTotalCalls = monthlyData.reduce((sum, d) => sum + d.total_calls, 0);
  const monthlyTotalSurveys = monthlyData.reduce((sum, d) => sum + d.surveys_sent, 0);
  const monthlyConversionRate = monthlyTotalCalls > 0
    ? (monthlyTotalSurveys / monthlyTotalCalls) * 100
    : 0;
  const isMonthlyMet = monthlyConversionRate >= 85;

  // Auto-save
  const autoSave = async (dataToSave: DailySurveyData) => {
    if (saving) return;
    setSaving(true);
    try {
      if (dataToSave.id) {
        const { error } = await supabase
          .from("daily_survey_calls")
          .update({ total_calls: dataToSave.total_calls, surveys_sent: dataToSave.surveys_sent })
          .eq("id", dataToSave.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("daily_survey_calls")
          .insert({ user_id: userId, call_date: todayStr, total_calls: dataToSave.total_calls, surveys_sent: dataToSave.surveys_sent })
          .select()
          .single();
        if (error) throw error;
        if (data) setTodayData(prev => ({ ...prev, id: data.id }));
      }
      await loadMonthlyData();
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveDayData = async (dateStr: string, calls: number, surveys: number) => {
    setSaving(true);
    try {
      const { data: existingData } = await supabase
        .from("daily_survey_calls")
        .select("id")
        .eq("user_id", userId)
        .eq("call_date", dateStr)
        .maybeSingle();

      if (existingData?.id) {
        const { error } = await supabase
          .from("daily_survey_calls")
          .update({ total_calls: calls, surveys_sent: surveys })
          .eq("id", existingData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("daily_survey_calls")
          .insert({ user_id: userId, call_date: dateStr, total_calls: calls, surveys_sent: surveys });
        if (error) throw error;
      }
      await loadMonthlyData();
      toast.success("Saved!");
      setEditingDay(null);
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!initializedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => { autoSave(todayData); }, 1000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [todayData.total_calls, todayData.surveys_sent]);

  const formatDayDisplay = (dateStr: string) => {
    const parts = dateStr.split("-");
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  };

  const { avgCalls, score: prodScore, totalCalls: prodTotalCalls, recordedDays, callsPerDay100, callsNeeded100, days: remDays } = productivityMetrics;

  return (
    <Card className="p-4 border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Calls & Surveys Hub
        </h3>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                Full Month
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Monthly Data - {selectedMonth + 1}/{selectedYear}
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-auto flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Date</TableHead>
                      <TableHead className="text-center">Calls</TableHead>
                      <TableHead className="text-center">Surveys</TableHead>
                      <TableHead className="text-center">Rate</TableHead>
                      <TableHead className="text-center">Gap</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allDaysOfMonth.map((dateStr) => {
                      const dayData = monthlyDataMap[dateStr];
                      const calls = dayData?.total_calls || 0;
                      const surveys = dayData?.surveys_sent || 0;
                      const rate = calls > 0 ? (surveys / calls) * 100 : 0;
                      const required = Math.ceil(calls * 0.85);
                      const gap = surveys - required;
                      const isEditing = editingDay?.date === dateStr;

                      return (
                        <TableRow key={dateStr} className={calls === 0 ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{formatDayDisplay(dateStr)}</TableCell>
                          <TableCell className="text-center">
                            {isEditing ? (
                              <Input type="number" min={0} value={editingDay.calls}
                                onChange={(e) => setEditingDay({ ...editingDay, calls: parseInt(e.target.value) || 0 })}
                                className="w-20 h-8 text-center mx-auto" />
                            ) : calls}
                          </TableCell>
                          <TableCell className="text-center">
                            {isEditing ? (
                              <Input type="number" min={0} value={editingDay.surveys}
                                onChange={(e) => setEditingDay({ ...editingDay, surveys: parseInt(e.target.value) || 0 })}
                                className="w-20 h-8 text-center mx-auto" />
                            ) : surveys}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={rate >= 85 ? "text-green-500 font-medium" : rate > 0 ? "text-orange-500" : "text-muted-foreground"}>
                              {rate.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {calls > 0 ? (
                              <span className={gap >= 0 ? "text-green-500" : "text-red-500"}>{gap}</span>
                            ) : <span className="text-muted-foreground">0</span>}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-green-500"
                                  onClick={() => saveDayData(dateStr, editingDay.calls, editingDay.surveys)} disabled={saving}>✓</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500"
                                  onClick={() => setEditingDay(null)}>✕</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                onClick={() => setEditingDay({ date: dateStr, calls, surveys })}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Productivity KPI Banner */}
      <div className={`rounded-lg p-3 mb-4 border ${prodScore >= 75 ? "bg-green-500/5 border-green-500/20" : prodScore >= 50 ? "bg-yellow-500/5 border-yellow-500/20" : "bg-destructive/5 border-destructive/20"}`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Productivity KPI</span>
            <Badge variant="outline" className="text-[10px] h-5">50% weight</Badge>
          </div>
          <span className={`text-lg font-bold ${getScoreColor(prodScore)}`}>{prodScore}%</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{avgCalls.toFixed(1)} calls/day</span>
          <span>•</span>
          <span>{prodTotalCalls} total / {recordedDays} days</span>
          {prodScore < 100 && recordedDays > 0 && (
            <>
              <span>•</span>
              <span className="text-primary font-medium">Need {callsPerDay100}/day → 100%</span>
            </>
          )}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
          <span>{"<26: 0%"}</span>
          <span>26-28: 50%</span>
          <span>28-30: 75%</span>
          <span>30+: 100%</span>
        </div>
      </div>

      {/* Today's Input + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Today's Input */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            📅 Today ({todayStr})
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hub-total-calls" className="text-xs flex items-center gap-1">
                <Phone className="h-3 w-3" /> Total Calls
              </Label>
              <Input
                id="hub-total-calls"
                type="number"
                min={0}
                value={todayData.total_calls || ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setTodayData(prev => ({ ...prev, total_calls: isNaN(v) ? 0 : Math.max(0, v) }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hub-surveys-sent" className="text-xs flex items-center gap-1">
                <Send className="h-3 w-3" /> Surveys Sent
              </Label>
              <Input
                id="hub-surveys-sent"
                type="number"
                min={0}
                value={todayData.surveys_sent || ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setTodayData(prev => ({ ...prev, surveys_sent: isNaN(v) ? 0 : Math.max(0, v) }));
                }}
              />
            </div>
          </div>

          {/* Today's conversion stats */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Required (85%)</span>
              <span className="font-bold">{requiredSurveys}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Conversion</span>
              <span className={`font-bold ${isTodayMet ? "text-green-500" : "text-orange-500"}`}>
                {todayConversionRate.toFixed(1)}%
              </span>
            </div>
            <Progress value={Math.min(todayConversionRate, 100)} className="h-2" />
            <div className="flex items-center gap-1.5 text-xs">
              {isTodayMet ? (
                <><CheckCircle className="h-3.5 w-3.5 text-green-500" /><span className="text-green-500">Target met! ✨</span></>
              ) : todayData.total_calls > 0 ? (
                <><AlertTriangle className="h-3.5 w-3.5 text-orange-500" /><span className="text-orange-500">Need {requiredSurveys - todayData.surveys_sent} more surveys</span></>
              ) : (
                <span className="text-muted-foreground">Enter today's calls</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Monthly Summary */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Monthly Summary
          </h4>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-xl font-bold text-foreground">{monthlyTotalCalls}</div>
                <div className="text-[10px] text-muted-foreground">Total Calls</div>
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{monthlyTotalSurveys}</div>
                <div className="text-[10px] text-muted-foreground">Surveys Sent</div>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-muted-foreground">Monthly Conversion</span>
                <span className={`font-bold text-lg ${isMonthlyMet ? "text-green-500" : "text-orange-500"}`}>
                  {monthlyConversionRate.toFixed(1)}%
                </span>
              </div>
              <Progress value={Math.min(monthlyConversionRate, 100)} className="h-2.5" />
              <div className="flex items-center gap-1.5 text-xs mt-1.5">
                {isMonthlyMet ? (
                  <><CheckCircle className="h-3.5 w-3.5 text-green-500" /><span className="text-green-500">Monthly target achieved! 🎉</span></>
                ) : monthlyTotalCalls > 0 ? (
                  <><AlertTriangle className="h-3.5 w-3.5 text-orange-500" /><span className="text-orange-500">Need {Math.ceil(monthlyTotalCalls * 0.85) - monthlyTotalSurveys} more surveys to reach 85%</span></>
                ) : (
                  <span className="text-muted-foreground">No data this month</span>
                )}
              </div>
            </div>
          </div>

          {monthlyData.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              📊 {monthlyData.length} days logged • {remDays} work days remaining
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default CallsSurveyHub;
