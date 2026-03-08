import { Card } from "@/components/ui/card";

interface PercentageDisplayProps {
  title: string;
  percentage: number;
  subtitle?: string;
}

export const PercentageDisplay = ({ title, percentage, subtitle }: PercentageDisplayProps) => {
  const getColor = () => {
    if (percentage >= 95) return { ring: "stroke-success", text: "text-success", bg: "bg-success/10" };
    if (percentage >= 88) return { ring: "stroke-primary", text: "text-primary", bg: "bg-primary/10" };
    return { ring: "stroke-warning", text: "text-warning", bg: "bg-warning/10" };
  };

  const color = getColor();
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <Card className="p-5 bg-card hover:shadow-elegant transition-all duration-300 border border-border">
      <div className="flex items-center gap-4">
        {/* Circular Progress */}
        <div className="relative flex-shrink-0">
          <svg width="80" height="80" viewBox="0 0 100 100" className="-rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              className={color.ring}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold ${color.text}`}>{percentage.toFixed(0)}%</span>
          </div>
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold mt-0.5 ${color.text}`}>
            {percentage.toFixed(1)}%
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </Card>
  );
};
