import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface PercentageDisplayProps {
  title: string;
  percentage: number;
  subtitle?: string;
}

export const PercentageDisplay = ({ title, percentage, subtitle }: PercentageDisplayProps) => {
  const getColor = () => {
    if (percentage >= 95) return { 
      ring: "stroke-success", text: "text-success", bg: "bg-success/10",
      border: "border-success/20", icon: TrendingUp, iconColor: "text-success"
    };
    if (percentage >= 88) return { 
      ring: "stroke-primary", text: "text-primary", bg: "bg-primary/10",
      border: "border-primary/20", icon: Activity, iconColor: "text-primary"
    };
    return { 
      ring: "stroke-warning", text: "text-warning", bg: "bg-warning/10",
      border: "border-warning/20", icon: TrendingDown, iconColor: "text-warning"
    };
  };

  const color = getColor();
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  const StatusIcon = color.icon;

  return (
    <Card className={`p-4 bg-card border ${color.border} hover:shadow-elegant transition-all duration-300`}>
      <div className="flex items-center gap-3">
        {/* Circular Progress - compact */}
        <div className="relative flex-shrink-0">
          <svg width="64" height="64" viewBox="0 0 80 80" className="-rotate-90">
            <circle cx="40" cy="40" r="36" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
            <circle
              cx="40" cy="40" r="36" fill="none"
              className={color.ring}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-bold tabular-nums ${color.text}`}>{percentage.toFixed(0)}%</span>
          </div>
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <StatusIcon className={`h-3.5 w-3.5 ${color.iconColor}`} />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          </div>
          <p className={`text-xl font-bold ${color.text} tabular-nums`}>
            {percentage.toFixed(1)}%
          </p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </Card>
  );
};
