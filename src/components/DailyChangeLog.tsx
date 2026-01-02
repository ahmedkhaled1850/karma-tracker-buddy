import { Card } from "@/components/ui/card";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DailyChange {
  id: string;
  change_date: string;
  change_time: string | null;
  field_name: string;
  change_amount: number;
  created_at: string;
}

interface DailyChangeLogProps {
  performanceId: string | null;
}

export const DailyChangeLog = ({ performanceId }: DailyChangeLogProps) => {
  const [changes, setChanges] = useState<Record<string, DailyChange[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!performanceId) return;
    loadChanges();
  }, [performanceId]);

  const loadChanges = async () => {
    if (!performanceId) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from("daily_changes")
      .select("*")
      .eq("performance_id", performanceId)
      .order("change_date", { ascending: false })
      .order("change_time", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error loading daily changes:", error);
      setIsLoading(false);
      return;
    }

    // Group by date
    const grouped = (data || []).reduce((acc, change) => {
      const date = change.change_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      
      // Map genesys_good to good, genesys_bad to bad for combined display
      let fieldName = change.field_name;
      if (fieldName === 'genesys_good') {
        fieldName = 'good';
      } else if (fieldName === 'genesys_bad') {
        fieldName = 'bad';
      }
      
      // Add individual entries with time
      acc[date].push({ 
        ...change, 
        field_name: fieldName,
        change_time: change.change_time 
      });
      return acc;
    }, {} as Record<string, DailyChange[]>);

    setChanges(grouped);
    setIsLoading(false);
  };

  const getFieldLabel = (fieldName: string) => {
    const labels: Record<string, string> = {
      good: "Good",
      bad: "DSAT",
      karma_bad: "Karma Bad",
      good_phone: "Phone Good",
      good_chat: "Chat Good",
      good_email: "Email Good",
    };
    return labels[fieldName] || fieldName;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    // Format "HH:MM:SS" to "HH:MM"
    const [hours, minutes] = timeStr.split(':');
    return `${hours}:${minutes}`;
  };

  if (!performanceId) {
    return null;
  }

  return (
    <Card className="p-6 border-border">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Daily Change Log</h3>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading changes...</p>
      ) : Object.keys(changes).length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes recorded yet</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(changes).map(([date, dateChanges]) => (
            <div key={date} className="border-l-2 border-primary pl-4">
              <p className="text-sm font-semibold text-foreground mb-2">
                {formatDate(date)}
              </p>
              <div className="space-y-1">
                {dateChanges.map((change) => {
                  const isDSAT = change.field_name === "bad" || change.field_name === "genesys_bad";
                  const time = formatTime(change.change_time);
                  return (
                    <div
                      key={change.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      {change.change_amount > 0 ? (
                        <TrendingUp className={`h-4 w-4 ${isDSAT ? "text-destructive" : "text-success"}`} />
                      ) : (
                        <TrendingDown className={`h-4 w-4 ${isDSAT ? "text-success" : "text-destructive"}`} />
                      )}
                      {time && (
                        <span className="text-xs text-muted-foreground font-mono">{time}</span>
                      )}
                      <span>
                        {getFieldLabel(change.field_name)}:{" "}
                        <span
                          className={
                            isDSAT 
                              ? (change.change_amount > 0 ? "text-destructive" : "text-success")
                              : (change.change_amount > 0 ? "text-success" : "text-destructive")
                          }
                        >
                          {change.change_amount > 0 ? "+" : ""}
                          {change.change_amount}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
