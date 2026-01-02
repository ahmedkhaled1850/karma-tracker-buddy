import { Card } from "@/components/ui/card";
import { Clock, TrendingUp, Calendar, Star } from "lucide-react";
import { useMemo } from "react";

interface DailyChange {
  id: string;
  change_date: string;
  change_time: string | null;
  field_name: string;
  change_amount: number;
  created_at: string;
}

interface BestProductiveTimeProps {
  changes: DailyChange[];
}

interface HourStats {
  hour: number;
  goodCount: number;
  totalCount: number;
  label: string;
}

interface DayStats {
  day: string;
  dayName: string;
  goodCount: number;
  totalCount: number;
  successRate: number;
}

export const BestProductiveTime = ({ changes }: BestProductiveTimeProps) => {
  const analysis = useMemo(() => {
    if (!changes || changes.length === 0) {
      return null;
    }

    // Analyze by hour
    const hourStats: Record<number, { good: number; bad: number; total: number }> = {};
    // Analyze by day of week
    const dayOfWeekStats: Record<number, { good: number; total: number }> = {};
    // Analyze by specific date
    const dateStats: Record<string, { good: number; bad: number }> = {};

    changes.forEach((change) => {
      const isGood = change.field_name === 'good' || change.field_name === 'genesys_good';
      const isBad = change.field_name === 'bad' || change.field_name === 'genesys_bad' || change.field_name === 'karma_bad';
      const amount = Math.max(0, change.change_amount);

      if (amount === 0) return;

      // Get time from change_time or created_at
      let hour = 12; // default
      if (change.change_time) {
        hour = parseInt(change.change_time.split(':')[0], 10);
      } else if (change.created_at) {
        hour = new Date(change.created_at).getHours();
      }

      // Get day of week
      const date = new Date(change.change_date);
      const dayOfWeek = date.getDay();

      // Update hour stats
      if (!hourStats[hour]) hourStats[hour] = { good: 0, bad: 0, total: 0 };
      if (isGood) hourStats[hour].good += amount;
      if (isBad) hourStats[hour].bad += amount;
      hourStats[hour].total += amount;

      // Update day of week stats
      if (!dayOfWeekStats[dayOfWeek]) dayOfWeekStats[dayOfWeek] = { good: 0, total: 0 };
      if (isGood) dayOfWeekStats[dayOfWeek].good += amount;
      dayOfWeekStats[dayOfWeek].total += amount;

      // Update date stats
      const dateKey = change.change_date;
      if (!dateStats[dateKey]) dateStats[dateKey] = { good: 0, bad: 0 };
      if (isGood) dateStats[dateKey].good += amount;
      if (isBad) dateStats[dateKey].bad += amount;
    });

    // Find best hours (top 3)
    const bestHours: HourStats[] = Object.entries(hourStats)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        goodCount: stats.good,
        totalCount: stats.total,
        label: `${parseInt(hour).toString().padStart(2, '0')}:00`,
      }))
      .filter(h => h.goodCount > 0)
      .sort((a, b) => b.goodCount - a.goodCount)
      .slice(0, 3);
    
    const worstHours: HourStats[] = Object.entries(hourStats)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        goodCount: stats.bad,
        totalCount: stats.total,
        label: `${parseInt(hour).toString().padStart(2, '0')}:00`,
      }))
      .filter(h => h.goodCount > 0)
      .sort((a, b) => b.goodCount - a.goodCount)
      .slice(0, 3);

    // Find best days of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const bestDaysOfWeek: DayStats[] = Object.entries(dayOfWeekStats)
      .map(([day, stats]) => ({
        day,
        dayName: dayNames[parseInt(day)],
        goodCount: stats.good,
        totalCount: stats.total,
        successRate: stats.total > 0 ? (stats.good / stats.total) * 100 : 0,
      }))
      .filter(d => d.goodCount > 0)
      .sort((a, b) => b.goodCount - a.goodCount)
      .slice(0, 3);

    // Find best dates in the month
    const bestDates = Object.entries(dateStats)
      .map(([date, stats]) => ({
        date,
        good: stats.good,
        bad: stats.bad,
        total: stats.good + stats.bad,
        successRate: (stats.good + stats.bad) > 0 ? (stats.good / (stats.good + stats.bad)) * 100 : 0,
      }))
      .filter(d => d.good > 0)
      .sort((a, b) => b.good - a.good)
      .slice(0, 5);

    return {
      bestHours,
      bestDaysOfWeek,
      bestDates,
      totalGoodRatings: Object.values(hourStats).reduce((sum, h) => sum + h.good, 0),
      worstHours,
    };
  }, [changes]);

  if (!analysis) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Best Productive Time</h3>
        </div>
        <p className="text-sm text-muted-foreground">Not enough data to analyze. Add more ratings to see patterns.</p>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });
  };

  return (
    <Card className="p-6 border-border">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Best Productive Time</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Best Hours */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Best CSAT Hours</span>
          </div>
          {analysis.bestHours.length > 0 ? (
            <div className="space-y-2">
              {analysis.bestHours.map((hour, idx) => (
                <div 
                  key={hour.hour} 
                  className={`p-3 rounded-lg ${idx === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{hour.label}</span>
                    <span className="text-sm text-primary font-bold">+{hour.goodCount} good</span>
                  </div>
                  {idx === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Your peak productivity hour</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet</p>
          )}
        </div>

        {/* Worst Hours (DSAT) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-destructive" />
            <span>Top DSAT Hours</span>
          </div>
          {analysis.worstHours.length > 0 ? (
            <div className="space-y-2">
              {analysis.worstHours.map((hour, idx) => (
                <div 
                  key={hour.hour} 
                  className={`p-3 rounded-lg ${idx === 0 ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{hour.label}</span>
                    <span className="text-sm text-destructive font-bold">+{hour.goodCount} bad</span>
                  </div>
                  {idx === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Highest DSAT hour</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet</p>
          )}
        </div>

        {/* Best Days of Week */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Best Days of Week</span>
          </div>
          {analysis.bestDaysOfWeek.length > 0 ? (
            <div className="space-y-2">
              {analysis.bestDaysOfWeek.map((day, idx) => (
                <div 
                  key={day.day} 
                  className={`p-3 rounded-lg ${idx === 0 ? 'bg-success/10 border border-success/20' : 'bg-muted'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{day.dayName}</span>
                    <span className="text-sm text-success font-bold">+{day.goodCount} good</span>
                  </div>
                  {idx === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Your best performing day</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet</p>
          )}
        </div>

        {/* Best Dates in Month */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Star className="h-4 w-4" />
            <span>Top Days This Month</span>
          </div>
          {analysis.bestDates.length > 0 ? (
            <div className="space-y-2">
              {analysis.bestDates.slice(0, 3).map((dateInfo, idx) => (
                <div 
                  key={dateInfo.date} 
                  className={`p-3 rounded-lg ${idx === 0 ? 'bg-warning/10 border border-warning/20' : 'bg-muted'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{formatDate(dateInfo.date)}</span>
                    <span className="text-sm text-warning font-bold">+{dateInfo.good} good</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dateInfo.successRate.toFixed(0)}% success rate
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet</p>
          )}
        </div>
      </div>

      {/* Summary */}
      {analysis.bestHours.length > 0 && analysis.bestDaysOfWeek.length > 0 && (
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-foreground">
            <strong>Summary:</strong> You perform best around <strong>{analysis.bestHours[0]?.label}</strong> on <strong>{analysis.bestDaysOfWeek[0]?.dayName}s</strong>. 
            Schedule important tasks during these times for optimal results.
          </p>
        </div>
      )}
    </Card>
  );
};
