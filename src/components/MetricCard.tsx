import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Minus, LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  color?: "primary" | "destructive" | "warning";
  icon?: LucideIcon;
}

export const MetricCard = ({ title, value, onIncrement, onDecrement, color = "primary", icon: Icon }: MetricCardProps) => {
  const colorClasses = {
    primary: "text-primary bg-primary/10",
    destructive: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/10",
  };

  const iconColorClasses = {
    primary: "text-primary",
    destructive: "text-destructive",
    warning: "text-warning",
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-all duration-300 bg-card border-border relative overflow-hidden group">
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${iconColorClasses[color]}`}>
        {Icon && <Icon className="w-24 h-24 -mr-8 -mt-8" />}
      </div>
      
      <div className="flex items-center justify-between relative z-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {Icon && <Icon className={`w-5 h-5 ${iconColorClasses[color]}`} />}
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          </div>
          <p className={`text-5xl font-bold tracking-tight ${iconColorClasses[color]}`}>
            {value}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={onIncrement}
            className="h-10 w-10 rounded-full hover:scale-110 transition-transform shadow-sm"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={onDecrement}
            disabled={value <= 0}
            className="h-10 w-10 rounded-full hover:scale-110 transition-transform shadow-sm"
          >
            <Minus className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
