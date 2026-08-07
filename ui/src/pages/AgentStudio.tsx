import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import type { Agent } from "@paperclipai/shared";

import { agentsApi } from "../api/agents";
import { instanceSettingsApi } from "../api/instanceSettings";
import { AgentStudio } from "../components/ceo/AgentStudio";
import type { AgentRuntimeValidationStatus } from "../components/ceo/AgentStudio";
import { EmptyState } from "../components/EmptyState";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { buildAgentRuntimeValidationRequest } from "../lib/agent-runtime-validation";
import { queryKeys } from "../lib/queryKeys";

export function AgentStudioPage() {
  const { selectedCompanyId, companies } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [validationByAgentId, setValidationByAgentId] = useState<Record<string, AgentRuntimeValidationStatus>>({});
  const [validationErrorsByAgentId, setValidationErrorsByAgentId] = useState<Record<string, true>>({});

  const runtimeValidation = useMutation({
    mutationFn: async (agent: Agent) => {
      if (!selectedCompanyId || !agent.adapterType) throw new Error("Agent runtime is not configured.");
      const settings = agent.defaultEnvironmentId
        ? null
        : await queryClient.ensureQueryData({
          queryKey: queryKeys.instance.settings,
          queryFn: () => instanceSettingsApi.get(),
        });
      const request = buildAgentRuntimeValidationRequest(agent, settings?.defaultEnvironmentId);
      const result = await agentsApi.testEnvironment(
        selectedCompanyId,
        request.adapterType,
        request.data,
      );
      return { agentId: agent.id, status: result.status };
    },
    onMutate: (agent) => {
      setValidationErrorsByAgentId((current) => {
        const { [agent.id]: _cleared, ...rest } = current;
        return rest;
      });
    },
    onSuccess: ({ agentId, status }) => {
      setValidationByAgentId((current) => ({ ...current, [agentId]: status }));
    },
    onError: (_error, agent) => {
      setValidationErrorsByAgentId((current) => ({ ...current, [agent.id]: true }));
    },
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Agent Studio" }]);
  }, [setBreadcrumbs]);

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={Bot}
        message={companies.length === 0
          ? "Create a company before designing its CEO Agent operating roster."
          : "Select a company to open its CEO Agent Studio."}
      />
    );
  }

  const companyName = companies.find((company) => company.id === selectedCompanyId)?.name ?? "Selected company";
  return (
    <AgentStudio
      companyId={selectedCompanyId}
      companyName={companyName}
      agents={agentsQuery.data}
      agentsError={Boolean(agentsQuery.error && agentsQuery.data === undefined)}
      isLoading={agentsQuery.isLoading}
      onValidateAgent={(agent) => runtimeValidation.mutate(agent)}
      validatingAgentId={runtimeValidation.isPending ? runtimeValidation.variables?.id ?? null : null}
      validationByAgentId={validationByAgentId}
      validationErrorByAgentId={validationErrorsByAgentId}
    />
  );
}
