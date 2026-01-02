import { Card } from "@/components/ui/card";
import { TrendingUp, Target, Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";

interface MonthEndForecastProps {
  currentGood: number;
  currentBad: number;
  karmaBad: number;
  remainingWorkDays: number | undefined;
  previousMonthData?: {
    good: number;
    bad: number;
    karmaBad: number;
  } | null;
  dailyChanges: any[];
  selectedMonth: number;
  selectedYear: number;
}

export const MonthEndForecast = ({
  currentGood,
  currentBad,
  karmaBad,
  remainingWorkDays,
  previousMonthData,
  dailyChanges,
  selectedMonth,
  selectedYear,
}: MonthEndForecastProps) => {
  const forecast = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
    
    if (!isCurrentMonth) {
      // For past/future months, show actual data
      const totalGood = currentGood;
      const totalBad = currentBad;
      const totalKarma = totalGood + totalBad + karmaBad;
      const csat = (totalGood + totalBad) > 0 ? (totalGood / (totalGood + totalBad)) * 100 : 0;
      const karma = totalKarma > 0 ? (totalGood / totalKarma) * 100 : 0;
      
      return {
        isPastMonth: true,
        actualCsat: csat,
        actualKarma: karma,
      };
    }

    // Calculate daily averages from changes
    const dayStats: Record<string, { good: number; bad: number }> = {};
    
    dailyChanges.forEach((change: any) => {
      const isGood = change.field_name === 'good' || change.field_name === 'genesys_good';
      const isBad = change.field_name === 'bad' || change.field_name === 'genesys_bad' || change.field_name === 'karma_bad';
      const amount = Math.max(0, change.change_amount);
      const dateKey = change.change_date;

      if (!dayStats[dateKey]) dayStats[dateKey] = { good: 0, bad: 0 };
      if (isGood) dayStats[dateKey].good += amount;
      if (isBad) dayStats[dateKey].bad += amount;
    });

    const daysWithData = Object.keys(dayStats).length;
    const totalDailyGood = Object.values(dayStats).reduce((sum, d) => sum + d.good, 0);
    const totalDailyBad = Object.values(dayStats).reduce((sum, d) => sum + d.bad, 0);

    // Calculate averages
    const avgDailyGood = daysWithData > 0 ? totalDailyGood / daysWithData : 0;
    const avgDailyBad = daysWithData > 0 ? totalDailyBad / daysWithData : 0;

    // Use previous month data to weight the forecast
    let weightedAvgGood = avgDailyGood;
    let weightedAvgBad = avgDailyBad;

    if (previousMonthData && daysWithData < 7) {
      // If we have less than a week of data, blend with previous month
      const prevMonthDays = 20; // assume ~20 working days
      const prevDailyGood = previousMonthData.good / prevMonthDays;
      const prevDailyBad = (previousMonthData.bad + previousMonthData.karmaBad) / prevMonthDays;
      
      const currentWeight = Math.min(daysWithData / 7, 1);
      const prevWeight = 1 - currentWeight;
      
      weightedAvgGood = avgDailyGood * currentWeight + prevDailyGood * prevWeight;
      weightedAvgBad = avgDailyBad * currentWeight + prevDailyBad * prevWeight;
    }

    // Project end of month
    const remaining = remainingWorkDays ?? 0;
    const projectedGood = currentGood + Math.round(weightedAvgGood * remaining);
    const projectedBad = currentBad + Math.round(weightedAvgBad * remaining);
    const projectedKarmaBad = karmaBad; // Assume karma bad stays same

    // Calculate forecasted percentages
    const projectedTotal = projectedGood + projectedBad;
    const projectedKarmaTotal = projectedGood + projectedBad + projectedKarmaBad;
    
    const forecastCsat = projectedTotal > 0 ? (projectedGood / projectedTotal) * 100 : 0;
    const forecastKarma = projectedKarmaTotal > 0 ? (projectedGood / projectedKarmaTotal) * 100 : 0;

    // Current percentages
    const currentTotal = currentGood + currentBad;
    const currentKarmaTotal = currentGood + currentBad + karmaBad;
    const currentCsat = currentTotal > 0 ? (currentGood / currentTotal) * 100 : 0;
    const currentKarma = currentKarmaTotal > 0 ? (currentGood / currentKarmaTotal) * 100 : 0;

    // Calculate what's needed for targets
    const targets = [88, 90, 95];
    const neededForTargets = targets.map(target => {
      const neededGood = Math.ceil((target / 100) * projectedKarmaTotal);
      const additionalNeeded = Math.max(0, neededGood - projectedGood);
      const perDay = remaining > 0 ? Math.ceil(additionalNeeded / remaining) : additionalNeeded;
      
      return {
        target,
        neededTotal: neededGood,
        additionalNeeded,
        perDay,
        isAchievable: additionalNeeded <= remaining * 10, // assume max 10 good ratings per day
        willMeet: forecastKarma >= target,
      };
    });

    // Confidence level based on data points
    let confidence: 'low' | 'medium' | 'high' = 'low';
    if (daysWithData >= 10) confidence = 'high';
    else if (daysWithData >= 5) confidence = 'medium';

    return {
      isPastMonth: false,
      currentCsat,
      currentKarma,
      forecastCsat,
      forecastKarma,
      projectedGood,
      projectedBad,
      remainingDays: remaining,
      avgDailyGood: weightedAvgGood,
      avgDailyBad: weightedAvgBad,
      neededForTargets,
      confidence,
      daysWithData,
    };
  }, [currentGood, currentBad, karmaBad, remainingWorkDays, previousMonthData, dailyChanges, selectedMonth, selectedYear]);

  if (forecast.isPastMonth) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Month Results</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Final CSAT</p>
            <p className="text-2xl font-bold text-primary">{forecast.actualCsat?.toFixed(1)}%</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Final Karma</p>
            <p className="text-2xl font-bold text-primary">{forecast.actualKarma?.toFixed(1)}%</p>
          </div>
        </div>
      </Card>
    );
  }

  const getConfidenceColor = () => {
    switch (forecast.confidence) {
      case 'high': return 'text-success';
      case 'medium': return 'text-warning';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className="p-6 border-border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Month-end Forecast</h3>
        </div>
        <span className={`text-xs font-medium ${getConfidenceColor()}`}>
          {forecast.confidence?.toUpperCase()} confidence ({forecast.daysWithData} days data)
        </span>
      </div>

      {/* Current vs Forecast */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Current CSAT</p>
          <p className="text-xl font-bold text-foreground">{forecast.currentCsat?.toFixed(1)}%</p>
        </div>
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-xs text-muted-foreground">Forecast CSAT</p>
          <p className="text-xl font-bold text-primary">{forecast.forecastCsat?.toFixed(1)}%</p>
        </div>
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Current Karma</p>
          <p className="text-xl font-bold text-foreground">{forecast.currentKarma?.toFixed(1)}%</p>
        </div>
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-xs text-muted-foreground">Forecast Karma</p>
          <p className="text-xl font-bold text-primary">{forecast.forecastKarma?.toFixed(1)}%</p>
        </div>
      </div>

      {/* Projections */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Remaining Days</p>
          <p className="text-lg font-bold text-foreground">{forecast.remainingDays}</p>
        </div>
        <div className="text-center p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Avg Good/Day</p>
          <p className="text-lg font-bold text-success">+{forecast.avgDailyGood?.toFixed(1)}</p>
        </div>
        <div className="text-center p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Projected Good</p>
          <p className="text-lg font-bold text-primary">{forecast.projectedGood}</p>
        </div>
      </div>

      {/* Target Achievement */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Target Achievement</p>
        {forecast.neededForTargets?.map((targetInfo) => (
          <div key={targetInfo.target} className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">{targetInfo.target}% Target</span>
              </div>
              {targetInfo.willMeet ? (
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <CheckCircle className="h-3 w-3" /> On track
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-warning">
                  <AlertTriangle className="h-3 w-3" /> Need +{targetInfo.additionalNeeded} good
                </span>
              )}
            </div>
            <Progress 
              value={Math.min(100, (forecast.forecastKarma ?? 0) / targetInfo.target * 100)} 
              className="h-2"
            />
            {!targetInfo.willMeet && targetInfo.additionalNeeded > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Need ~{targetInfo.perDay} extra good ratings per day to reach {targetInfo.target}%
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
