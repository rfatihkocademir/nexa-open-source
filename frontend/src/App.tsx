import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "@/components/AppShell"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import LoginPage from "@/pages/auth/LoginPage"
import OidcCallbackPage from "@/pages/auth/OidcCallbackPage"
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage"
import VerifyEmailPage from "@/pages/auth/VerifyEmailPage"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { testCaseService } from "@/services/testCase.service"
import { resourceService } from "@/services/resource.service"
import { projectService } from "@/services/project.service"
import { AppDialogProvider } from "@/components/ui/app-dialog-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthSessionBootstrap } from "@/components/auth/AuthSessionBootstrap"
import { appRoutes, projectTabFromSection, projectSectionFromTab } from "@/lib/routes"
import { queryKeys } from "@/lib/queryKeys"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

import { LoadingSpinner } from "@/components/ui/loading-spinner"

// Lazy load pages
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"))
const ProjectsPage = lazy(() => import("@/pages/projects/ProjectsPage"))
const ProjectDetailsPage = lazy(() => import("@/pages/projects/ProjectDetailsPage"))
const ReleaseCandidateDetailsPage = lazy(() => import("@/pages/projects/ReleaseCandidateDetailsPage"))
const TestCaseDetailsPage = lazy(() => import("@/pages/projects/TestCaseDetailsPage"))
const TestRunDetailsPage = lazy(() => import("@/pages/projects/TestRunDetailsPage"))
const TestRunsPage = lazy(() => import("@/pages/runs/TestRunsPage"))
const MilestonesPage = lazy(() => import("@/pages/milestones/MilestonesPage"))
const MilestoneDetailsPage = lazy(() => import("@/pages/projects/MilestoneDetailsPage"))
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage"))
const ReportDetailsPage = lazy(() => import("@/pages/reports/ReportDetailsPage"))
const WorkItemDetailsPage = lazy(() => import("@/pages/projects/agile/WorkItemDetailsPage"))
const ProfilePage = lazy(() => import("@/pages/profile/ProfilePage"))
const UserManagementPage = lazy(() => import("@/pages/admin/UserManagementPage"))
const AuditLogPage = lazy(() => import("@/pages/admin/AuditLogPage"))
const EnterpriseSecurityPage = lazy(() => import("@/pages/admin/EnterpriseSecurityPage"))
const SecurityOperationsPage = lazy(() => import("@/pages/admin/SecurityOperationsPage"))
const OperationalReadinessPage = lazy(() => import("@/pages/admin/OperationalReadinessPage"))
const PortfolioPage = lazy(() => import("@/pages/portfolio/PortfolioPage"))
const DashboardStudioPage = lazy(() => import("@/pages/dashboard-studio/DashboardStudioPage"))
const ActionCenterPage = lazy(() => import("@/pages/action-center/ActionCenterPage"))
const ServiceDeskPage = lazy(() => import("@/pages/service-desk/ServiceDeskPage").then(m => ({ default: m.ServiceDeskPage })))
const CustomerPortalPage = lazy(() => import("@/pages/service-desk/CustomerPortalPage").then(m => ({ default: m.CustomerPortalPage })))
const SlaConfigurationPage = lazy(() => import("@/pages/service-desk/SlaConfigurationPage").then(m => ({ default: m.SlaConfigurationPage })))
const AutomationCoverageDashboard = lazy(() => import("@/pages/automation/AutomationCoverageDashboard").then(m => ({ default: m.AutomationCoverageDashboard })))
const ForbiddenPage = lazy(() => import("@/pages/ForbiddenPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))

import { CommandMenu } from "@/components/command-menu"

function ProjectTabRedirect({ tab }: { tab: string }) {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) {
    return <Navigate to="/projects" replace />
  }
  return <Navigate to={`/projects/${projectId}?tab=${tab}`} replace />
}

function TestCaseShortcutRedirect() {
  const { caseId } = useParams<{ caseId: string }>()
  const isUuid = !!caseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseId)
  const { data: testCase, isLoading, isError } = useQuery({
    queryKey: ["testCase-shortcut", caseId],
    queryFn: () => isUuid ? testCaseService.getById(caseId!) : testCaseService.getByKey(caseId!),
    enabled: !!caseId,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !testCase?.suite?.projectId) return <NotFoundPage />

  return <Navigate to={`/b/${encodeURIComponent(testCase.key)}?tab=automation`} replace />
}

function ResourcePage() {
  const { resourceKey, issueKey } = useParams<{ resourceKey?: string; issueKey?: string }>()
  const requestedKey = resourceKey ?? issueKey
  const { data: resource, isLoading, isError } = useQuery({
    queryKey: queryKeys.resources.detail(requestedKey),
    queryFn: () => resourceService.resolve(requestedKey!),
    enabled: !!requestedKey,
    retry: false,
  })

  if (isLoading) {
    return <div className="flex h-full min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
  }
  if (isError || !resource) return <NotFoundPage />

  switch (resource.type) {
    case 'WORK_ITEM':
      return <WorkItemDetailsPage resourceKey={resource.key} />
    case 'TEST_CASE':
      return <TestCaseDetailsPage resourceId={resource.id} resourceProjectId={resource.projectId ?? undefined} resourceProjectKey={resource.projectKey ?? undefined} />
    case 'TEST_RUN':
      return <TestRunDetailsPage resourceId={resource.id} resourceProjectKey={resource.projectKey ?? undefined} />
    case 'MILESTONE':
      return <MilestoneDetailsPage resourceId={resource.id} resourceProjectKey={resource.projectKey ?? undefined} />
    case 'RELEASE_CANDIDATE':
      return <ReleaseCandidateDetailsPage resourceId={resource.id} resourceProjectId={resource.projectId ?? undefined} resourceProjectKey={resource.projectKey ?? undefined} />
    case 'WIKI_PAGE':
      return <ProjectDetailsPage resourceId={resource.projectId ?? undefined} defaultTab="wiki" initialWikiPageId={resource.id} />
    default:
      return <NotFoundPage />
  }
}

function ProjectPage() {
  const { projectKey, section } = useParams<{ projectKey: string; section?: string }>()
  const { data: project, isLoading } = useQuery({
    queryKey: queryKeys.resources.project(projectKey),
    queryFn: () => resourceService.resolveProject(projectKey!),
    enabled: !!projectKey,
    retry: false,
  })

  if (isLoading) return <div className="flex h-full min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
  const tab = projectTabFromSection(section)
  if (!project || tab === null) return <NotFoundPage />
  
  return <ProjectDetailsPage resourceId={project.id} defaultTab={tab} />
}

function CanonicalProjectPage() {
  const location = useLocation()
  const { teamSlug, projectSlug, section } = useParams<{ teamSlug: string; projectSlug: string; section?: string }>()
  const { data: project, isLoading, isError } = useQuery({
    queryKey: queryKeys.resources.project(projectSlug),
    queryFn: () => resourceService.resolveProject(projectSlug!),
    enabled: !!projectSlug,
    retry: false,
  })
  if (isLoading) return <div className="flex h-full min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
  if (isError || !project) return <NotFoundPage />
  const tab = projectTabFromSection(section)
  if (tab === null) return <NotFoundPage />
  const requestedBase = `/${teamSlug}/${projectSlug}`.toLowerCase()
  if (requestedBase !== project.canonicalPath.toLowerCase()) {
    const destination = section ? `${project.canonicalPath}/${section}` : project.canonicalPath
    return <Navigate to={`${destination}${location.search}`} replace />
  }
  return <ProjectDetailsPage resourceId={project.id} defaultTab={tab} />
}

function LegacyProjectRedirect() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const { data: project, isLoading, isError } = useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projectService.getById(projectId!),
    enabled: !!projectId,
    retry: false,
  })

  if (isLoading) return <div className="flex h-full min-h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
  if (isError || !project) return <NotFoundPage />

  const nextParams = new URLSearchParams(searchParams)
  const section = projectSectionFromTab(nextParams.get('tab'))
  nextParams.delete('tab')
  return (
    <Navigate
      to={section
        ? appRoutes.projectSection(project.key, section, nextParams)
        : `${appRoutes.project(project.key)}${nextParams.size ? `?${nextParams}` : ''}`}
      replace
    />
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TooltipProvider>
        <BrowserRouter>
          <AuthSessionBootstrap>
          <AppDialogProvider>
          <CommandMenu />
          <ErrorBoundary>
            <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<OidcCallbackPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/c/:caseId" element={<TestCaseShortcutRedirect />} />
                <Route path="/tc/:caseId" element={<TestCaseShortcutRedirect />} />
                <Route element={<AppShell />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/dashboards" element={<DashboardStudioPage />} />
                  <Route path="/inbox" element={<ActionCenterPage />} />
                  <Route path="/service-desk" element={<ServiceDeskPage />} />
                  <Route path="/portal" element={<CustomerPortalPage />} />
                  <Route path="/settings/sla" element={<SlaConfigurationPage />} />

                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/p/:projectKey" element={<ProjectPage />} />
                  <Route path="/p/:projectKey/:section" element={<ProjectPage />} />
                  <Route path="/projects/:projectId" element={<LegacyProjectRedirect />} />
                  <Route path="/projects/:projectId/releases/:releaseId" element={<ReleaseCandidateDetailsPage />} />
                  <Route path="/projects/:projectId/wiki" element={<ProjectTabRedirect tab="wiki" />} />
                  <Route path="/projects/:projectId/board" element={<ProjectTabRedirect tab="board" />} />
                  <Route path="/projects/:projectId/ai-analyst" element={<ProjectTabRedirect tab="ai-analyst" />} />
                  <Route path="/projects/:projectId/cases/:caseId" element={<TestCaseDetailsPage />} />
                  <Route path="/b/:resourceKey" element={<ResourcePage />} />
                  <Route path="/browse/:issueKey" element={<ResourcePage />} />

                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/reports/:reportId" element={<ReportDetailsPage />} />
                  <Route path="/portfolio" element={<PortfolioPage />} />

                  <Route path="/runs" element={<TestRunsPage />} />
                  <Route path="/runs/:runId" element={<TestRunDetailsPage />} />
                  <Route path="/automation-grid" element={<AutomationCoverageDashboard projectId="global" />} />

                  <Route path="/milestones" element={<MilestonesPage />} />
                  <Route path="/milestones/:milestoneId" element={<MilestoneDetailsPage />} />

                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<ProfilePage />} /> {/* Alias for settings for now */}

                  <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                    <Route path="/admin/users" element={<UserManagementPage />} />
                    <Route path="/admin/audit" element={<AuditLogPage />} />
                    <Route path="/admin/security" element={<EnterpriseSecurityPage />} />
                    <Route path="/admin/security-operations" element={<SecurityOperationsPage />} />
                    <Route path="/admin/operations" element={<OperationalReadinessPage />} />
                  </Route>

                  <Route path="/403" element={<ForbiddenPage />} />
                  <Route path="/:teamSlug/:projectSlug/:resourceType/:resourceKey/:titleSlug?" element={<ResourcePage />} />
                  <Route path="/:teamSlug/:projectSlug/:section?" element={<CanonicalProjectPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
            </Suspense>
          </ErrorBoundary>
          </AppDialogProvider>
          </AuthSessionBootstrap>
        </BrowserRouter>
        </TooltipProvider>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider >
  )
}

export default App
