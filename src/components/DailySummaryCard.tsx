import { Card } from "@/components/ui/card";
import { Clock, Target, Zap, CheckCircle2 } from "lucide-react";

interface DailySummaryCardProps {
  todayGood: number;
  todayBad: number;
  dailyTarget: number;
  shiftTimeLeft: string;
  shiftLabel: string;
}

export const DailySummaryCard = ({
  todayGood,
  todayBad,
  dailyTarget,
  shiftTimeLeft,
  shiftLabel,
}: Omit<DailySummaryCardProps, 'karma'>) => {
  const remaining = Math.max(0, Math.ceil(dailyTarget) - todayGood);
  const progress = dailyTarget > 0 ? Math.min(100, (todayGood / dailyTarget) * 100) : 100;
  const isComplete = remaining <= 0;

  return (
    <Card className="p-4 bg-gradient-hero border border-primary/15 overflow-hidden relative">
      {/* Subtle background accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl" />
      
      <div className="relative grid grid-cols-3 gap-3">
        {/* Today's Ratings */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="h-3.5 w-3.5 text-success" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Today</span>
          </div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-2xl font-bold text-success tabular-nums">{todayGood}</span>
            {todayBad > 0 && (
              <span className="text-sm text-destructive font-medium">-{todayBad}</span>
            )}
          </div>
        </div>

        {/* Remaining Target */}
        <div className="text-center border-x border-border/50 px-2">
          <div className="flex items-center justify-center gap-1 mb-1">
            {isComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <Target className="h-3.5 w-3.5 text-primary" />
            )}
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {isComplete ? "Done!" : "Left"}
            </span>
          </div>
          <span className={`text-2xl font-bold tabular-nums ${isComplete ? "text-success" : "text-primary"}`}>
            {isComplete ? "✓" : remaining}
          </span>
        </div>

        {/* Shift Timer */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="h-3.5 w-3.5 text-warning" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
              {shiftLabel || "Shift"}
            </span>
          </div>
          <span className="text-lg font-bold font-mono text-warning tabular-nums">
            {shiftTimeLeft || "--:--"}
          </span>
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-success" : "bg-primary"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </Card>
  );
};
