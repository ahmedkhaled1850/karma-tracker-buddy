import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Wallet, Bus, Wifi, Award } from "lucide-react";

interface ExpectedSalaryProps {
  userId: string;
  kpiScore: number;
}

export const ExpectedSalary = ({ userId, kpiScore }: ExpectedSalaryProps) => {
  const [settings, setSettings] = useState<{
    baseSalary: number | null;
    taxRate: number | null;
    kpiPercentage: number;
    transportAllowance: number;
    internetAllowance: number;
    seniorBonus: number;
    languageAllowance: number;
  }>({
    baseSalary: null,
    taxRate: null,
    kpiPercentage: 70,
    transportAllowance: 0,
    internetAllowance: 0,
    seniorBonus: 0,
    languageAllowance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('base_salary, tax_rate, kpi_percentage, transportation_allowance, internet_allowance, senior_bonus, language_allowance')
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
    const transport = settings.transportAllowance;
    const internet = settings.internetAllowance;
    const senior = settings.seniorBonus;
    const language = settings.languageAllowance;

    const gross = base + kpiBonus + transport + internet + senior + language;
    const taxDeduction = settings.taxRate != null ? gross * (settings.taxRate / 100) : 0;
    const net = gross - taxDeduction;

    return { base, kpiPool, kpiBonus, transport, internet, senior, language, gross, taxDeduction, net };
  }, [settings, kpiScore]);

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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-primary" />
          Expected Salary
          <Badge variant="outline" className="ml-auto text-xs">
            KPI: {kpiScore}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Breakdown rows */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span>Base Salary</span>
            </div>
            <span className="font-medium">{fmt(salary.base)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>KPI Bonus ({settings.kpiPercentage}% × {kpiScore}%)</span>
            </div>
            <span className="font-medium text-primary">{fmt(salary.kpiBonus)}</span>
          </div>

          {salary.transport > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Bus className="h-3.5 w-3.5" />
                <span>Transportation</span>
              </div>
              <span className="font-medium">{fmt(salary.transport)}</span>
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
      </CardContent>
    </Card>
  );
};
