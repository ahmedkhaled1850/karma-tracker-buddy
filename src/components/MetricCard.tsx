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
    primary: { 
      text: "text-primary", 
      bg: "bg-primary/10", 
      border: "border-primary/25",
      glow: "shadow-[0_0_12px_hsl(var(--primary)/0.1)]",
      btnInc: "bg-primary/15 text-primary hover:bg-primary/25 border-primary/20",
      btnDec: "bg-muted text-muted-foreground hover:bg-muted/80",
    },
    destructive: { 
      text: "text-destructive", 
      bg: "bg-destructive/10", 
      border: "border-destructive/25",
      glow: "shadow-[0_0_12px_hsl(var(--destructive)/0.1)]",
      btnInc: "bg-destructive/15 text-destructive hover:bg-destructive/25 border-destructive/20",
      btnDec: "bg-muted text-muted-foreground hover:bg-muted/80",
    },
    warning: { 
      text: "text-warning", 
      bg: "bg-warning/10", 
      border: "border-warning/25",
      glow: "shadow-[0_0_12px_hsl(var(--warning)/0.1)]",
      btnInc: "bg-warning/15 text-warning hover:bg-warning/25 border-warning/20",
      btnDec: "bg-muted text-muted-foreground hover:bg-muted/80",
    },
    success: { 
      text: "text-success", 
      bg: "bg-success/10", 
      border: "border-success/25",
      glow: "shadow-[0_0_12px_hsl(var(--success)/0.1)]",
      btnInc: "bg-success/15 text-success hover:bg-success/25 border-success/20",
      btnDec: "bg-muted text-muted-foreground hover:bg-muted/80",
    },
  };

  const c = colorMap[color];

  return (
    <Card className={`p-4 bg-card border ${c.border} ${c.glow} hover:scale-[1.02] transition-all duration-300 relative overflow-hidden`}>
      {/* Subtle accent stripe */}
      <div className={`absolute top-0 left-0 w-1 h-full ${c.bg}`} style={{ opacity: 0.8 }} />
      
      <div className="flex items-center justify-between pl-2">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`p-2 rounded-lg ${c.bg}`}>
              <Icon className={`w-4 h-4 ${c.text}`} />
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={`text-2xl font-bold tracking-tight ${c.text} tabular-nums`}>
              {value}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onDecrement}
            disabled={value <= 0}
            className={`h-7 w-7 rounded-md ${c.btnDec} transition-all`}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onIncrement}
            className={`h-7 w-7 rounded-md ${c.btnInc} transition-all`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
