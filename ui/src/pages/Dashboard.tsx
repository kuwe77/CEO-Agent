import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import type { Agent } from "@paperclipai/shared";
import { artifactsApi } from "../api/artifacts";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { accessApi } from "../api/access";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { buildCompanyUserProfileMap } from "../lib/company-members";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { CommandCenter } from "../components/ceo/CommandCenter";
import { usePublishSharedQueryData, useSharedPollingQuery } from "../hooks/useSharedPolling";

const DASHBOARD_ACTIVITY_LIMIT = 10;
const DASHBOARD_ARTIFACT_LIMIT = 5;

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Command Center" }]);
  }, [setBreadcrumbs]);

  const dashboardQueryKey = queryKeys.dashboard(selectedCompanyId!);
  const sharedDashboard = useSharedPollingQuery({
    companyId: selectedCompanyId,
    resourceKey: "dashboard",
    queryKey: dashboardQueryKey,
    enabled: !!selectedCompanyId,
  });
  const dashboardQuery = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  usePublishSharedQueryData(sharedDashboard, dashboardQuery.data, dashboardQuery.dataUpdatedAt);

  const activityQueryKey = [...queryKeys.activity(selectedCompanyId!), { limit: DASHBOARD_ACTIVITY_LIMIT }] as const;
  const sharedActivity = useSharedPollingQuery({
    companyId: selectedCompanyId,
    resourceKey: `activity:limit:${DASHBOARD_ACTIVITY_LIMIT}`,
    queryKey: activityQueryKey,
    enabled: !!selectedCompanyId,
  });
  const activityQuery = useQuery({
    queryKey: activityQueryKey,
    queryFn: () => activityApi.list(selectedCompanyId!, { limit: DASHBOARD_ACTIVITY_LIMIT }),
    enabled: !!selectedCompanyId,
  });
  usePublishSharedQueryData(sharedActivity, activityQuery.data, activityQuery.dataUpdatedAt);

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const issuesQuery = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!, { includeArchived: true }),
    queryFn: () => projectsApi.list(selectedCompanyId!, { includeArchived: true }),
    enabled: !!selectedCompanyId,
  });
  const companyMembersQuery = useQuery({
    queryKey: queryKeys.access.companyUserDirectory(selectedCompanyId!),
    queryFn: () => accessApi.listUserDirectory(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const artifactsQuery = useQuery({
    queryKey: [...queryKeys.artifacts.list(selectedCompanyId!), { scope: "command-center", limit: DASHBOARD_ARTIFACT_LIMIT }] as const,
    queryFn: () => artifactsApi.list(selectedCompanyId!, { limit: DASHBOARD_ARTIFACT_LIMIT }),
    enabled: !!selectedCompanyId,
  });

  const userProfileMap = useMemo(
    () => buildCompanyUserProfileMap(companyMembersQuery.data?.users),
    [companyMembersQuery.data?.users],
  );
  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agentsQuery.data ?? []) map.set(agent.id, agent);
    return map;
  }, [agentsQuery.data]);
  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of issuesQuery.data ?? []) map.set(`issue:${issue.id}`, issue.identifier ?? issue.id.slice(0, 8));
    for (const agent of agentsQuery.data ?? []) map.set(`agent:${agent.id}`, agent.name);
    for (const project of projectsQuery.data ?? []) map.set(`project:${project.id}`, project.name);
    return map;
  }, [issuesQuery.data, agentsQuery.data, projectsQuery.data]);
  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of issuesQuery.data ?? []) map.set(`issue:${issue.id}`, issue.title);
    return map;
  }, [issuesQuery.data]);

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Create a company and connect its first agent to open the CEO Agent Command Center."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return <EmptyState icon={LayoutDashboard} message="Select a company to open its CEO Agent Command Center." />;
  }

  if (dashboardQuery.isLoading) return <PageSkeleton variant="dashboard" />;

  if (dashboardQuery.error || !dashboardQuery.data) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        message="The command center could not load live company data. Check the connection and try again."
      />
    );
  }

  const companyName = companies.find((company) => company.id === selectedCompanyId)?.name ?? "Selected company";
  return (
    <CommandCenter
      companyId={selectedCompanyId}
      companyName={companyName}
      summary={dashboardQuery.data}
      agents={agentsQuery.data}
      issues={issuesQuery.data}
      artifacts={artifactsQuery.data?.artifacts}
      activity={activityQuery.data}
      agentMap={agentMap}
      userProfileMap={userProfileMap}
      entityNameMap={entityNameMap}
      entityTitleMap={entityTitleMap}
      lastUpdatedAt={dashboardQuery.dataUpdatedAt ? new Date(dashboardQuery.dataUpdatedAt) : null}
      agentsError={Boolean(agentsQuery.error && agentsQuery.data === undefined)}
      issuesError={Boolean(issuesQuery.error && issuesQuery.data === undefined)}
      artifactsError={Boolean(artifactsQuery.error)}
      activityError={Boolean(activityQuery.error)}
    />
  );
}
