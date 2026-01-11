import { Card } from "@/components/ui/card";
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, Line } from "recharts";
import { useMemo } from "react";

/**
 * Props for a single month phone KPI data.
 */
export interface PhoneMonthData {
  /** Month name, e.g. "January" */
  month: string;
  /** Number of good phone ratings */
  good: number;
  /** Number of bad phone ratings (DSAT) */
  bad: number;
  /** Karma points for phone */
  karma: number;
}

/**
 * Component that visualises phone channel analytics for up to three months.
 * It renders a grouped bar chart where each month shows Good, Bad and Karma values.
 * The component is flexible – if fewer than three months are supplied it will
 * simply render the available data.
 */
export const ThreeMonthPhoneAnalytics = ({ months, includeKarma = false, showSuccessLine = false }: { months: PhoneMonthData[]; includeKarma?: boolean; showSuccessLine?: boolean }) => {
  // Prepare chart data and compute success percentage per month
  const chartData = useMemo(() => {
    return months.map((m) => {
      const denom = m.good + m.bad + (includeKarma ? m.karma : 0);
      const success = denom > 0 ? (m.good / denom) * 100 : 0;
      return {
        month: m.month,
        Good: m.good,
        Bad: m.bad,
        Karma: m.karma,
        Success: parseFloat(success.toFixed(1)),
      };
    });
  }, [months, includeKarma]);

  if (months.length === 0) {
    return (
      <Card className="p-6 border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Phone KPI Overview
        </h3>
        <p className="text-sm text-muted-foreground">
          No data available for the selected period.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Phone KPI (Last {months.length} months)</h3>
        {showSuccessLine && <span className="text-sm text-muted-foreground">Showing success rate as a line (right axis)</span>}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 60, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
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
            <Bar dataKey="Good" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} yAxisId="counts" />
            <Bar dataKey="Bad" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} yAxisId="counts" />
            <Bar dataKey="Karma" fill="hsl(var(--warning))" radius={[8, 8, 0, 0]} yAxisId="counts" />
            {showSuccessLine && (
              <Line type="monotone" dataKey="Success" stroke="hsl(var(--primary))" strokeWidth={2} yAxisId="percent" dot={{ r: 4 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};