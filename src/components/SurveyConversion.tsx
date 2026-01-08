import { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Phone, Send, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SurveyConversionProps {
  userId: string;
  selectedMonth: number;
  selectedYear: number;
}

interface DailySurveyData {
  id?: string;
  call_date: string;
  total_calls: number;
  surveys_sent: number;
}

const SurveyConversion = ({ userId, selectedMonth, selectedYear }: SurveyConversionProps) => {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [todayData, setTodayData] = useState<DailySurveyData>({
    call_date: todayStr,
    total_calls: 0,
    surveys_sent: 0,
  });
  const [monthlyData, setMonthlyData] = useState<DailySurveyData[]>([]);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

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
  useEffect(() => {
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

    if (userId) loadMonthlyData();
  }, [userId, selectedMonth, selectedYear]);

  // Calculate metrics
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

  // Auto-save function
  const autoSave = async (dataToSave: DailySurveyData) => {
    if (saving) return;
    setSaving(true);
    try {
      if (dataToSave.id) {
        const { error } = await supabase
          .from("daily_survey_calls")
          .update({
            total_calls: dataToSave.total_calls,
            surveys_sent: dataToSave.surveys_sent,
          })
          .eq("id", dataToSave.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("daily_survey_calls")
          .insert({
            user_id: userId,
            call_date: todayStr,
            total_calls: dataToSave.total_calls,
            surveys_sent: dataToSave.surveys_sent,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setTodayData(prev => ({ ...prev, id: data.id }));
        }
      }
      
      // Refresh monthly data
      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
      const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-31`;
      const { data: refreshed } = await supabase
        .from("daily_survey_calls")
        .select("*")
        .eq("user_id", userId)
        .gte("call_date", startDate)
        .lte("call_date", endDate)
        .order("call_date", { ascending: true });
      if (refreshed) setMonthlyData(refreshed);

    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save on data change (debounced)
  useEffect(() => {
    if (!initializedRef.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(todayData);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [todayData.total_calls, todayData.surveys_sent]);

  return (
    <Card className="p-6 border-border bg-card shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Survey Conversion (85% Target)
        </h3>
        {saving && (
          <span className="text-sm text-muted-foreground animate-pulse">Saving...</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            📅 Today ({todayStr})
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total-calls" className="text-xs flex items-center gap-1">
                <Phone className="h-3 w-3" /> Total Calls
              </Label>
              <Input
                id="total-calls"
                type="number"
                min={0}
                value={todayData.total_calls || ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setTodayData(prev => ({ ...prev, total_calls: isNaN(v) ? 0 : Math.max(0, v) }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surveys-sent" className="text-xs flex items-center gap-1">
                <Send className="h-3 w-3" /> Surveys Sent
              </Label>
              <Input
                id="surveys-sent"
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

          {/* Today's Stats */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Required (85%)</span>
              <span className="font-bold text-lg">{requiredSurveys}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Your Conversion</span>
              <span className={`font-bold text-lg ${isTodayMet ? "text-green-500" : "text-orange-500"}`}>
                {todayConversionRate.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={Math.min(todayConversionRate, 100)} 
              className="h-2"
            />
            <div className="flex items-center gap-2 text-sm">
              {isTodayMet ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">Target met! ✨</span>
                </>
              ) : todayData.total_calls > 0 ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-orange-500">
                    Need {requiredSurveys - todayData.surveys_sent} more surveys
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Enter today's calls</span>
              )}
            </div>
          </div>
        </div>

        {/* Monthly Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Monthly Summary ({selectedMonth + 1}/{selectedYear})
          </h4>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">{monthlyTotalCalls}</div>
                <div className="text-xs text-muted-foreground">Total Calls</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{monthlyTotalSurveys}</div>
                <div className="text-xs text-muted-foreground">Surveys Sent</div>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Monthly Conversion</span>
                <span className={`font-bold text-xl ${isMonthlyMet ? "text-green-500" : "text-orange-500"}`}>
                  {monthlyConversionRate.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={Math.min(monthlyConversionRate, 100)} 
                className="h-3"
              />
              <div className="flex items-center gap-2 text-sm mt-2">
                {isMonthlyMet ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">Monthly target achieved! 🎉</span>
                  </>
                ) : monthlyTotalCalls > 0 ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-orange-500">
                      Need {Math.ceil(monthlyTotalCalls * 0.85) - monthlyTotalSurveys} more surveys to reach 85%
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No data this month</span>
                )}
              </div>
            </div>
          </div>

          {/* Days logged */}
          {monthlyData.length > 0 && (
            <div className="text-xs text-muted-foreground">
              📊 {monthlyData.length} days logged this month
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default SurveyConversion;