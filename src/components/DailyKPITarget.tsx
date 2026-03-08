import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Target, Phone, SmilePlus, ArrowUp } from "lucide-react";

interface DailyKPITargetProps {
  userId: string;
  selectedMonth: number;
  selectedYear: number;
  csatPercentage: number;
  totalGood: number;
  totalSurveys: number;
  remainingWorkDays?: number;
  kpiScore: number;
}

export const DailyKPITarget = ({
  userId,
  selectedMonth,
  selectedYear,
  csatPercentage,
  totalGood,
  totalSurveys,
  remainingWorkDays,
  kpiScore,
}: DailyKPITargetProps) => {
  const [totalCalls, setTotalCalls] = useState(0);
  const [recordedDays, setRecordedDays] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;

        const { data } = await supabase
          .from('daily_survey_calls')
          .select('total_calls')
          .eq('user_id', userId)
          .gte('call_date', startDate)
          .lte('call_date', endDate);

        const valid = (data || []).filter(r => (r.total_calls || 0) > 0);
        setTotalCalls(valid.reduce((s, r) => s + (r.total_calls || 0), 0));
        setRecordedDays(valid.length);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, selectedMonth, selectedYear]);

  const avgCalls = useMemo(() => recordedDays > 0 ? totalCalls / recordedDays : 0, [totalCalls, recordedDays]);
  
  // What's needed today for each KPI component
  const targets = useMemo(() => {
    const days = remainingWorkDays ?? 1;
    
    // Calls needed for 100% productivity (30/day avg)
    const totalDays = recordedDays + days;
    const callsNeeded100 = Math.max(0, Math.ceil(30 * totalDays - totalCalls));
    const callsPerDay100 = Math.ceil(callsNeeded100 / Math.max(1, days));
    
    // Calls needed for 75% productivity (28/day avg)
    const callsNeeded75 = Math.max(0, Math.ceil(28 * totalDays - totalCalls));
    const callsPerDay75 = Math.ceil(callsNeeded75 / Math.max(1, days));

    // Good ratings needed for 93% CSAT (100% score)
    const goodNeeded93 = totalSurveys > 0 
      ? Math.max(0, Math.ceil((0.93 * totalSurveys - totalGood) / (1 - 0.93)))
      : 0;
    const goodPerDay93 = Math.ceil(goodNeeded93 / Math.max(1, days));

    // Good ratings needed for 90% CSAT (75% score)
    const goodNeeded90 = totalSurveys > 0 
      ? Math.max(0, Math.ceil((0.90 * totalSurveys - totalGood) / (1 - 0.90)))
      : 0;
    const goodPerDay90 = Math.ceil(goodNeeded90 / Math.max(1, days));

    // Determine which target to show
    const isCallsAt100 = avgCalls >= 30;
    const isCallsAt75 = avgCalls >= 28;
    const isCsatAt100 = csatPercentage >= 93;
    const isCsatAt75 = csatPercentage >= 90;

    return {
      callsPerDay: isCallsAt100 ? 30 : (isCallsAt75 ? callsPerDay100 : callsPerDay75),
      callsLabel: isCallsAt100 ? "Maintain 30+" : (isCallsAt75 ? `${callsPerDay100}/day → 100%` : `${callsPerDay75}/day → 75%`),
      callsHit: isCallsAt100,
      goodPerDay: isCsatAt100 ? 0 : (isCsatAt75 ? goodPerDay93 : goodPerDay90),
      goodLabel: isCsatAt100 ? "CSAT ✓ 93%+" : (isCsatAt75 ? `${goodPerDay93}/day → 93%` : `${goodPerDay90}/day → 90%`),
      csatHit: isCsatAt100,
      days,
    };
  }, [totalCalls, recordedDays, avgCalls, csatPercentage, totalGood, totalSurveys, remainingWorkDays]);

  if (loading) return null;

  const allHit = targets.callsHit && targets.csatHit;

  return (
    <Card className={`p-3 border-border/60 overflow-hidden ${allHit ? "bg-success/5 border-success/20" : "bg-card/80 backdrop-blur-sm"}`}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <Target className={`h-4 w-4 ${allHit ? "text-success" : "text-primary"}`} />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Daily KPI Target
        </span>
        {allHit && <span className="text-xs text-success font-bold ml-auto">All targets hit! 🎉</span>}
        {!allHit && targets.days > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto">{targets.days} work days left</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Calls target */}
        <div className={`rounded-lg p-2.5 ${targets.callsHit ? "bg-success/10 border border-success/20" : "bg-muted/40"}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <Phone className={`h-3.5 w-3.5 ${targets.callsHit ? "text-success" : "text-primary"}`} />
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Calls</span>
          </div>
          <p className={`text-sm font-bold ${targets.callsHit ? "text-success" : "text-foreground"}`}>
            {targets.callsLabel}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Current: {avgCalls.toFixed(1)}/day
          </p>
        </div>

        {/* CSAT target */}
        <div className={`rounded-lg p-2.5 ${targets.csatHit ? "bg-success/10 border border-success/20" : "bg-muted/40"}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <SmilePlus className={`h-3.5 w-3.5 ${targets.csatHit ? "text-success" : "text-primary"}`} />
            <span className="text-[10px] font-bold uppercase text-muted-foreground">CSAT</span>
          </div>
          <p className={`text-sm font-bold ${targets.csatHit ? "text-success" : "text-foreground"}`}>
            {targets.goodLabel}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Current: {csatPercentage.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Motivation line */}
      {!allHit && kpiScore > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <ArrowUp className="h-3 w-3 text-primary" />
          <span>
            Hit both targets daily to push KPI from <span className="font-bold text-foreground">{kpiScore.toFixed(0)}%</span> → <span className="font-bold text-primary">100%</span>
          </span>
        </div>
      )}
    </Card>
  );
};
