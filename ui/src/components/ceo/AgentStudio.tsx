import { ArrowUpRight, Bot, CircleAlert, Plus, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { Agent } from "@paperclipai/shared";
import { Link } from "@/lib/router";

import { extractHermesProfile } from "./command-center-model";

export type AgentRuntimeValidationStatus = "pass" | "warn" | "fail";

export interface AgentStudioProps {
  companyId: string;
  companyName: string;
  agents?: readonly Agent[];
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
}: {
  agent: Agent;
  onValidateAgent?: (agent: Agent) => void;
  isValidating?: boolean;
  validationStatus?: AgentRuntimeValidationStatus;
  validationError?: boolean;
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

      <div className="ceo-agent-studio__agent-actions">
        <Link to={href}>Open operating record <ArrowUpRight size={14} /></Link>
        <Link to={href}>Configure <SlidersHorizontal size={14} /></Link>
        {isHermes && onValidateAgent ? (
          <button type="button" onClick={() => onValidateAgent(agent)} disabled={isValidating}>
            {isValidating ? "Validating runtime…" : "Validate runtime"}
          </button>
        ) : null}
        {validationError ? (
          <span className="ceo-agent-studio__validation ceo-agent-studio__validation--fail">
            Runtime check unavailable
          </span>
        ) : validationStatus ? (
          <span className={`ceo-agent-studio__validation ceo-agent-studio__validation--${validationStatus}`}>
            Runtime check: {validationStatus}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function AgentStudio({
  companyId,
  companyName,
  agents,
  agentsError = false,
  isLoading = false,
  onValidateAgent,
  validatingAgentId = null,
  validationByAgentId = {},
  validationErrorByAgentId = {},
}: AgentStudioProps) {
  const visibleAgents = (agents ?? []).filter((agent) => agent.status !== "terminated");
  const hermesAgents = visibleAgents.filter(
    (agent) => agent.adapterType === "hermes_local" || agent.adapterType === "hermes_gateway",
  );
  const isolatedProfiles = visibleAgents.filter(
    (agent) => agent.adapterType === "hermes_local" && extractHermesProfile(agent),
  ).length;

  return (
    <main className="ceo-agent-studio" data-testid="ceo-agent-studio">
      <section className="ceo-agent-studio__hero">
        <div>
          <p className="ceo-agent-studio__kicker">CEO Agent / operating system</p>
          <h1>Agent <em>Studio</em></h1>
          <p className="ceo-agent-studio__intro">
            Design the operating roster for <strong>{companyName}</strong>. Agent records, runtime routes, and profile labels below are read from this company’s control plane.
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
          <strong>{visibleAgents.length}</strong>
          <small>{visibleAgents.length === 1 ? "connected agent" : "connected agents"}</small>
        </div>
        <div>
          <span>Hermes routes</span>
          <strong>{hermesAgents.length}</strong>
          <small>explicit Hermes adapters</small>
        </div>
        <div>
          <span>Profile routes</span>
          <strong>{isolatedProfiles}</strong>
          <small>configured profile labels</small>
        </div>
        <div>
          <span>Scope</span>
          <strong className="ceo-agent-studio__scope-id">{companyId.slice(0, 8)}</strong>
          <small>company control plane</small>
        </div>
      </section>

      <section className="ceo-agent-studio__setup-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <p>Founder-controlled activation</p>
          <span>Define a mandate, select an isolated Hermes profile where needed, set budget and approval boundaries, then validate the runtime in the agent’s operating record before its first wake-up.</span>
        </div>
      </section>

      <section className="ceo-agent-studio__roster" aria-labelledby="agent-studio-roster-title">
        <div className="ceo-agent-studio__section-heading">
          <div>
            <p className="ceo-agent-studio__eyebrow">Live company roster</p>
            <h2 id="agent-studio-roster-title">Specialist registry</h2>
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
        ) : isLoading ? (
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
                onValidateAgent={onValidateAgent}
                isValidating={validatingAgentId === agent.id}
                validationStatus={validationByAgentId[agent.id]}
                validationError={validationErrorByAgentId[agent.id] === true}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
