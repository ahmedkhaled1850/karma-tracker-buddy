import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface PercentageDisplayProps {
  title: string;
  percentage: number;
  subtitle?: string;
}

export const PercentageDisplay = ({ title, percentage, subtitle }: PercentageDisplayProps) => {
  const getColorClass = () => {
    if (percentage >= 95) return "text-success";
    if (percentage >= 88) return "text-primary";
    return "text-warning";
  };

  return (
    <Card className="p-6 bg-card hover:shadow-md transition-all duration-300 border border-border">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className={`text-5xl font-bold ${getColorClass()}`}>
            {percentage.toFixed(1)}%
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="p-4 bg-primary/10 rounded-full">
          <TrendingUp className="h-8 w-8 text-primary" />
        </div>
      </div>
    </Card>
  );
};
