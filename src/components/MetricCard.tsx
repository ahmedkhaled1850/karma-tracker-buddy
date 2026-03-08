import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Minus, LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  color?: "primary" | "destructive" | "warning" | "success";
  icon?: LucideIcon;
}

export const MetricCard = ({ title, value, onIncrement, onDecrement, color = "primary", icon: Icon }: MetricCardProps) => {
  const colorMap = {
    primary: { text: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
    destructive: { text: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
    warning: { text: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
    success: { text: "text-success", bg: "bg-success/10", border: "border-success/20" },
  };

  const c = colorMap[color];

  return (
    <Card className={`p-4 hover:shadow-elegant transition-all duration-300 bg-card border ${c.border} relative overflow-hidden`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`p-2.5 rounded-xl ${c.bg}`}>
              <Icon className={`w-5 h-5 ${c.text}`} />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className={`text-3xl font-bold tracking-tight ${c.text} mt-0.5`}>
              {value}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="outline"
            onClick={onDecrement}
            disabled={value <= 0}
            className="h-8 w-8 rounded-lg hover:scale-105 transition-transform"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={onIncrement}
            className="h-8 w-8 rounded-lg hover:scale-105 transition-transform"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
