import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Phone, SmilePlus, CalendarOff, Trophy, DollarSign } from "lucide-react";

interface PhoneBonusKPIProps {
  userId: string;
  selectedMonth: number;
  selectedYear: number;
  csatPercentage: number;
  totalSurveys?: number;
}

const getProductivityScore = (avg: number) => {
  if (avg >= 30) return 100;
  if (avg >= 28) return 75;
  if (avg >= 26) return 50;
  return 0;
};

const getCsatScore = (csat: number) => {
  if (csat >= 93) return 100;
  if (csat >= 90) return 75;
  if (csat >= 87) return 50;
  return 0;
};

const getAbsenceGate = (days: number) => {
  if (days <= 1) return 100;
  if (days === 2) return 75;
  return 0;
};

const getScoreColor = (score: number) => {
  if (score === 100) return "text-green-500";
  if (score === 75) return "text-yellow-500";
  if (score === 50) return "text-orange-500";
  return "text-destructive";
};

const getScoreBg = (score: number) => {
  if (score === 100) return "bg-green-500";
  if (score === 75) return "bg-yellow-500";
  if (score === 50) return "bg-orange-500";
  return "bg-destructive";
};

const getBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
  if (score >= 75) return "default";
  if (score >= 50) return "secondary";
  return "destructive";
};

export const PhoneBonusKPI = ({ userId, selectedMonth, selectedYear, csatPercentage, totalSurveys = 0 }: PhoneBonusKPIProps) => {
  const [totalCalls, setTotalCalls] = useState(0);
  const [recordedDays, setRecordedDays] = useState(0);
  const [absenceDays, setAbsenceDays] = useState(0);
  const [baseSalary, setBaseSalary] = useState<number | null>(null);
  const [taxRate, setTaxRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;
      setLoading(true);

      try {
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;

        // Load total calls from daily_survey_calls (only days with records)
        const { data: callsData } = await supabase
          .from('daily_survey_calls')
          .select('total_calls')
          .eq('user_id', userId)
          .gte('call_date', startDate)
          .lte('call_date', endDate);

        const validCallDays = (callsData || []).filter(r => (r.total_calls || 0) > 0);
        const calls = validCallDays.reduce((sum, r) => sum + (r.total_calls || 0), 0);
        setTotalCalls(calls);
        setRecordedDays(validCallDays.length);

        // Load shifts to count absence days
        const { data: shiftsData } = await supabase
          .from('daily_shifts')
          .select('is_off_day, absence_type')
          .eq('user_id', userId)
          .gte('shift_date', startDate)
          .lte('shift_date', endDate);

        const shifts = shiftsData || [];
        const absence = shifts.filter(s => 
          s.is_off_day && (s.absence_type === 'sick_leave' || s.absence_type === 'unexcused')
        ).length;

        setAbsenceDays(absence);

        // Load salary settings
        const { data: settings } = await supabase
          .from('user_settings')
          .select('base_salary, tax_rate')
          .eq('user_id', userId)
          .maybeSingle();

        if (settings) {
          setBaseSalary((settings as any).base_salary ?? null);
          setTaxRate((settings as any).tax_rate ?? null);
        }
      } catch (error) {
        console.error('Error loading KPI data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId, selectedMonth, selectedYear]);

  const avgDailyCalls = useMemo(() => recordedDays > 0 ? totalCalls / recordedDays : 0, [totalCalls, recordedDays]);
  const productivityScore = useMemo(() => getProductivityScore(avgDailyCalls), [avgDailyCalls]);
  const effectiveCsat = useMemo(() => totalSurveys === 0 ? 100 : csatPercentage, [totalSurveys, csatPercentage]);
  const csatScore = useMemo(() => getCsatScore(effectiveCsat), [effectiveCsat]);
  const absenceGate = useMemo(() => getAbsenceGate(absenceDays), [absenceDays]);
  
  const finalBonus = useMemo(() => {
    const base = (productivityScore * 0.5) + (csatScore * 0.5);
    return (base * absenceGate) / 100;
  }, [productivityScore, csatScore, absenceGate]);

  // KPI payout calculation
  const kpiPayout = useMemo(() => {
    if (baseSalary == null) return null;
    const kpiPool = baseSalary * 0.7;
    const grossBonus = kpiPool * (finalBonus / 100);
    const tax = taxRate != null ? taxRate / 100 : 0;
    const netBonus = grossBonus * (1 - tax);
    return { kpiPool, grossBonus, netBonus };
  }, [baseSalary, taxRate, finalBonus]);

  if (loading) {
    return (
      <Card className="p-6 border-border animate-pulse">
        <div className="h-40 bg-muted rounded" />
      </Card>
    );
  }

  return (
    <Card className="border-border animate-fade-in overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Trophy className="h-6 w-6 text-primary" />
          Phone Bonus KPI
          <Badge variant={getBadgeVariant(finalBonus)} className="ml-auto text-lg px-3 py-1">
            {finalBonus.toFixed(0)}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Productivity (50%) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Productivity</span>
              <Badge variant="outline" className="text-xs">50%</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {avgDailyCalls.toFixed(1)} calls/day ({totalCalls} total / {recordedDays} days)
              </span>
              <span className={`font-bold ${getScoreColor(productivityScore)}`}>
                {productivityScore}%
              </span>
            </div>
          </div>
          <div className="relative">
            <Progress value={productivityScore} className="h-3" />
            <div className={`absolute inset-0 h-3 rounded-full ${getScoreBg(productivityScore)} opacity-80 transition-all`}
              style={{ width: `${productivityScore}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{"<26: 0%"}</span>
            <span>26-28: 50%</span>
            <span>28-30: 75%</span>
            <span>30+: 100%</span>
          </div>
          {productivityScore < 100 && recordedDays > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              📈 Need <span className="font-bold text-primary">{Math.ceil((30 * recordedDays) - totalCalls)}</span> more calls to reach 100% (30 calls/day)
            </p>
          )}
        </div>

        {/* CSAT (50%) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SmilePlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">CSAT</span>
              <Badge variant="outline" className="text-xs">50%</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {effectiveCsat.toFixed(1)}%{totalSurveys === 0 ? ' (no surveys yet)' : ''}
              </span>
              <span className={`font-bold ${getScoreColor(csatScore)}`}>
                {csatScore}%
              </span>
            </div>
          </div>
          <div className="relative">
            <Progress value={csatScore} className="h-3" />
            <div className={`absolute inset-0 h-3 rounded-full ${getScoreBg(csatScore)} opacity-80 transition-all`}
              style={{ width: `${csatScore}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{"<87%: 0%"}</span>
            <span>87-90%: 50%</span>
            <span>90-93%: 75%</span>
            <span>93%+: 100%</span>
          </div>
        </div>

        {/* Absence Gate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Absence Gate</span>
              <Badge variant="outline" className="text-xs">Multiplier</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {absenceDays} absence day{absenceDays !== 1 ? 's' : ''}
              </span>
              <span className={`font-bold ${getScoreColor(absenceGate)}`}>
                ×{(absenceGate / 100).toFixed(2)}
              </span>
            </div>
          </div>
          <div className="relative">
            <Progress value={absenceGate} className="h-3" />
            <div className={`absolute inset-0 h-3 rounded-full ${getScoreBg(absenceGate)} opacity-80 transition-all`}
              style={{ width: `${absenceGate}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>3+ days: 0%</span>
            <span>2 days: 75%</span>
            <span>0-1 day: 100%</span>
          </div>
        </div>

        {/* Final Result */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Final = (Productivity×50% + CSAT×50%) × Absence Gate
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              ({productivityScore}×50% + {csatScore}×50%) × {absenceGate}%
            </span>
            <span className={`text-3xl font-bold ${getScoreColor(finalBonus)}`}>
              {finalBonus.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* KPI Payout */}
        {kpiPayout && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold">Estimated KPI Payout</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <p className="text-[10px] text-muted-foreground mb-1">KPI Pool (70%)</p>
                <p className="text-sm font-bold">{kpiPayout.kpiPool.toLocaleString()}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Gross Bonus</p>
                <p className="text-sm font-bold">{kpiPayout.grossBonus.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-primary/10 p-3 rounded-lg text-center border border-primary/20">
                <p className="text-[10px] text-muted-foreground mb-1">Net Bonus{taxRate != null ? ` (-${taxRate}%)` : ''}</p>
                <p className="text-lg font-bold text-primary">{kpiPayout.netBonus.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Based on base salary of {baseSalary?.toLocaleString()}{taxRate != null ? ` with ${taxRate}% tax` : ''}
            </p>
          </div>
        )}

        {!kpiPayout && (
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground text-center">
              💡 Set your base salary in Settings → Salary & KPI to see your estimated payout
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
