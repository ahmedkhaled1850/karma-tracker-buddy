import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Lightbulb, TrendingUp, Phone, SmilePlus, Target } from "lucide-react";

interface SmartKPITipsProps {
  kpiScore: number;
  avgDailyCalls: number;
  totalCalls: number;
  recordedDays: number;
  csatPercentage: number;
  totalGood: number;
  totalSurveys: number;
  surveyConversionRate?: number;
  remainingWorkDays?: number;
}

interface Tip {
  icon: React.ReactNode;
  text: string;
  priority: number; // lower = more important
  type: "calls" | "csat" | "survey" | "celebration";
}

export const SmartKPITips = ({
  kpiScore,
  avgDailyCalls,
  totalCalls,
  recordedDays,
  csatPercentage,
  totalGood,
  totalSurveys,
  surveyConversionRate = 100,
  remainingWorkDays,
}: SmartKPITipsProps) => {
  const tips = useMemo(() => {
    const result: Tip[] = [];

    // Celebration tips
    if (kpiScore >= 100) {
      result.push({
        icon: <span className="text-lg">🏆</span>,
        text: "Perfect KPI! You're at 100% — keep this pace!",
        priority: 0,
        type: "celebration",
      });
      return result;
    }

    // Productivity tips
    if (avgDailyCalls < 26) {
      const needed = Math.ceil(26 * Math.max(1, recordedDays) - totalCalls);
      result.push({
        icon: <Phone className="h-4 w-4 text-destructive" />,
        text: `⚠️ Average is ${avgDailyCalls.toFixed(1)} calls/day — below 26 threshold. Need ${needed} more calls to reach 50% tier.`,
        priority: 1,
        type: "calls",
      });
    } else if (avgDailyCalls < 28) {
      const needed = Math.ceil(28 * Math.max(1, recordedDays) - totalCalls);
      result.push({
        icon: <Phone className="h-4 w-4 text-warning" />,
        text: `📞 ${needed} more calls to jump from 50% → 75% productivity tier (need 28/day avg)`,
        priority: 2,
        type: "calls",
      });
    } else if (avgDailyCalls < 30) {
      const needed = Math.ceil(30 * Math.max(1, recordedDays) - totalCalls);
      result.push({
        icon: <Phone className="h-4 w-4 text-primary" />,
        text: `🔥 Just ${needed} more calls to reach 100% productivity! (need 30/day avg)`,
        priority: 2,
        type: "calls",
      });
    }

    // CSAT tips
    if (csatPercentage < 87 && totalSurveys > 0) {
      const neededForTier = Math.ceil((0.87 * totalSurveys - totalGood) / (1 - 0.87));
      result.push({
        icon: <SmilePlus className="h-4 w-4 text-destructive" />,
        text: `⚠️ CSAT ${csatPercentage.toFixed(1)}% is below 87%. Need ${Math.max(0, neededForTier)} more good ratings to reach 50% tier.`,
        priority: 1,
        type: "csat",
      });
    } else if (csatPercentage < 90 && totalSurveys > 0) {
      const neededForTier = Math.ceil((0.90 * totalSurveys - totalGood) / (1 - 0.90));
      result.push({
        icon: <SmilePlus className="h-4 w-4 text-warning" />,
        text: `😊 ${Math.max(0, neededForTier)} more good ratings to jump CSAT from 50% → 75% tier (need 90%)`,
        priority: 2,
        type: "csat",
      });
    } else if (csatPercentage < 93 && totalSurveys > 0) {
      const neededForTier = Math.ceil((0.93 * totalSurveys - totalGood) / (1 - 0.93));
      result.push({
        icon: <SmilePlus className="h-4 w-4 text-primary" />,
        text: `🎯 Just ${Math.max(0, neededForTier)} more good ratings to hit 93% CSAT = 100% score!`,
        priority: 2,
        type: "csat",
      });
    }

    // Survey conversion tips
    if (surveyConversionRate < 85) {
      result.push({
        icon: <Target className="h-4 w-4 text-warning" />,
        text: `📋 Survey conversion at ${surveyConversionRate.toFixed(0)}% — push to 85%+ to stay compliant`,
        priority: 3,
        type: "survey",
      });
    }

    // Pace tips
    if (remainingWorkDays && remainingWorkDays > 0 && avgDailyCalls > 0 && avgDailyCalls < 30) {
      const callsNeededPerDay = Math.ceil((30 * (recordedDays + remainingWorkDays) - totalCalls) / remainingWorkDays);
      if (callsNeededPerDay <= 35) {
        result.push({
          icon: <TrendingUp className="h-4 w-4 text-success" />,
          text: `📈 At ${callsNeededPerDay} calls/day for remaining ${remainingWorkDays} days, you'll hit 100% productivity!`,
          priority: 4,
          type: "calls",
        });
      }
    }

    return result.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }, [kpiScore, avgDailyCalls, totalCalls, recordedDays, csatPercentage, totalGood, totalSurveys, surveyConversionRate, remainingWorkDays]);

  if (tips.length === 0) return null;

  return (
    <Card className="p-3 border-border/60 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="h-4 w-4 text-warning" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Smart Tips</span>
      </div>
      <div className="space-y-1.5">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-foreground/90">
            <span className="mt-0.5 shrink-0">{tip.icon}</span>
            <span>{tip.text}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
