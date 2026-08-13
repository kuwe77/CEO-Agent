import type { ActivityEvent, Agent, DashboardSummary, Issue } from "@paperclipai/shared";
import type { CompanyArtifact } from "@/api/artifacts";
import { ActivityRow } from "@/components/ActivityRow";
import { ActiveAgentsPanel } from "@/components/ActiveAgentsPanel";
import { StatusIcon } from "@/components/StatusIcon";
import { Link } from "@/lib/router";
import { formatCents } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import { PluginSlotOutlet } from "@/plugins/slots";
import type { CompanyUserProfile } from "@/lib/company-members";
import { ArrowUpRight, Bot, CircleDot, FileText, ShieldCheck, WalletCards } from "lucide-react";
import { getOperationalState } from "./command-center-model";

interface CommandCenterProps {
  companyId: string;
  companyName: string;
  summary: DashboardSummary;
  agents?: Agent[];
  issues?: Issue[];
  artifacts?: CompanyArtifact[];
  activity?: ActivityEvent[];
  agentMap: Map<string, Agent>;
  userProfileMap: Map<string, CompanyUserProfile>;
  entityNameMap: Map<string, string>;
  entityTitleMap: Map<string, string>;
  lastUpdatedAt: Date | null;
  agentsError?: boolean;
  issuesError?: boolean;
  artifactsError?: boolean;
  activityError?: boolean;
}

function sectionLink(to: string, label: string) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-ceo-accent hover:underline">
      {label}
      <ArrowUpRight className="h-3 w-3" aria-hidden />
    </Link>
  );
}

function attentionLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function MetricRail({ summary }: { summary: DashboardSummary }) {
  const enabledAgents = summary.agents.active + summary.agents.running + summary.agents.paused + summary.agents.error;
  const approvalCount = summary.pendingApprovals;
  const metrics = [
    { label: "Operating capacity", value: enabledAgents, detail: `${summary.agents.running} agents running`, to: "/agents", icon: Bot },
    { label: "Delivery", value: summary.tasks.inProgress, detail: `${summary.tasks.blocked} blocked of ${summary.tasks.open} open`, to: "/issues", icon: CircleDot },
    {
      label: "Spend / budget",
      value: formatCents(summary.costs.monthSpendCents),
      detail: summary.costs.monthBudgetCents > 0
        ? `${summary.costs.monthUtilizationPercent}% of ${formatCents(summary.costs.monthBudgetCents)}`
        : "No monthly budget set",
      to: "/costs",
      icon: WalletCards,
    },
    { label: "Decision load", value: approvalCount, detail: approvalCount === 0 ? "No board decisions waiting" : "Awaiting board review", to: "/approvals", icon: ShieldCheck },
  ];

  return (
    <div className="ceo-command-center__health-grid grid sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Link key={metric.label} to={metric.to} className="group p-3 no-underline transition-colors hover:bg-accent/50">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{metric.label}</span>
              <Icon className="h-3.5 w-3.5 text-ceo-accent" aria-hidden />
            </div>
            <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-foreground">{metric.value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{metric.detail}</p>
          </Link>
        );
      })}
    </div>
  );
}

function FounderAttention({ summary }: { summary: DashboardSummary }) {
  const approvalCount = summary.pendingApprovals;
  const standaloneBudgetIncidentCount = Math.max(
    0,
    summary.budgets.activeIncidents - summary.budgets.pendingApprovals,
  );
  const attention = [
    { count: approvalCount, label: "pending approval", to: "/approvals" },
    { count: summary.tasks.blocked, label: "blocked task", to: "/issues?attention=blocked" },
    { count: summary.agents.error, label: "agent error", to: "/agents" },
    { count: standaloneBudgetIncidentCount, label: "budget incident", to: "/costs" },
  ].filter((item) => item.count > 0);
  const attentionTotal = attention.reduce((total, item) => total + item.count, 0);

  return (
    <section className={`ceo-command-center__today-panel ceo-command-center__today-panel--${attention.length > 0 ? "alert" : "clear"}`} aria-label="Founder attention">
      <div className="ceo-command-center__today-heading">
        <div>
          <p className="ceo-command-center__section-label">Today</p>
          <h2>Founder attention</h2>
        </div>
        <span className="ceo-command-center__today-count">{attentionTotal}</span>
      </div>
      {attention.length === 0 ? (
        <div className="ceo-command-center__clear-state">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <div>
            <p>No exceptions requiring founder attention.</p>
            <span>Operations are within the defined approval, delivery, and budget boundaries.</span>
          </div>
        </div>
      ) : (
        <div className="ceo-command-center__attention-list">
          {attention.map((item, index) => (
            <Link key={item.label} to={item.to} className="ceo-command-center__attention-item">
              <span className="ceo-command-center__attention-index">{String(index + 1).padStart(2, "0")}</span>
              <span>{attentionLabel(item.count, item.label)}</span>
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function WorkInMotion({
  agents,
  issues,
  issuesError,
}: {
  agents?: Agent[];
  issues?: Issue[];
  issuesError?: boolean;
}) {
  const activeIssues = (issues ?? [])
    .filter((issue) => issue.status === "in_progress" || issue.status === "in_review")
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 6);
  const agentNameById = new Map((agents ?? []).map((agent) => [agent.id, agent.name]));

  return (
    <section className="ceo-command-center__panel ceo-command-center__work rounded-lg border border-border bg-card" aria-labelledby="work-in-motion-title">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 id="work-in-motion-title" className="text-sm font-semibold text-foreground">Work in motion</h2>
          <p className="mt-1 text-xs text-muted-foreground">Current work reported by the company.</p>
        </div>
        {sectionLink("/issues", "All work")}
      </div>
      {issuesError ? (
        <p className="p-4 text-sm text-destructive">Company work could not be loaded. Open All work to retry.</p>
      ) : issues === undefined ? (
        <p className="p-4 text-sm text-muted-foreground">Loading work from the company control plane.</p>
      ) : activeIssues.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No work is currently in progress or review.</p>
      ) : (
        <div className="divide-y divide-border">
          {activeIssues.map((issue) => (
            <Link key={issue.id} to={`/issues/${encodeURIComponent(issue.identifier ?? issue.id)}`} className="grid gap-2 p-3 no-underline hover:bg-accent/50 sm:grid-cols-3 sm:items-center">
              <div className="flex items-center gap-2">
                <StatusIcon status={issue.status} blockerAttention={issue.blockerAttention} />
                <span className="font-mono text-xs text-muted-foreground">{issue.identifier ?? issue.id.slice(0, 8)}</span>
              </div>
              <p className="min-w-0 truncate text-sm font-medium text-foreground">{issue.title}</p>
              <p className="text-xs text-muted-foreground">
                {issue.assigneeAgentId ? agentNameById.get(issue.assigneeAgentId) ?? "Assigned agent unavailable" : "Unassigned"}
                {" · "}{timeAgo(issue.updatedAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Evidence({ artifacts, artifactsError }: { artifacts?: CompanyArtifact[]; artifactsError?: boolean }) {
  return (
    <section className="ceo-command-center__panel ceo-command-center__evidence rounded-lg border border-border bg-card" aria-labelledby="evidence-title">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 id="evidence-title" className="text-sm font-semibold text-foreground">Evidence</h2>
          <p className="mt-1 text-xs text-muted-foreground">Recent company artifacts from the existing artifact feed.</p>
        </div>
        {sectionLink("/artifacts", "All artifacts")}
      </div>
      {artifactsError ? (
        <p className="p-4 text-sm text-destructive">Company artifacts could not be loaded. Open Artifacts to retry.</p>
      ) : artifacts === undefined ? (
        <p className="p-4 text-sm text-muted-foreground">Loading company artifacts.</p>
      ) : artifacts.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No company artifacts are available yet. Attach work products to issues to surface evidence here.</p>
      ) : (
        <div className="divide-y divide-border">
          {artifacts.slice(0, 5).map((artifact) => (
            <Link key={`${artifact.source}:${artifact.id}`} to={artifact.href} className="block p-3 no-underline hover:bg-accent/50">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ceo-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{artifact.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{artifact.issue.identifier} · {artifact.issue.title}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(artifact.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function AuditFeed({
  activity,
  activityError,
  agentMap,
  userProfileMap,
  entityNameMap,
  entityTitleMap,
}: Pick<CommandCenterProps, "activity" | "activityError" | "agentMap" | "userProfileMap" | "entityNameMap" | "entityTitleMap">) {
  return (
    <section className="ceo-command-center__panel ceo-command-center__audit rounded-lg border border-border bg-card" aria-labelledby="audit-title">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 id="audit-title" className="text-sm font-semibold text-foreground">Audit activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">Latest recorded company activity.</p>
        </div>
        {sectionLink("/activity", "Audit log")}
      </div>
      {activityError ? (
        <p className="p-4 text-sm text-destructive">Company activity could not be loaded. Open Audit log to retry.</p>
      ) : activity === undefined ? (
        <p className="p-4 text-sm text-muted-foreground">Loading recorded company activity.</p>
      ) : activity.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No recorded company activity is available yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {activity.slice(0, 8).map((event) => (
            <ActivityRow
              key={event.id}
              event={event}
              agentMap={agentMap}
              userProfileMap={userProfileMap}
              entityNameMap={entityNameMap}
              entityTitleMap={entityTitleMap}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function CommandCenter(props: CommandCenterProps) {
  const state = getOperationalState(props.summary);
  const updatedLabel = props.lastUpdatedAt ? `Updated ${timeAgo(props.lastUpdatedAt)}` : "Last update unavailable";

  return (
    <main className="ceo-command-center" data-testid="ceo-editorial-dashboard">
      <header className="ceo-command-center__header">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="ceo-command-center__monogram flex size-9 shrink-0 items-center justify-center font-mono text-sm font-semibold"
              aria-hidden="true"
            >
              CA
            </div>
            <div>
              <p className="ceo-command-center__eyebrow">CEO Agent command center</p>
              <h1 className="ceo-command-center__title mt-1">{props.companyName}</h1>
              <p className="ceo-command-center__header-copy mt-2">Decisions first. Business health second. Execution detail when you need it.</p>
            </div>
          </div>
          <div className="ceo-command-center__status text-left lg:text-right">
            <Link to={state.route} className="text-sm font-medium hover:underline">{state.label}</Link>
            <p className="mt-1 text-xs">{updatedLabel}</p>
          </div>
        </div>
      </header>

      <FounderAttention summary={props.summary} />

      <section className="ceo-command-center__health" aria-labelledby="business-health-title">
        <div className="ceo-command-center__section-heading">
          <div>
            <p className="ceo-command-center__section-label">Business health</p>
            <h2 id="business-health-title">Operating position</h2>
          </div>
          <p>Live control-plane signals, not forecasted or invented metrics.</p>
        </div>
        <MetricRail summary={props.summary} />
      </section>

      <section className="ceo-command-center__execution" aria-labelledby="execution-title">
        <div className="ceo-command-center__section-heading">
          <div>
            <p className="ceo-command-center__section-label">Execution</p>
            <h2 id="execution-title">Work and evidence</h2>
          </div>
          {sectionLink("/agent-studio", "Open Agent Studio")}
        </div>

        <div className="ceo-command-center__command-grid grid gap-4">
          <WorkInMotion agents={props.agents} issues={props.issues} issuesError={props.issuesError} />
          <Evidence artifacts={props.artifacts} artifactsError={props.artifactsError} />

          <section className="ceo-command-center__panel ceo-command-center__operations rounded-2xl border p-4" aria-labelledby="operations-title">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 id="operations-title" className="text-sm font-semibold text-foreground">Live operations</h2>
                <p className="mt-1 text-xs text-muted-foreground">Current agent runs and recent execution context.</p>
              </div>
              {sectionLink("/dashboard/live", "Open live view")}
            </div>
            {props.agentsError ? (
              <p className="text-sm text-destructive">Live agent operations could not be loaded. Open Agents to retry.</p>
            ) : props.agents === undefined ? (
              <p className="text-sm text-muted-foreground">Loading live agent operations.</p>
            ) : (
              <ActiveAgentsPanel
                companyId={props.companyId}
                title="Active agent runs"
                emptyMessage="No active or recent agent runs are connected to this company."
                cardClassName="ceo-command-center__run-card"
                variant="compact"
              />
            )}
          </section>

          <PluginSlotOutlet
            slotTypes={["dashboardWidget"]}
            context={{ companyId: props.companyId }}
            className="ceo-command-center__plugin-grid grid gap-4"
            itemClassName="ceo-command-center__plugin p-4"
          />

          <AuditFeed
            activity={props.activity}
            activityError={props.activityError}
            agentMap={props.agentMap}
            userProfileMap={props.userProfileMap}
            entityNameMap={props.entityNameMap}
            entityTitleMap={props.entityTitleMap}
          />
        </div>
      </section>
    </main>
  );
}
