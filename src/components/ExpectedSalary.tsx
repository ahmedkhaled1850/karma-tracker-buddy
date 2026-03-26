import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Wallet, Bus, Wifi, Award, Languages, Gift, CalendarOff, Clock } from "lucide-react";
import { getLoyaltyBonusForMonth, getNextLoyaltyBonus } from "@/lib/loyalty";
import { fetchMonthlyPayrollData } from "@/lib/kpi";

interface ExpectedSalaryProps {
  userId: string;
  selectedMonth: number;
  selectedYear: number;
}

export const ExpectedSalary = ({ userId, selectedMonth, selectedYear }: ExpectedSalaryProps) => {
  const [settings, setSettings] = useState<{
    baseSalary: number | null;
    taxRate: number | null;
    kpiPercentage: number;
    transportAllowance: number;
    internetAllowance: number;
    seniorBonus: number;
    languageAllowance: number;
    salaryPaymentDay: number;
    salaryDelayMonths: number;
    kpiDelayMonths: number;
    employeeType: string | null;
    startMonth: string | null;
  }>({
    baseSalary: null,
    taxRate: null,
    kpiPercentage: 70,
    transportAllowance: 0,
    internetAllowance: 0,
    seniorBonus: 0,
    languageAllowance: 0,
    salaryPaymentDay: 27,
    salaryDelayMonths: 1,
    kpiDelayMonths: 2,
    employeeType: null,
    startMonth: null,
  });
  const [loading, setLoading] = useState(true);
  const [kpiScore, setKpiScore] = useState(0);
  const [workDays, setWorkDays] = useState(0);
  const [siteDays, setSiteDays] = useState(0);
  
  const [casualCount, setCasualCount] = useState(0);
  const [noShowCount, setNoShowCount] = useState(0);
  
  const [otData, setOtData] = useState({
    day: 0,
    night: 0,
    special: 0
  });

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('base_salary, tax_rate, kpi_percentage, transportation_allowance, internet_allowance, senior_bonus, language_allowance, salary_payment_day, salary_delay_months, kpi_delay_months, employee_type, start_month')
          .eq('user_id', userId)
          .maybeSingle();

        if (data) {
          const d = data as any;
          setSettings({
            baseSalary: d.base_salary ?? null,
            taxRate: d.tax_rate ?? null,
            kpiPercentage: d.kpi_percentage ?? 70,
            transportAllowance: d.transportation_allowance ?? 0,
            internetAllowance: d.internet_allowance ?? 0,
            seniorBonus: d.senior_bonus ?? 0,
            languageAllowance: d.language_allowance ?? 0,
            salaryPaymentDay: d.salary_payment_day ?? 27,
            salaryDelayMonths: d.salary_delay_months ?? 1,
            kpiDelayMonths: d.kpi_delay_months ?? 2,
            employeeType: d.employee_type ?? null,
            startMonth: d.start_month ?? null,
          });
          // KPI and Transport target month is strictly 1 month prior to the "Work Month"
          const varDate = new Date(selectedYear, selectedMonth - 1, 1);
          const varData = await fetchMonthlyPayrollData(userId, varDate.getFullYear(), varDate.getMonth());
          
          setKpiScore(varData.kpiScore);
          setWorkDays(varData.workDays);
          setSiteDays(varData.siteDays);
          
          setCasualCount(varData.casualCount);
          setNoShowCount(varData.noShowCount);

          setOtData({
            day: varData.otDay,
            night: varData.otNight,
            special: varData.otSpecial
          });
        }
      } catch (err) {
        console.error('Error loading salary settings:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const salary = useMemo(() => {
    if (settings.baseSalary == null) return null;

    const base = settings.baseSalary;
    const kpiPool = base * (settings.kpiPercentage / 100);
    const kpiBonus = kpiPool * (kpiScore / 100);
    
    const transportMonthly = settings.transportAllowance;
    const transport = workDays > 0 ? (transportMonthly / workDays) * siteDays : 0;
    
    const internet = settings.internetAllowance;
    const senior = settings.seniorBonus;
    const language = settings.languageAllowance;

    const dailyRate = base / 30;
    const deductionDays = (casualCount * 1) + (noShowCount * 3);
    const absenceDeduction = deductionDays * dailyRate;

    const loyaltyResult = getLoyaltyBonusForMonth(settings.employeeType, settings.startMonth, selectedYear, selectedMonth);
    const loyaltyBonus = loyaltyResult.hasBonus ? base * (loyaltyResult.percentage / 100) : 0;

    const hourlyRate = base / 30 / 8;
    const otPayoutDay = otData.day * hourlyRate * 1.35;
    const otPayoutNight = otData.night * hourlyRate * 1.70;
    const otPayoutSpecial = otData.special * hourlyRate * 3.00;
    const totalOT = otPayoutDay + otPayoutNight + otPayoutSpecial;

    const gross = base + kpiBonus + transport + internet + senior + language + loyaltyBonus + totalOT - absenceDeduction;
    const taxDeduction = settings.taxRate != null ? gross * (settings.taxRate / 100) : 0;
    const net = gross - taxDeduction;

    return { 
      base, kpiPool, kpiBonus, transport, internet, senior, language, 
      loyaltyBonus, loyaltyResult, absenceDeduction, deductionDays, 
      gross, taxDeduction, net, 
      otPayoutDay, otPayoutNight, otPayoutSpecial, totalOT, otHours: otData 
    };
  }, [settings, kpiScore, workDays, siteDays, casualCount, noShowCount, selectedYear, selectedMonth, otData]);

  const nextLoyaltyBonus = useMemo(() => {
    return getNextLoyaltyBonus(settings.employeeType, settings.startMonth, selectedYear, selectedMonth);
  }, [settings.employeeType, settings.startMonth, selectedYear, selectedMonth]);

  const payoutDateStr = useMemo(() => {
    // Payout is in the EXACT selected month
    const payoutMonth = new Date(selectedYear, selectedMonth, settings.salaryPaymentDay);
    return `${settings.salaryPaymentDay} ${payoutMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  }, [selectedYear, selectedMonth, settings.salaryPaymentDay]);

  const sourceMonths = useMemo(() => {
    const varDate = new Date(selectedYear, selectedMonth - 1, 1);
    const label = varDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return {
      kpi: label,
      transport: label,
    };
  }, [selectedYear, selectedMonth]);

  if (loading) {
    return (
      <Card className="border-border animate-pulse">
        <div className="p-6 h-32 bg-muted rounded" />
      </Card>
    );
  }

  if (!salary) {
    return (
      <Card className="border-border">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground text-center">
            💡 Set your salary details in Settings → Salary & KPI to see your expected salary
          </p>
        </CardContent>
      </Card>
    );
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <Card className="border-border animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-5 w-5 text-primary" />
            Expected Salary
          </div>
          <div className="text-sm font-normal text-muted-foreground bg-indigo-500/5 p-3 rounded-md border border-indigo-500/20 leading-relaxed">
            <p>
              🏦 <strong>Total payout expected on {payoutDateStr}</strong>
            </p>
            <ul className="mt-1.5 space-y-1 text-[13px] opacity-90">
              <li>• Base Salary (Fixed)</li>
              <li>• KPI Bonus drawn from <strong>{sourceMonths.kpi}</strong></li>
              <li>• Transportation drawn from <strong>{sourceMonths.transport}</strong></li>
            </ul>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Base & Components */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5 text-muted-foreground">
              <div className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5" />
                <span>Base Salary</span>
              </div>
            </div>
            <span className="font-medium text-foreground">{fmt(salary.base)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5 text-muted-foreground">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>KPI Bonus ({settings.kpiPercentage}% × {kpiScore.toFixed(1)}%)</span>
              </div>
              <span className="text-[10px] pl-5 opacity-70">Based on: {sourceMonths.kpi}</span>
            </div>
            <span className="font-medium text-primary">{fmt(salary.kpiBonus)}</span>
          </div>

          {salary.loyaltyBonus > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Gift className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    Loyalty Bonus ({salary.loyaltyResult.percentage}%)
                  </span>
                </div>
                <span className="text-[10px] pl-5 opacity-70 cursor-help" title="Based on your overall active timeline">
                  Hit milestone month!
                </span>
              </div>
              <span className="font-medium text-indigo-600 dark:text-indigo-400">+{fmt(salary.loyaltyBonus)}</span>
            </div>
          )}

          {settings.transportAllowance > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Bus className="h-3.5 w-3.5" />
                  <span>Transportation</span>
                </div>
                <span className="text-[10px] pl-5 opacity-70">
                  {fmt(settings.transportAllowance)} ÷ {workDays} days × {siteDays} site days
                  <br />
                  <span className="text-[9px] opacity-80">(Based on {sourceMonths.transport})</span>
                </span>
              </div>
              <span className="font-medium text-foreground">{fmt(salary.transport)}</span>
            </div>
          )}

          {salary.totalOT > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5 text-success">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Overtime Earnings</span>
                </div>
                <span className="text-[10px] pl-5 opacity-70">
                  {salary.otHours.day > 0 && `${salary.otHours.day}h Day (1.35x) `}
                  {salary.otHours.night > 0 && `${salary.otHours.night}h Night (1.70x) `}
                  {salary.otHours.special > 0 && `${salary.otHours.special}h Spec (3x) `}
                </span>
              </div>
              <span className="font-medium text-success">+{fmt(salary.totalOT)}</span>
            </div>
          )}

          {salary.absenceDeduction > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5 text-rose-500/80">
                <div className="flex items-center gap-2">
                  <CalendarOff className="h-3.5 w-3.5" />
                  <span>Absence Deductions ({salary.deductionDays} days)</span>
                </div>
                <span className="text-[10px] pl-5 opacity-70">
                  {casualCount > 0 && `${casualCount}x Casual `}
                  {noShowCount > 0 && `${noShowCount}x No-Show`}
                  <br />
                  <span className="text-[9px] opacity-80">(Based on {sourceMonths.transport})</span>
                </span>
              </div>
              <span className="font-medium text-rose-500">-{fmt(salary.absenceDeduction)}</span>
            </div>
          )}

          {salary.internet > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wifi className="h-3.5 w-3.5" />
                <span>Internet</span>
              </div>
              <span className="font-medium">{fmt(salary.internet)}</span>
            </div>
          )}

          {salary.senior > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Award className="h-3.5 w-3.5" />
                <span>Senior Bonus</span>
              </div>
              <span className="font-medium">{fmt(salary.senior)}</span>
            </div>
          )}

          {salary.language > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Languages className="h-3.5 w-3.5" />
                <span>Language Allowance</span>
              </div>
              <span className="font-medium">{fmt(salary.language)}</span>
            </div>
          )}
        </div>

        {/* Gross */}
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Gross Total</span>
            <span className="font-bold">{fmt(salary.gross)}</span>
          </div>
          {settings.taxRate != null && settings.taxRate > 0 && (
            <div className="flex items-center justify-between text-sm text-destructive mt-1">
              <span>Tax & Insurance ({settings.taxRate}%)</span>
              <span>-{fmt(salary.taxDeduction)}</span>
            </div>
          )}
        </div>

        {/* Net */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Net Expected Salary</span>
            <span className="text-2xl font-bold text-primary">{fmt(salary.net)}</span>
          </div>
        </div>

        {/* Next Loyalty Bonus Alert */}
        {nextLoyaltyBonus && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 mt-4 flex items-start gap-3">
            <Gift className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
            <div className="space-y-1 relative w-full">
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                Next Loyalty Bonus: {nextLoyaltyBonus.dateStr}
              </p>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                {nextLoyaltyBonus.monthsAway === 0 ? "This month! 🎉" : `${nextLoyaltyBonus.monthsAway} month(s) away`}
                {' '}— Expected Amount: {settings.baseSalary ? fmt(settings.baseSalary * (nextLoyaltyBonus.percentage / 100)) : 'Unknown'} ({nextLoyaltyBonus.percentage}%)
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
