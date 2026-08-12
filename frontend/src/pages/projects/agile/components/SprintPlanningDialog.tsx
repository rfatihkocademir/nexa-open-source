import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Gauge,
  LockKeyhole,
  Play,
  Save,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import type { Sprint } from "@/types/agile";
import { sprintService } from "@/services/sprint.service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatWorklogDuration } from "@/lib/worklogDuration";

const hours = (minutes: number) => formatWorklogDuration(minutes);
const dimensionLabels: Record<string, string> = {
  goal: "Sprint Goal",
  capacity: "Kapasite",
  estimated: "Tahminler",
  assigned: "Atamalar",
  acceptance: "Kabul kriterleri",
  testable: "Test edilebilirlik",
};
const scenarioNames = {
  SAFE: "Güvenli plan",
  BALANCED: "Dengeli plan",
  AGGRESSIVE: "Agresif plan",
} as const;
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "İşlem tamamlanamadı.";

export function SprintPlanningDialog({
  open,
  onOpenChange,
  sprints,
  onApplyScenario,
  applying,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprints: Sprint[];
  onApplyScenario: (sprintId: string, workItemIds: string[]) => Promise<void>;
  applying: boolean;
}) {
  const [sprintId, setSprintId] = useState("");
  const queryClient = useQueryClient();
  const selectedId =
    sprintId ||
    sprints.find((sprint) => sprint.status === "ACTIVE")?.id ||
    sprints[0]?.id ||
    "";
  const isClosed =
    sprints.find((sprint) => sprint.id === selectedId)?.status === "CLOSED";
  const { data, isLoading } = useQuery({
    queryKey: ["sprint-planning-report", selectedId],
    queryFn: () => sprintService.planningReport(selectedId),
    enabled: open && Boolean(selectedId),
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["sprint-planning-report", selectedId],
    });
  const sessionMutation = useMutation({
    mutationFn: async (status?: string) => {
      if (!data) return;
      if (!data.activeSession)
        return sprintService.createPlanningSession(data.sprint.id);
      return sprintService.transitionPlanningSession(
        data.sprint.id,
        data.activeSession.id,
        status!,
      );
    },
    onSuccess: () => {
      toast.success("Planlama oturumu güncellendi.");
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                Sprint Planlama Modu
              </DialogTitle>
              <DialogDescription className="mt-1">
                Kapasiteyi, hazırlığı ve risk senaryolarını toplantı başlamadan
                tek ekranda doğrulayın.
              </DialogDescription>
            </div>
            <Select value={selectedId} onValueChange={setSprintId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Sprint seçin" />
              </SelectTrigger>
              <SelectContent>
                {sprints.map((sprint) => (
                  <SelectItem key={sprint.id} value={sprint.id}>
                    {sprint.name} ·{" "}
                    {sprint.status === "CLOSED"
                      ? "Kapalı"
                      : sprint.status === "ACTIVE"
                        ? "Aktif"
                        : "Planlandı"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-6 [scrollbar-gutter:stable]">
          {!selectedId ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              Planlama için önce bir sprint oluşturun.
            </div>
          ) : isLoading || !data ? (
            <div className="h-72 animate-pulse rounded-xl bg-muted" />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-semibold">
                    {isClosed ? "Geçmiş sprint incelemesi" : "Toplantı akışı"}{" "}
                    {!isClosed && data.activeSession?.startedAt && (
                      <SessionTimer startedAt={data.activeSession.startedAt} />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isClosed
                      ? "Kapalı sprint verileri denetim bütünlüğü için salt okunur gösterilir."
                      : "Hazırla → başlat → kapsamı kilitle → tamamla. Kilitli kapsam denetim kaydı olmadan değiştirilemez."}
                  </p>
                </div>
                {!isClosed && (
                  <div className="flex gap-2">
                    {!data.activeSession && (
                      <Button
                        size="sm"
                        onClick={() => sessionMutation.mutate(undefined)}
                        disabled={sessionMutation.isPending}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Oturum oluştur
                      </Button>
                    )}
                    {data.activeSession?.status === "PREPARING" && (
                      <Button
                        size="sm"
                        onClick={() => sessionMutation.mutate("IN_PROGRESS")}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Toplantıyı başlat
                      </Button>
                    )}
                    {data.activeSession?.status === "IN_PROGRESS" && (
                      <Button
                        size="sm"
                        onClick={() => sessionMutation.mutate("LOCKED")}
                      >
                        <LockKeyhole className="mr-2 h-4 w-4" />
                        Kapsamı kilitle
                      </Button>
                    )}
                    {data.activeSession?.status === "LOCKED" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sessionMutation.mutate("IN_PROGRESS")}
                        >
                          Yeniden aç
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => sessionMutation.mutate("COMPLETED")}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Planı tamamla
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <Metric
                  icon={Gauge}
                  label="Hazırlık skoru"
                  value={`${data.summary.readinessScore}/100`}
                  danger={data.summary.readinessScore < 75}
                />
                <Metric
                  icon={Target}
                  label="Story point"
                  value={`${data.summary.totalPoints}/${data.summary.capacityPoints}`}
                  hint={`%${data.summary.pointUtilization} dolu`}
                  danger={data.summary.pointUtilization > 100}
                />
                <Metric
                  icon={Users}
                  label="Net ekip kapasitesi"
                  value={hours(data.summary.teamNetMinutes)}
                  hint={`${hours(data.summary.teamGrossMinutes)} brüt`}
                />
                <Metric
                  icon={Clock3}
                  label="Odak rezervi"
                  value={hours(data.summary.focusReserveMinutes)}
                  hint="Toplantı ve kesintiler"
                />
                <Metric
                  icon={BrainCircuit}
                  label="Tahmin güveni"
                  value={
                    data.summary.forecastConfidence == null
                      ? "Veri bekleniyor"
                      : `%${data.summary.forecastConfidence}`
                  }
                  hint="5.000 simülasyon"
                />
                <Metric
                  icon={AlertTriangle}
                  label="Plansız iş tamponu"
                  value={`%${data.summary.unplannedBufferPercent}`}
                  hint="Gerçekleşen sapmadan"
                />
              </div>
              {isClosed && data.outcome && (
                <section className="rounded-xl border bg-muted/10 p-4">
                  <h3 className="font-semibold">Sprint gerçekleşen özeti</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Metric icon={Target} label="Planlanan / biten" value={`${data.outcome.plannedPoints} / ${data.outcome.completedPoints} SP`} />
                    <Metric icon={AlertTriangle} label="Taşan iş" value={`${data.outcome.spilloverPoints} SP`} />
                    <Metric icon={BrainCircuit} label="Plansız iş" value={`${data.outcome.unplannedPoints} SP`} />
                    <Metric icon={Clock3} label="Gerçekleşen efor" value={hours(data.outcome.completedMinutes)} />
                    <Metric icon={Users} label="Planlama süresi" value={`${data.outcome.meetingDurationMinutes} dk`} />
                  </div>
                </section>
              )}
              <section className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Planlamaya hazırlık</h3>
                    <p className="text-xs text-muted-foreground">
                      Toplantıda tartışılmaması gereken hazırlık eksikleri
                    </p>
                  </div>
                  <Badge
                    variant={data.blockers.length ? "destructive" : "secondary"}
                  >
                    {data.blockers.length
                      ? `${data.blockers.length} eksik`
                      : "Hazır"}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(data.dimensions).map(([key, value]) => (
                    <div key={key} className="rounded-lg border p-3">
                      <div className="flex justify-between text-xs">
                        <span>{dimensionLabels[key] ?? key}</span>
                        <strong>%{value}</strong>
                      </div>
                      <Progress value={value} className="mt-2 h-1.5" />
                    </div>
                  ))}
                </div>
                {data.blockers.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {data.blockers.map((blocker) => (
                      <p
                        key={blocker}
                        className="flex items-center gap-2 text-xs text-amber-700"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {blocker}
                      </p>
                    ))}
                  </div>
                )}
              </section>
              <section className="rounded-xl border p-4">
                <h3 className="font-semibold">Kişi / zaman dengesi</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  İzin, toplantı, destek yükü ve odak oranı sprint özelinde
                  kapasiteden düşülür.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {data.members.map((member) => (
                    <MemberCapacityCard
                      key={member.userId}
                      sprintId={data.sprint.id}
                      member={member}
                      onSaved={refresh}
                      readOnly={isClosed}
                    />
                  ))}
                </div>
              </section>
              {!isClosed && (
                <>
                  <CapacityCalendar
                    sprintId={data.sprint.id}
                    defaultDate={data.sprint.startDate.slice(0, 10)}
                    holidays={data.holidays}
                    exceptions={data.exceptions}
                    onSaved={refresh}
                  />
                  <PlanningEstimates
                    sprintId={data.sprint.id}
                    items={data.planningItems}
                    onSaved={refresh}
                  />
                  <DependencyEditor
                    sprintId={data.sprint.id}
                    items={data.planningItems}
                    onSaved={refresh}
                  />
                </>
              )}
              <section className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Uzmanlık darboğazları</h3>
                    <p className="text-xs text-muted-foreground">
                      Disiplin talebi ve zorunlu yetkinlikler ekip kapasitesiyle
                      karşılaştırılır.
                    </p>
                  </div>
                  <Badge
                    variant={
                      data.disciplineBottlenecks.length || data.skillGaps.length
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {data.disciplineBottlenecks.length + data.skillGaps.length
                      ? `${data.disciplineBottlenecks.length + data.skillGaps.length} darboğaz`
                      : "Dengeli"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(data.disciplineCapacity).map(
                    ([discipline, capacity]) => {
                      const demand = data.disciplineDemand[discipline] ?? 0;
                      const rate = Math.round(
                        (demand / Math.max(1, capacity)) * 100,
                      );
                      return (
                        <div key={discipline} className="rounded-lg border p-3">
                          <div className="flex justify-between text-xs">
                            <strong>{discipline}</strong>
                            <span>
                              {hours(demand)} / {hours(capacity)}
                            </span>
                          </div>
                          <Progress
                            value={Math.min(rate, 100)}
                            className={cn(
                              "mt-2 h-1.5",
                              rate > 100 && "[&>div]:bg-destructive",
                            )}
                          />
                        </div>
                      );
                    },
                  )}
                </div>
                {data.skillGaps.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.skillGaps.map((gap) => (
                      <Badge key={gap.skill} variant="destructive">
                        {gap.skill}: {gap.requiredBy.join(", ")}
                      </Badge>
                    ))}
                  </div>
                )}
              </section>
              {!isClosed && <section>
                <div className="mb-3">
                  <h3 className="font-semibold">
                    Otomatik kapsam senaryoları
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    PERT süreleri, plansız iş tamponu, bağımlılıklar ve 5.000
                    Monte Carlo koşumu birlikte değerlendirilir.
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  {data.scenarios.map((scenario) => (
                    <article
                      key={scenario.key}
                      className={cn(
                        "flex flex-col rounded-xl border p-4",
                        scenario.key === "BALANCED" &&
                          "border-primary/40 bg-primary/[0.03] ring-1 ring-primary/10",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">
                          {scenarioNames[scenario.key]}
                        </h4>
                        <Badge variant="outline">
                          %{scenario.confidence} başarı
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Hedef %{scenario.targetConfidence} · üst sınır{" "}
                        {scenario.pointLimit} SP · önerilen{" "}
                        {scenario.recommendedPoints} SP
                      </p>
                      <div className="my-3 max-h-44 flex-1 space-y-1 overflow-y-auto">
                        {scenario.recommendedItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded border bg-background px-2 py-1.5 text-xs"
                          >
                            <span className="font-mono font-semibold">
                              {item.key}
                            </span>{" "}
                            · {item.title}{" "}
                            <span className="float-right font-semibold">
                              {item.storyPoints} SP
                            </span>
                          </div>
                        ))}
                        {!scenario.recommendedItems.length && (
                          <p className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
                            Tahminli ve uygun backlog işi bulunamadı.
                          </p>
                        )}
                      </div>
                      {!isClosed && (
                        <Button
                          variant={
                            scenario.key === "BALANCED" ? "default" : "outline"
                          }
                          disabled={
                            !scenario.recommendedItems.length ||
                            applying ||
                            data.activeSession?.status === "LOCKED"
                          }
                          onClick={() =>
                            onApplyScenario(
                              data.sprint.id,
                              scenario.recommendedItems.map((item) => item.id),
                            )
                          }
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Bu kapsamı uygula
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
              </section>}
              {data.calibration.length > 0 && (
                <section className="rounded-xl border p-4">
                  <h3 className="font-semibold">
                    Plan–gerçekleşen kalibrasyonu
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Bu metrikler ekip tahminini iyileştirmek içindir; bireysel
                    performans değerlendirmesinde kullanılmamalıdır.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {data.calibration.slice(0, 4).map((row) => (
                      <div
                        key={row.id}
                        className="rounded-lg border p-3 text-xs"
                      >
                        <p className="font-semibold">
                          {new Date(row.calculatedAt).toLocaleDateString(
                            "tr-TR",
                          )}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Plan {row.plannedPoints} · Biten {row.completedPoints}{" "}
                          SP
                        </p>
                        <p className="text-muted-foreground">
                          Taşan {row.spilloverPoints} · Plansız{" "}
                          {row.unplannedPoints} SP
                        </p>
                        <p className="text-muted-foreground">
                          Toplantı {row.meetingDurationMinutes} dk
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  danger,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        danger && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MemberCapacityCard({
  sprintId,
  member,
  onSaved,
  readOnly = false,
}: {
  sprintId: string;
  member: NonNullable<
    import("@/services/sprint.service").SprintPlanningReport["members"][number]
  >;
  onSaved: () => void;
  readOnly?: boolean;
}) {
  const initialAllocations = (
    member.disciplineAllocations.length
      ? member.disciplineAllocations
      : [{ discipline: "GENERAL", percent: 100 }]
  )
    .map((row) => `${row.discipline}:${row.percent}`)
    .join(", ");
  const initialSkills = member.skills
    .map((skill) => (typeof skill === "string" ? skill : skill.name))
    .join(", ");
  const [form, setForm] = useState({
    dailyCapacityMinutes: member.dailyCapacityMinutes,
    focusPercent: member.focusFactor,
    leaveMinutes: member.leaveMinutes,
    meetingMinutes: member.meetingMinutes,
    supportMinutes: member.supportMinutes,
    allocations: initialAllocations,
    skills: initialSkills,
  });
  const mutation = useMutation({
    mutationFn: () => {
      const disciplineAllocations = form.allocations
        .split(",")
        .map((part) => {
          const [discipline, percent] = part.trim().split(":");
          return {
            discipline: discipline?.toUpperCase(),
            percent: Number(percent),
          };
        })
        .filter((row) => row.discipline && Number.isFinite(row.percent));
      if (
        !disciplineAllocations.length ||
        disciplineAllocations.reduce((sum, row) => sum + row.percent, 0) !== 100
      )
        throw new Error(
          "Disiplin dağılımı toplamı %100 olmalıdır. Örnek: BACKEND:70, TESTING:30",
        );
      return sprintService.savePlanningCapacity(sprintId, member.userId, {
        ...form,
        disciplineAllocations,
        skills: form.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
      });
    },
    onSuccess: () => {
      toast.success(`${member.name} kapasitesi kaydedildi.`);
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const field = (key: keyof typeof form, label: string) => (
    <label className="text-[10px] text-muted-foreground">
      {label}
      <Input
        className="mt-1 h-8 text-xs"
        type="number"
        min={0}
        disabled={readOnly}
        value={form[key]}
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            [key]: Number(event.target.value),
          }))
        }
      />
    </label>
  );
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        member.utilization > 110 && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{member.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {member.role} · {hours(member.netMinutes)} net ·{" "}
            {hours(member.deductions)} kesinti
          </p>
        </div>
        <Badge variant={member.utilization > 110 ? "destructive" : "outline"}>
          %{member.utilization}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {field("dailyCapacityMinutes", "Günlük dk")}
        {field("focusPercent", "Odak %")}
        {field("leaveMinutes", "İzin dk")}
        {field("meetingMinutes", "Toplantı dk")}
        {field("supportMinutes", "Destek dk")}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input
          aria-label="Disiplin dağılımları"
          className="h-8 text-xs"
          disabled={readOnly}
          placeholder="BACKEND:70, TESTING:30"
          value={form.allocations}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              allocations: event.target.value,
            }))
          }
        />
        <Input
          aria-label="Yetkinlikler"
          className="h-8 text-xs"
          disabled={readOnly}
          placeholder="Yetkinlikler, virgülle ayırın"
          value={form.skills}
          onChange={(event) =>
            setForm((current) => ({ ...current, skills: event.target.value }))
          }
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Progress
          value={Math.min(member.utilization, 100)}
          className="h-1.5 flex-1"
        />
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Kaydet
          </Button>
        )}
      </div>
    </div>
  );
}

function SessionTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 1000),
  );
  return (
    <Badge variant="outline" className="ml-2 tabular-nums">
      {String(Math.floor(seconds / 60)).padStart(2, "0")}:
      {String(seconds % 60).padStart(2, "0")}
    </Badge>
  );
}

function CapacityCalendar({
  sprintId,
  defaultDate,
  holidays,
  exceptions,
  onSaved,
}: {
  sprintId: string;
  defaultDate: string;
  holidays: import("@/services/sprint.service").SprintPlanningReport["holidays"];
  exceptions: import("@/services/sprint.service").SprintPlanningReport["exceptions"];
  onSaved: () => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(480);
  const [type, setType] = useState("MEETING");
  const holiday = useMutation({
    mutationFn: () =>
      sprintService.addPlanningHoliday(sprintId, {
        date,
        name,
        durationMinutes: minutes,
      }),
    onSuccess: () => {
      setName("");
      toast.success("Kurumsal tatil kaydedildi.");
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const exception = useMutation({
    mutationFn: () =>
      sprintService.addPlanningException(sprintId, {
        date,
        type,
        minutes,
        description: name,
      }),
    onSuccess: () => {
      setName("");
      toast.success("Kapasite kesintisi kaydedildi.");
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: ({
      kind,
      id,
    }: {
      kind: "holiday" | "exception";
      id: string;
    }) =>
      kind === "holiday"
        ? sprintService.deletePlanningHoliday(sprintId, id)
        : sprintService.deletePlanningException(sprintId, id),
    onSuccess: () => {
      toast.success("Takvim kaydı kaldırıldı.");
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const records = [
    ...holidays.map((row) => ({
      id: row.id,
      kind: "holiday" as const,
      label: row.name,
      date: row.date,
      minutes: row.durationMinutes ?? 480,
    })),
    ...exceptions.map((row) => ({
      id: row.id,
      kind: "exception" as const,
      label: row.description || row.type,
      date: row.date,
      minutes: row.minutes,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="rounded-xl border p-4">
      <h3 className="font-semibold">Takvim ve kapasite kesintileri</h3>
      <p className="text-xs text-muted-foreground">
        Resmî tatil, şirket günü, ortak toplantı ve eğitimleri net kapasiteden
        düşürün.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        <Input
          aria-label="Kesinti tarihi"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <Input
          aria-label="Kesinti açıklaması"
          placeholder="Açıklama"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger aria-label="Kesinti türü">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MEETING">Toplantı</SelectItem>
            <SelectItem value="TRAINING">Eğitim</SelectItem>
            <SelectItem value="SUPPORT">Destek</SelectItem>
            <SelectItem value="OTHER">Diğer</SelectItem>
          </SelectContent>
        </Select>
        <Input
          aria-label="Kesinti süresi dakika"
          type="number"
          min={1}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
        />
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant="outline"
            disabled={!name || holiday.isPending}
            onClick={() => holiday.mutate()}
          >
            Tatil ekle
          </Button>
          <Button
            className="flex-1"
            disabled={!name || exception.isPending}
            onClick={() => exception.mutate()}
          >
            Kesinti ekle
          </Button>
        </div>
      </div>
      {records.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {records.map((row) => (
            <Badge
              key={`${row.kind}-${row.id}`}
              variant="outline"
              className="gap-1.5 py-1"
            >
              <span>
                {new Date(row.date).toLocaleDateString("tr-TR")} · {row.label} ·{" "}
                {row.minutes} dk
              </span>
              <button
                type="button"
                aria-label={`${row.label} kaydını sil`}
                onClick={() => remove.mutate({ kind: row.kind, id: row.id })}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}

function PlanningEstimates({
  sprintId,
  items,
  onSaved,
}: {
  sprintId: string;
  items: import("@/services/sprint.service").SprintPlanningReport["planningItems"];
  onSaved: () => void;
}) {
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer font-semibold">
        Üç nokta tahminleri (PERT){" "}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {items.filter((item) => item.estimate).length}/{items.length} hazır
        </span>
      </summary>
      <p className="mt-1 text-xs text-muted-foreground">
        İyimser, olası ve kötümser süreler simülasyonun belirsizlik dağılımını
        oluşturur.
      </p>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {items.map((item) => (
          <EstimateRow
            key={item.id}
            sprintId={sprintId}
            item={item}
            onSaved={onSaved}
          />
        ))}
      </div>
    </details>
  );
}

function EstimateRow({
  sprintId,
  item,
  onSaved,
}: {
  sprintId: string;
  item: import("@/services/sprint.service").SprintPlanningReport["planningItems"][number];
  onSaved: () => void;
}) {
  const likelyFallback = (item.storyPoints ?? 1) * 360;
  const demand = item.estimate?.disciplineDemands?.[0];
  const [form, setForm] = useState({
    optimisticMinutes:
      item.estimate?.optimisticMinutes ?? Math.round(likelyFallback * 0.7),
    mostLikelyMinutes: item.estimate?.mostLikelyMinutes ?? likelyFallback,
    pessimisticMinutes:
      item.estimate?.pessimisticMinutes ?? Math.round(likelyFallback * 1.6),
    valueScore: item.estimate?.valueScore ?? 50,
    riskScore: item.estimate?.riskScore ?? 30,
    confidence: item.estimate?.confidence ?? 50,
    refinementReady: true,
    discipline: demand?.discipline ?? "GENERAL",
    skill: demand?.skill ?? "",
  });
  const mutation = useMutation({
    mutationFn: () =>
      sprintService.savePlanningEstimate(sprintId, item.id, {
        ...form,
        disciplineDemands: [
          {
            discipline: form.discipline,
            minutes: form.mostLikelyMinutes,
            ...(form.skill.trim() ? { skill: form.skill.trim() } : {}),
          },
        ],
      }),
    onSuccess: () => {
      toast.success(`${item.key} tahmini kaydedildi.`);
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const set = (key: keyof typeof form, value: number) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="grid items-end gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(180px,1fr)_repeat(6,76px)_100px_100px_72px]">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">
          <span className="font-mono">{item.key}</span> · {item.title}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {item.inSprint ? "Sprint kapsamında" : "Backlog"} ·{" "}
          {item.storyPoints ?? 0} SP
        </p>
      </div>
      {(
        [
          "optimisticMinutes",
          "mostLikelyMinutes",
          "pessimisticMinutes",
          "valueScore",
          "riskScore",
          "confidence",
        ] as const
      ).map((key, index) => (
        <label key={key} className="text-[9px] text-muted-foreground">
          {
            ["İyimser dk", "Olası dk", "Kötümser dk", "Değer", "Risk", "Güven"][
              index
            ]
          }
          <Input
            className="mt-1 h-7 px-2 text-xs"
            type="number"
            min={index < 3 ? 1 : 0}
            max={index < 3 ? undefined : 100}
            value={form[key]}
            onChange={(event) => set(key, Number(event.target.value))}
          />
        </label>
      ))}
      <label className="text-[9px] text-muted-foreground">
        Disiplin
        <Input
          className="mt-1 h-7 px-2 text-xs"
          value={form.discipline}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              discipline: event.target.value.toUpperCase(),
            }))
          }
        />
      </label>
      <label className="text-[9px] text-muted-foreground">
        Yetkinlik
        <Input
          className="mt-1 h-7 px-2 text-xs"
          value={form.skill}
          onChange={(event) =>
            setForm((current) => ({ ...current, skill: event.target.value }))
          }
        />
      </label>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <Save className="h-3.5 w-3.5" />
        <span className="sr-only">{item.key} tahminini kaydet</span>
      </Button>
    </div>
  );
}

function DependencyEditor({
  sprintId,
  items,
  onSaved,
}: {
  sprintId: string;
  items: import("@/services/sprint.service").SprintPlanningReport["planningItems"];
  onSaved: () => void;
}) {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      sprintService.addPlanningDependency(sprintId, {
        sourceWorkItemId: source,
        targetWorkItemId: target,
        type: "DEPENDS_ON",
      }),
    onSuccess: () => {
      setSource("");
      setTarget("");
      toast.success("İş bağımlılığı kaydedildi.");
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      sprintService.deletePlanningDependency(sprintId, id),
    onSuccess: () => {
      toast.success("İş bağımlılığı kaldırıldı.");
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const selector = (
    value: string,
    change: (value: string) => void,
    label: string,
  ) => (
    <Select value={value} onValueChange={change}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.key} · {item.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  const links = items.flatMap((item) =>
    item.dependencies.map((dependency) => ({
      ...dependency,
      source: item,
      target: items.find(
        (candidate) => candidate.id === dependency.targetWorkItemId,
      ),
    })),
  );
  return (
    <section className="rounded-xl border p-4">
      <h3 className="font-semibold">İş bağımlılıkları</h3>
      <p className="text-xs text-muted-foreground">
        Öncül işi tamamlanmamış kapsam önerilmez; döngüsel bağımlılıklar sistem
        tarafından reddedilir.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
        {selector(source, setSource, "Bağımlı iş")}
        <span className="self-center text-xs text-muted-foreground">
          şuna bağlı
        </span>
        {selector(target, setTarget, "Öncül iş")}
        <Button
          disabled={
            !source || !target || source === target || mutation.isPending
          }
          onClick={() => mutation.mutate()}
        >
          Bağla
        </Button>
      </div>
      {links.length > 0 && (
        <div className="mt-3 space-y-1">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded border px-2 py-1 text-xs"
            >
              <span>
                <strong>{link.source.key}</strong> →{" "}
                {link.target?.key ?? "Silinmiş iş"}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label={`${link.source.key} bağımlılığını sil`}
                onClick={() => remove.mutate(link.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
