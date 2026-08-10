import { ArrowUpRight, Bot, CircleAlert, Plus, ShieldCheck } from "lucide-react";
import type { Agent, Issue } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { timeAgo } from "@/lib/timeAgo";

import { AgentTopologyCanvas } from "./AgentTopologyCanvas";
import { extractHermesProfile } from "./command-center-model";

export type AgentRuntimeValidationStatus = "pass" | "warn" | "fail";

export interface AgentStudioProps {
  companyId: string;
  companyName: string;
  agents?: readonly Agent[];
  issues?: readonly Issue[];
  issuesError?: boolean;
  issuesLoading?: boolean;
  agentsError?: boolean;
  isLoading?: boolean;
  onValidateAgent?: (agent: Agent) => void;
  validatingAgentId?: string | null;
  validationByAgentId?: Readonly<Record<string, AgentRuntimeValidationStatus>>;
  validationErrorByAgentId?: Readonly<Record<string, true>>;
}

function formatStatus(status: Agent["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function adapterLabel(adapterType: string | null): string {
  if (adapterType === "hermes_local") return "Hermes local";
  if (adapterType === "hermes_gateway") return "Hermes gateway";
  return adapterType?.replace(/_/g, " ") ?? "No runtime configured";
}

function agentHref(agent: Agent): string {
  return `/agents/${encodeURIComponent(agent.urlKey || agent.id)}`;
}

function SpecialistCard({
  agent,
  onValidateAgent,
  isValidating = false,
  validationStatus,
  validationError = false,
  currentIssue,
  assignmentsUnavailable = false,
  assignmentsLoading = false,
}: {
  agent: Agent;
  onValidateAgent?: (agent: Agent) => void;
  isValidating?: boolean;
  validationStatus?: AgentRuntimeValidationStatus;
  validationError?: boolean;
  currentIssue?: Issue;
  assignmentsUnavailable?: boolean;
  assignmentsLoading?: boolean;
}) {
  const hermesProfile = extractHermesProfile(agent);
  const isHermesLocal = agent.adapterType === "hermes_local";
  const isHermes = isHermesLocal || agent.adapterType === "hermes_gateway";
  const href = agentHref(agent);

  return (
    <article className="ceo-agent-studio__agent-card" data-testid={`agent-studio-agent-${agent.id}`}>
      <div className="ceo-agent-studio__agent-card-header">
        <div className="ceo-agent-studio__agent-identity">
          <span className="ceo-agent-studio__agent-icon" aria-hidden="true"><Bot size={16} strokeWidth={1.8} /></span>
          <div>
            <p className="ceo-agent-studio__eyebrow">{agent.title || agent.role}</p>
            <h2>{agent.name}</h2>
          </div>
        </div>
        <span className={`ceo-agent-studio__status ceo-agent-studio__status--${agent.status}`}>
          {formatStatus(agent.status)}
        </span>
      </div>

      <div className="ceo-agent-studio__assignment">
        <span>Current assignment</span>
        {currentIssue ? (
          <Link to={`/issues/${encodeURIComponent(currentIssue.identifier ?? currentIssue.id)}`}>
            <strong>{currentIssue.identifier ?? currentIssue.id.slice(0, 8)}</strong>
            <span>{currentIssue.title}</span>
            <small>Updated {timeAgo(currentIssue.updatedAt)}</small>
          </Link>
        ) : assignmentsUnavailable ? (
          <p role="status" aria-live="polite">Assignment feed unavailable.</p>
        ) : assignmentsLoading ? (
          <p role="status" aria-live="polite">Loading current assignment.</p>
        ) : (
          <p>No active assignment.</p>
        )}
      </div>

      <details className="ceo-agent-studio__technical">
        <summary>Technical setup</summary>
        <dl className="ceo-agent-studio__agent-facts">
          <div>
            <dt>Runtime</dt>
            <dd>{adapterLabel(agent.adapterType)}</dd>
          </div>
          <div>
            <dt>Profile routing</dt>
            <dd>
              {isHermesLocal
                ? hermesProfile
                  ? `Hermes profile: ${hermesProfile}`
                  : "Default profile (shared)"
                : agent.adapterType === "hermes_gateway"
                  ? "Gateway-managed runtime"
                  : "Not a Hermes runtime"}
            </dd>
          </div>
          <div>
            <dt>Reporting line</dt>
            <dd>{agent.reportsTo ? "Configured in organisation" : "Founder-level or unassigned"}</dd>
          </div>
        </dl>
      </details>

      <div className="ceo-agent-studio__agent-actions">
        <Link to={href}>Open agent <ArrowUpRight size={14} /></Link>
        {isHermes && onValidateAgent ? (
          <button type="button" onClick={() => onValidateAgent(agent)} disabled={isValidating}>
            {isValidating ? "Validating runtime…" : "Validate runtime"}
          </button>
        ) : null}
        {isValidating ? <span className="sr-only" role="status" aria-live="polite">Runtime validation in progress.</span> : null}
        {validationError ? (
          <span className="ceo-agent-studio__validation ceo-agent-studio__validation--fail" role="status" aria-live="polite">
            Runtime check unavailable
          </span>
        ) : validationStatus ? (
          <span className={`ceo-agent-studio__validation ceo-agent-studio__validation--${validationStatus}`} role="status" aria-live="polite">
            Runtime check: {validationStatus}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function RuntimeInventory({ agents, error = false }: { agents?: readonly Agent[]; error?: boolean }) {
  return (
    <section className="ceo-agent-studio__runtime" aria-labelledby="agent-studio-runtime-title">
      <div className="ceo-agent-studio__section-heading">
        <div>
          <p className="ceo-agent-studio__eyebrow">Technical operations</p>
          <h2 id="agent-studio-runtime-title">Model routing</h2>
        </div>
        <Link to="/agents/all">Open runtime registry <ArrowUpRight size={14} /></Link>
      </div>
      {error ? (
        <p className="ceo-agent-studio__runtime-state">Runtime routes could not be loaded.</p>
      ) : agents === undefined ? (
        <p className="ceo-agent-studio__runtime-state">Loading runtime routes.</p>
      ) : agents.length === 0 ? (
        <p className="ceo-agent-studio__runtime-state">No runtime routes are configured.</p>
      ) : (
        <div className="ceo-agent-studio__runtime-list">
          {[...agents]
            .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))
            .map((agent) => {
              const profile = agent.adapterType === "hermes_local" ? extractHermesProfile(agent) : null;
              return (
                <Link key={agent.id} to={agentHref(agent)} className="ceo-agent-studio__runtime-row">
                  <span>{agent.name}</span>
                  <span>{adapterLabel(agent.adapterType)}</span>
                  <span>{profile ? `Hermes profile: ${profile}` : agent.adapterType === "hermes_gateway" ? "Gateway managed" : "No isolated profile"}</span>
                </Link>
              );
            })}
        </div>
      )}
    </section>
  );
}

function assignmentRank(issue: Issue): number {
  if (issue.status === "in_progress") return 0;
  if (issue.status === "in_review") return 1;
  if (issue.status === "todo") return 2;
  return 3;
}

export function AgentStudio({
  companyId,
  companyName,
  agents,
  issues,
  issuesError = false,
  issuesLoading = false,
  agentsError = false,
  isLoading = false,
  onValidateAgent,
  validatingAgentId = null,
  validationByAgentId = {},
  validationErrorByAgentId = {},
}: AgentStudioProps) {
  const agentsPending = isLoading || (agents === undefined && !agentsError);
  const visibleAgents = (agents ?? []).filter((agent) => agent.status !== "terminated");
  const isolatedProfiles = visibleAgents.filter(
    (agent) => agent.adapterType === "hermes_local" && extractHermesProfile(agent),
  ).length;
  const runningAgents = visibleAgents.filter((agent) => agent.status === "running").length;
  const visibleAgentIds = new Set(visibleAgents.map((agent) => agent.id));
  const currentIssueByAgentId = new Map<string, Issue>();
  for (const issue of [...(issues ?? [])]
    .filter((candidate) => candidate.assigneeAgentId
      && visibleAgentIds.has(candidate.assigneeAgentId)
      && assignmentRank(candidate) < 3)
    .sort((left, right) => assignmentRank(left) - assignmentRank(right)
      || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())) {
    if (issue.assigneeAgentId && !currentIssueByAgentId.has(issue.assigneeAgentId)) {
      currentIssueByAgentId.set(issue.assigneeAgentId, issue);
    }
  }

  return (
    <main className="ceo-agent-studio" data-testid="ceo-agent-studio">
      <section className="ceo-agent-studio__hero">
        <div>
          <p className="ceo-agent-studio__kicker">CEO Agent operating system</p>
          <h1>Agent Studio</h1>
          <p className="ceo-agent-studio__intro">
            See who owns each outcome, what they are working on, and whether the operating roster for <strong>{companyName}</strong> is ready.
          </p>
        </div>
        <div className="ceo-agent-studio__hero-actions">
          <Link to="/agents/new" className="ceo-agent-studio__primary-action">
            <Plus size={16} /> Add specialist
          </Link>
          <Link to="/org" className="ceo-agent-studio__secondary-action">
            View organisation <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>

      <section className="ceo-agent-studio__readiness" aria-label="Specialist readiness">
        <div>
          <span>Roster</span>
          {agentsError ? (
            <strong role="status" aria-live="polite">Unavailable</strong>
          ) : agentsPending ? (
            <strong role="status" aria-live="polite">Loading</strong>
          ) : (
            <strong>{visibleAgents.length}</strong>
          )}
          <small>{agentsError ? "agent registry unavailable" : agentsPending ? "loading agent registry" : visibleAgents.length === 1 ? "connected agent" : "connected agents"}</small>
        </div>
        <div>
          <span>Running now</span>
          {agentsError ? (
            <strong role="status" aria-live="polite">Unavailable</strong>
          ) : agentsPending ? (
            <strong role="status" aria-live="polite">Loading</strong>
          ) : (
            <strong>{runningAgents}</strong>
          )}
          <small>{agentsError ? "agent registry unavailable" : agentsPending ? "loading agent activity" : "agents executing"}</small>
        </div>
        <div>
          <span>Active work</span>
          {agentsError || issuesError ? (
            <strong role="status" aria-live="polite">Unavailable</strong>
          ) : agentsPending || issuesLoading || issues === undefined ? (
            <strong role="status" aria-live="polite">Loading</strong>
          ) : (
            <strong>{currentIssueByAgentId.size}</strong>
          )}
          <small>{agentsError ? "agent registry unavailable" : issuesError ? "assignment feed unavailable" : agentsPending ? "loading agent registry" : issuesLoading || issues === undefined ? "loading assignments" : "owned assignments"}</small>
        </div>
        <div>
          <span>Profile routes</span>
          {agentsError ? (
            <strong role="status" aria-live="polite">Unavailable</strong>
          ) : agentsPending ? (
            <strong role="status" aria-live="polite">Loading</strong>
          ) : (
            <strong>{isolatedProfiles}</strong>
          )}
          <small>{agentsError ? "agent registry unavailable" : agentsPending ? "loading profile routes" : "isolated Hermes profiles"}</small>
        </div>
      </section>

      <section className="ceo-agent-studio__setup-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <p>Founder-controlled activation</p>
          <span>Every specialist needs a mandate, an approval boundary, a budget, and a validated runtime before autonomous work begins.</span>
        </div>
      </section>

      <section className="ceo-agent-studio__roster" aria-labelledby="agent-studio-roster-title">
        <div className="ceo-agent-studio__section-heading">
          <div>
            <p className="ceo-agent-studio__eyebrow">Specialist roster</p>
            <h2 id="agent-studio-roster-title">Who owns what</h2>
          </div>
          <Link to="/agents/all">Open complete registry <ArrowUpRight size={14} /></Link>
        </div>

        {agentsError ? (
          <div className="ceo-agent-studio__state ceo-agent-studio__state--error">
            <CircleAlert size={18} aria-hidden="true" />
            <div>
              <strong>Agent registry could not be loaded.</strong>
              <span>Check the company control-plane connection, then reload before making operating decisions.</span>
            </div>
          </div>
        ) : agentsPending ? (
          <div className="ceo-agent-studio__state">Loading live company agent registry.</div>
        ) : visibleAgents.length === 0 ? (
          <div className="ceo-agent-studio__empty">
            <Bot size={22} aria-hidden="true" />
            <div>
              <strong>No agents are connected to this company yet.</strong>
              <span>Start a specialist only when its mandate, profile isolation, budget, and approval boundary are defined.</span>
            </div>
            <Link to="/agents/new">Add first specialist <ArrowUpRight size={14} /></Link>
          </div>
        ) : (
          <div className="ceo-agent-studio__agent-grid">
            {visibleAgents.map((agent) => (
              <SpecialistCard
                key={agent.id}
                agent={agent}
                currentIssue={currentIssueByAgentId.get(agent.id)}
                assignmentsUnavailable={issuesError}
                assignmentsLoading={issuesLoading || issues === undefined}
                onValidateAgent={onValidateAgent}
                isValidating={validatingAgentId === agent.id}
                validationStatus={validationByAgentId[agent.id]}
                validationError={validationErrorByAgentId[agent.id] === true}
              />
            ))}
          </div>
        )}
      </section>

      <div className="ceo-agent-studio__technical-grid">
        <RuntimeInventory agents={agents === undefined ? undefined : visibleAgents} error={agentsError} />
        <div className="ceo-agent-studio__topology">
          <AgentTopologyCanvas
            companyId={companyId}
            agents={agents ? [...visibleAgents] : undefined}
            error={agentsError}
          />
        </div>
      </div>
    </main>
  );
}
