
import { motion } from "framer-motion"
import { ArrowRight, Sparkles, GitBranchPlus, TestTube2, Rocket, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import type { ElementType } from "react"

interface NodeProps {
  icon: ElementType
  title: string
  subtitle: string
  status?: "success" | "warning" | "error" | "default"
  isActive?: boolean
  delay?: number
}

const Node = ({ icon: Icon, title, subtitle, status = "default", isActive = false, delay = 0 }: NodeProps) => {
  const statusColors = {
    success: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    warning: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    error: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    default: "text-primary bg-primary/10 border-primary/20",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={cn(
        "relative flex min-w-[160px] flex-col items-center justify-center rounded-lg border bg-card p-4 text-center transition-colors duration-200",
        isActive ? "shadow-lg border-primary/40 ring-1 ring-primary/20 scale-105 z-10" : "opacity-80 grayscale-[0.3]"
      )}
    >
      <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center mb-3", statusColors[status])}>
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="text-[11px] font-black uppercase tracking-wider text-foreground/80 mb-1">{title}</h4>
      <p className="text-[10px] font-bold text-muted-foreground/60 leading-tight uppercase">{subtitle}</p>
      
      {status === "success" && <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-emerald-500" />}
      {status === "warning" && <AlertCircle className="absolute top-2 right-2 h-3.5 w-3.5 text-amber-500" />}
    </motion.div>
  )
}

const Connector = ({ delay = 0 }: { delay?: number }) => (
  <motion.div
    initial={{ scaleX: 0, opacity: 0 }}
    animate={{ scaleX: 1, opacity: 1 }}
    transition={{ delay, duration: 0.8 }}
    className="h-px min-w-[30px] max-w-[60px] flex-1 origin-left bg-border"
  >
    <div className="absolute top-1/2 -translate-y-1/2 -right-1">
      <ArrowRight className="h-3 w-3 text-primary/40" />
    </div>
  </motion.div>
)

interface TraceFlowProps {
  data: {
    request: { title: string; status: string }
    backlog: { epics: number; stories: number; coverage: number }
    quality: { tests: number; runs: number }
    release: { count: number; ready: number }
  }
}

export const TraceFlow = ({ data }: TraceFlowProps) => {
  const { t } = useTranslation()
  return (
    <div className="relative overflow-x-auto pb-6 scrollbar-hide">
      <div className="flex items-center justify-between min-w-[800px] px-4 py-8">
        <Node
          icon={Sparkles}
          title={t('trace_flow.business_request')}
          subtitle={data.request.title}
          status="default"
          isActive={true}
          delay={0.1}
        />
        
        <Connector delay={0.3} />
        
        <Node
          icon={GitBranchPlus}
          title={t('trace_flow.backlog')}
          subtitle={t('trace_flow.stories_coverage', { count: data.backlog.stories, coverage: data.backlog.coverage })}
          status={data.backlog.coverage > 80 ? "success" : "warning"}
          isActive={true}
          delay={0.5}
        />
        
        <Connector delay={0.7} />
        
        <Node
          icon={TestTube2}
          title={t('trace_flow.quality_gates')}
          subtitle={t('trace_flow.tests_runs', { tests: data.quality.tests, runs: data.quality.runs })}
          status={data.quality.runs > 0 ? "success" : "default"}
          isActive={true}
          delay={0.9}
        />
        
        <Connector delay={1.1} />
        
        <Node
          icon={Rocket}
          title={t('trace_flow.release_hub')}
          subtitle={t('trace_flow.candidates', { ready: data.release.ready, count: data.release.count })}
          status={data.release.ready > 0 ? "success" : "default"}
          isActive={true}
          delay={1.3}
        />
      </div>

      {/* Background decoration */}
      <div className="absolute top-1/2 left-0 w-full h-[100px] -translate-y-1/2 bg-primary/5 blur-[100px] pointer-events-none -z-10" />
    </div>
  )
}
