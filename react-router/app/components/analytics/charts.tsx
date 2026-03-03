"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// ─── Colors ──────────────────────────────────────────────

const CHART_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(0, 84%, 60%)",
  "hsl(45, 93%, 47%)",
  "hsl(262, 83%, 58%)",
  "hsl(199, 89%, 48%)",
  "hsl(24, 95%, 53%)",
  "hsl(330, 81%, 60%)",
];

// ─── Metric Card ──────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon?: React.ReactNode;
}

export function MetricCard({ title, value, description, icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Bar Chart ────────────────────────────────────────────

interface BarChartCardProps {
  title: string;
  data: Array<Record<string, unknown>>;
  dataKey: string;
  nameKey: string;
  color?: string;
  height?: number;
}

export function BarChartCard({
  title,
  data,
  dataKey,
  nameKey,
  color = CHART_COLORS[0],
  height = 300,
}: BarChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={nameKey} className="text-xs" tick={{ fontSize: 12 }} />
            <YAxis className="text-xs" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
              }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Line Chart ───────────────────────────────────────────

interface LineChartCardProps {
  title: string;
  data: Array<Record<string, unknown>>;
  lines: Array<{ dataKey: string; color?: string; name?: string }>;
  xAxisKey: string;
  height?: number;
}

export function LineChartCard({ title, data, lines, xAxisKey, height = 300 }: LineChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={xAxisKey} className="text-xs" tick={{ fontSize: 12 }} />
            <YAxis className="text-xs" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
              }}
            />
            <Legend />
            {lines.map((line, i) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                name={line.name ?? line.dataKey}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Pie Chart ────────────────────────────────────────────

interface PieChartCardProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  height?: number;
}

export function PieChartCard({ title, data, height = 300 }: PieChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={(props: PieLabelRenderProps) =>
                `${String(props.name ?? "")} (${(Number(props.percent ?? 0) * 100).toFixed(0)}%)`
              }
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export { CHART_COLORS };
