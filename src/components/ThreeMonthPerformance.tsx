import { Card } from "@/components/ui/card";
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, Line } from "recharts";
import { useMemo, useState } from "react";
import { PercentageDisplay } from "@/components/PercentageDisplay";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface MonthMetrics {
  month: number;
  year: number;
  csat: number;
  karma: number;
  fcr: number;
  totalGood: number;
  totalSurveys: number;
  totalKarmaBase: number;
  phoneGood: number;
  phoneBad: number;
  phoneKarma: number;
  chatGood: number;
  chatBad: number;
  emailGood: number;
  emailBad: number;
}

interface ThreeMonthPerformanceProps {
  metrics: MonthMetrics[];
  includeKarmaInCSAT: boolean;
  onIncludeKarmaChange: (val: boolean) => void;
  availableMonths: Array<{ month: number; year: number; label: string }>;
  selectedMonths: Array<{ month: number; year: number }>;
  onMonthsChange: (months: Array<{ month: number; year: number }>) => void;
}

type MetricType = "csat" | "karma" | "fcr";
type ChannelType = "phone" | "chat" | "email";

export const ThreeMonthPerformance = ({
  metrics,
  includeKarmaInCSAT,
  onIncludeKarmaChange,
  availableMonths,
  selectedMonths,
  onMonthsChange,
}: ThreeMonthPerformanceProps) => {
  const [selectedMetrics, setSelectedMetrics] = useState<MetricType[]>(["csat", "karma", "fcr"]);
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>("phone");
  const [showChart, setShowChart] = useState(true);

  // Toggle a metric on/off
  const toggleMetric = (metric: MetricType) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(metric)) {
        // Don't allow removing all metrics
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== metric);
      }
      return [...prev, metric];
    });
  };

  // Calculate channel analytics per month
  const channelData = useMemo(() => {
    return metrics.map((m) => {
      const monthName = new Date(m.year, m.month).toLocaleString("en-US", { month: "short" });
      
      let good = 0, bad = 0, karma = 0;
      if (selectedChannel === "phone") {
        good = m.phoneGood;
        bad = m.phoneBad;
        karma = m.phoneKarma;
      } else if (selectedChannel === "chat") {
        good = m.chatGood;
        bad = m.chatBad;
        karma = 0;
      } else {
        good = m.emailGood;
        bad = m.emailBad;
        karma = 0;
      }

      const denom = good + bad + (includeKarmaInCSAT ? karma : 0);
      const successRate = denom > 0 ? (good / denom) * 100 : 0;

      return {
        monthLabel: `${monthName} ${m.year}`,
        monthName,
        year: m.year,
        good,
        bad,
        karma,
        successRate: parseFloat(successRate.toFixed(1)),
      };
    });
  }, [metrics, selectedChannel, includeKarmaInCSAT]);

  // Toggle month selection
  const toggleMonth = (month: number, year: number) => {
    const exists = selectedMonths.some((s) => s.month === month && s.year === year);
    if (exists) {
      // Don't allow removing last month
      if (selectedMonths.length === 1) return;
      onMonthsChange(selectedMonths.filter((s) => !(s.month === month && s.year === year)));
    } else {
      onMonthsChange([...selectedMonths, { month, year }].slice(-6)); // Max 6 months
    }
  };

  if (metrics.length === 0) {
    return (
      <Card className="p-6 border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">📅 3-Month Performance</h3>
        <p className="text-sm text-muted-foreground">No data available for the selected period.</p>
      </Card>
    );
  }

  const channelLabels: Record<ChannelType, string> = {
    phone: "Phone",
    chat: "Chat",
    email: "Email",
  };

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card className="p-4 border-border">
        <div className="space-y-4">
          <h4 className="font-semibold text-foreground text-sm">Filters</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Metrics Filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Metrics to Show</Label>
              <div className="flex flex-wrap gap-2">
                {(["csat", "karma", "fcr"] as MetricType[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleMetric(m)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      selectedMetrics.includes(m)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Channel Filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Channel</Label>
              <Select value={selectedChannel} onValueChange={(val) => setSelectedChannel(val as ChannelType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="chat">Chat</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Include Karma Checkbox */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Options</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeKarma"
                  checked={includeKarmaInCSAT}
                  onCheckedChange={(checked) => onIncludeKarmaChange(checked === true)}
                />
                <label htmlFor="includeKarma" className="text-sm text-muted-foreground cursor-pointer">
                  Include Karma in calculations
                </label>
              </div>
            </div>
          </div>

          {/* Month Selection */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Months to Compare (Select 1-6)</Label>
            <div className="flex flex-wrap gap-2">
              {availableMonths.map((m) => {
                const isSelected = selectedMonths.some((s) => s.month === m.month && s.year === m.year);
                return (
                  <button
                    key={`${m.month}-${m.year}`}
                    onClick={() => toggleMonth(m.month, m.year)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m) => {
          const monthName = new Date(m.year, m.month).toLocaleString("en-US", { month: "long" });
          
          // Calculate channel-specific data
          let channelGood = 0, channelBad = 0, channelKarma = 0;
          if (selectedChannel === "phone") {
            channelGood = m.phoneGood;
            channelBad = m.phoneBad;
            channelKarma = m.phoneKarma;
          } else if (selectedChannel === "chat") {
            channelGood = m.chatGood;
            channelBad = m.chatBad;
          } else {
            channelGood = m.emailGood;
            channelBad = m.emailBad;
          }

          const channelTotal = channelGood + channelBad + (includeKarmaInCSAT ? channelKarma : 0);
          const channelSuccessRate = channelTotal > 0 ? (channelGood / channelTotal) * 100 : 0;

          return (
            <Card key={`${m.year}-${m.month}`} className="p-4 border-border">
              <h3 className="text-base font-semibold text-foreground mb-3">{monthName} {m.year}</h3>
              <div className="space-y-3">
                {selectedMetrics.includes("csat") && (
                  <PercentageDisplay
                    title="CSAT"
                    percentage={m.csat}
                    subtitle={`${m.totalGood} good / ${m.totalSurveys} total`}
                  />
                )}
                {selectedMetrics.includes("karma") && (
                  <PercentageDisplay
                    title="Karma"
                    percentage={m.karma}
                    subtitle={`${m.totalGood} / ${m.totalKarmaBase} interactions`}
                  />
                )}
                {selectedMetrics.includes("fcr") && (
                  <PercentageDisplay
                    title="FCR"
                    percentage={m.fcr}
                    subtitle=""
                  />
                )}
                {/* Channel Analytics */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{channelLabels[selectedChannel]} Channel</span>
                    <span className="font-medium text-foreground">{channelSuccessRate.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{channelGood} good / {channelBad} bad</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Channel Analytics Chart */}
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {channelLabels[selectedChannel]} Channel Analytics
          </h3>
          <span className="text-sm text-muted-foreground">
            {metrics.length} month{metrics.length > 1 ? "s" : ""} comparison
          </span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={channelData} margin={{ top: 20, right: 60, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="monthLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis yAxisId="counts" stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="percent" orientation="right" stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey="good" name="Good" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} yAxisId="counts" />
              <Bar dataKey="bad" name="Bad" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} yAxisId="counts" />
              {selectedChannel === "phone" && (
                <Bar dataKey="karma" name="Karma" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} yAxisId="counts" />
              )}
              <Line
                type="monotone"
                dataKey="successRate"
                name="Success %"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                yAxisId="percent"
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
