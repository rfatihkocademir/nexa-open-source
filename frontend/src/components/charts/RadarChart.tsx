import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { motion } from "framer-motion"

export interface RadarDataPoint {
  subject: string
  value: number
  fullMark: number
}

interface RadarChartProps {
  data: RadarDataPoint[]
  title?: string
  description?: string
  height?: number
}

export function RadarChart({ data, title, description, height = 300 }: RadarChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border bg-card p-6 shadow-sm glass-card relative overflow-hidden"
    >
      <div className="mb-4 space-y-1">
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

      <div style={{ width: "100%", height }} className="relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="var(--border)" strokeOpacity={0.4} />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 600 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              axisLine={false}
              tickCount={6}
            />
            <Radar
              name="Project Health"
              dataKey="value"
              stroke="var(--primary)"
              fill="var(--primary)"
              fillOpacity={0.2}
              strokeWidth={2}
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
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>

      {/* Decorative background element */}
    </motion.div>
  )
}
