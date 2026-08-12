import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"
import { motion } from "framer-motion"

import { useTranslation } from "react-i18next"

export interface VelocityDataPoint {
  name: string
  completedPoints: number
  totalPoints: number
}

interface VelocityChartProps {
  data: VelocityDataPoint[]
  title?: string
  description?: string
  height?: number
  isPlaceholder?: boolean
  showHeader?: boolean
}

export function VelocityChart({ data, title, description, height = 300, isPlaceholder, showHeader = true }: VelocityChartProps) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border bg-card p-6 shadow-sm glass-card relative overflow-hidden"
    >
      {showHeader && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            {title && (
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-muted-foreground/70 leading-relaxed font-medium">
                {description}
              </p>
            )}
          </div>
          {isPlaceholder && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {t("project_dashboard.velocity_chart.simulated_data")}
            </span>
          )}
        </div>
      )}

      <div style={{ width: "100%", height }} className="relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              axisLine={{ stroke: "var(--border)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                borderRadius: "12px",
                fontSize: "12px",
                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
              }}
              itemStyle={{ color: "var(--foreground)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
            />
            <Bar
              name={t("project_dashboard.velocity_chart.commitment")}
              dataKey="totalPoints"
              fill="rgba(148, 163, 184, 0.4)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              name={t("project_dashboard.velocity_chart.completed")}
              dataKey="completedPoints"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </motion.div>
  )
}
