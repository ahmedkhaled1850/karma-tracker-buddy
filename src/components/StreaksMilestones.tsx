import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Trophy, Star, Zap } from "lucide-react";

interface StreaksMilestonesProps {
  userId: string;
  selectedMonth: number;
  selectedYear: number;
  todayGood: number;
  dailyTarget: number;
}

const getMilestoneEmoji = (calls: number) => {
  if (calls >= 40) return "👑";
  if (calls >= 35) return "🔥";
  if (calls >= 30) return "⭐";
  return null;
};

export const StreaksMilestones = ({
  userId,
  selectedMonth,
  selectedYear,
  todayGood,
  dailyTarget,
}: StreaksMilestonesProps) => {
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [todayCalls, setTodayCalls] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStreakData = async () => {
      if (!userId) return;
      setLoading(true);

      try {
        // Load daily calls for the month to calculate streaks
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;

        const { data: callsData } = await supabase
          .from('daily_survey_calls')
          .select('call_date, total_calls')
          .eq('user_id', userId)
          .gte('call_date', startDate)
          .lte('call_date', endDate)
          .order('call_date', { ascending: true });

        const records = callsData || [];

        // Today's calls
        const today = new Date().toISOString().split('T')[0];
        const todayRecord = records.find(r => r.call_date === today);
        setTodayCalls(todayRecord?.total_calls || 0);

        // Calculate streak: consecutive days with >= 30 calls (100% tier)
        let currentStreak = 0;
        let maxStreak = 0;
        let tempStreak = 0;

        // Sort by date descending to find current streak
        const sorted = [...records].filter(r => (r.total_calls || 0) > 0).sort((a, b) => b.call_date.localeCompare(a.call_date));
        
        // Current streak (from most recent backwards)
        for (const record of sorted) {
          if ((record.total_calls || 0) >= 30) {
            currentStreak++;
          } else {
            break;
          }
        }

        // Best streak
        const chronological = [...records].filter(r => (r.total_calls || 0) > 0).sort((a, b) => a.call_date.localeCompare(b.call_date));
        for (const record of chronological) {
          if ((record.total_calls || 0) >= 30) {
            tempStreak++;
            maxStreak = Math.max(maxStreak, tempStreak);
          } else {
            tempStreak = 0;
          }
        }

        setStreak(currentStreak);
        setBestStreak(maxStreak);
      } catch (error) {
        console.error('Error loading streak data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStreakData();
  }, [userId, selectedMonth, selectedYear]);

  const todayMilestone = useMemo(() => getMilestoneEmoji(todayCalls), [todayCalls]);
  const targetHit = todayGood >= Math.ceil(dailyTarget) && dailyTarget > 0;

  if (loading) return null;

  return (
    <Card className="p-3 border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center gap-4">
        {/* Streak */}
        <div className="flex items-center gap-1.5">
          <Flame className={`h-4 w-4 ${streak > 0 ? "text-orange-500" : "text-muted-foreground/40"}`} />
          <div>
            <span className={`text-lg font-extrabold tabular-nums ${streak > 0 ? "text-orange-500" : "text-muted-foreground/60"}`}>
              {streak}
            </span>
            <span className="text-[10px] text-muted-foreground ml-1">day streak</span>
          </div>
        </div>

        <div className="w-px h-8 bg-border" />

        {/* Best Streak */}
        <div className="flex items-center gap-1.5">
          <Trophy className={`h-3.5 w-3.5 ${bestStreak > 0 ? "text-warning" : "text-muted-foreground/40"}`} />
          <div>
            <span className="text-sm font-bold tabular-nums text-muted-foreground">{bestStreak}</span>
            <span className="text-[10px] text-muted-foreground ml-1">best</span>
          </div>
        </div>

        <div className="w-px h-8 bg-border" />

        {/* Today's calls milestone */}
        <div className="flex items-center gap-1.5">
          <Zap className={`h-3.5 w-3.5 ${todayCalls >= 30 ? "text-success" : "text-muted-foreground/40"}`} />
          <div>
            <span className={`text-sm font-bold tabular-nums ${todayCalls >= 30 ? "text-success" : "text-muted-foreground"}`}>
              {todayCalls}
            </span>
            <span className="text-[10px] text-muted-foreground ml-1">calls today</span>
            {todayMilestone && <span className="ml-1">{todayMilestone}</span>}
          </div>
        </div>

        {/* Target hit badge */}
        {targetHit && (
          <>
            <div className="w-px h-8 bg-border" />
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-success fill-success" />
              <span className="text-[10px] font-bold text-success uppercase">Target ✓</span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
