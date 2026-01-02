import { Target, Trophy, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface GoalsSectionProps {
  currentValue: number;
  totalNegatives: number;
  metricName: string;
  targets: number[];
}

export const GoalsSection = ({ currentValue, totalNegatives, metricName, targets }: GoalsSectionProps) => {
  const calculateNeeded = (targetPercentage: number) => {
    const target = targetPercentage / 100;
    const totalCurrent = currentValue + totalNegatives;
    const needed = Math.ceil((target * totalCurrent - currentValue) / (1 - target));
    return Math.max(0, needed);
  };

  const total = currentValue + totalNegatives;
  const currentPercentage = total > 0 ? (currentValue / total) * 100 : 100;

  return (
    <div className="bg-card border-b border-border shadow-sm backdrop-blur-sm animate-fade-in p-6">
      <div className="container mx-auto">
        <div className="flex flex-col gap-6">
          {/* Header & Main Progress */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {metricName} Progress
                  </h3>
                  <p className="text-sm text-muted-foreground">Current Score</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-3xl font-bold ${currentPercentage >= targets[0] ? 'text-success' : 'text-primary'}`}>
                  {currentPercentage.toFixed(2)}%
                </span>
              </div>
            </div>
            <Progress value={Math.min(currentPercentage, 100)} className="h-3" />
          </div>

          {/* Targets Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {targets.map((target) => {
              const needed = calculateNeeded(target);
              const achieved = needed === 0;
              // Calculate progress towards this specific target (0 to 100%)
              // This is a bit tricky, but let's approximate: 
              // If current is 80% and target is 90%, progress is 80/90 = 88%
              const progressTowardsTarget = Math.min((currentPercentage / target) * 100, 100);

              return (
                <div 
                  key={target}
                  className={`relative overflow-hidden p-4 rounded-xl border transition-all duration-300 hover:shadow-md ${
                    achieved 
                      ? 'bg-success/5 border-success/30' 
                      : 'bg-card border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-lg font-bold">{target}% Target</span>
                    {achieved ? (
                      <Trophy className="h-5 w-5 text-success animate-bounce" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className={achieved ? "text-success font-medium" : "text-foreground"}>
                        {progressTowardsTarget.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={progressTowardsTarget} 
                      className={`h-1.5 ${achieved ? '[&>div]:bg-success' : ''}`} 
                    />
                    <p className={`text-xs mt-2 font-medium ${achieved ? 'text-success' : 'text-primary'}`}>
                      {achieved ? "🎉 Goal Achieved!" : `Need +${needed} more positive ratings`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
