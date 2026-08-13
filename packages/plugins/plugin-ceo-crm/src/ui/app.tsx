import {
  useHostContext,
  useHostNavigation,
  usePluginAction,
  usePluginData,
  type PluginPageProps,
  type PluginSidebarProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import { useState } from "react";

type Overview = { accounts: number; contacts: number; deals: number; evidenceProposals: number };
type CrmRow = { id: string; name?: string; first_name?: string; last_name?: string; body?: string; field_name?: string; proposed_value?: unknown; source?: string; status?: string };
type PipelineStage = { pipeline_id: string; pipeline_name: string; stage_id: string; stage_name: string; position: number };
type Section = "Overview" | "Accounts" | "Contacts" | "Deals" | "Activity" | "Evidence";

export function formatCrmOverviewSummary(overview: Overview): string {
  return `${overview.accounts} accounts · ${overview.contacts} contacts · ${overview.deals} deals · ${overview.evidenceProposals} evidence proposals`;
}

export async function runFounderFormMutation<T>(
  action: () => Promise<T>,
  form: { reset(): void },
  rotateIdempotencyKey: () => void,
): Promise<T> {
  const result = await action();
  rotateIdempotencyKey();
  form.reset();
  return result;
}

const shell: React.CSSProperties = { minHeight: "100%", background: "var(--ceo-command-stage)", color: "var(--ceo-command-ink)", padding: "calc(var(--spacing) * 6)", fontFamily: "var(--font-sans)" };
const panel: React.CSSProperties = { background: "var(--ceo-command-surface)", borderColor: "var(--ceo-command-line)", borderStyle: "solid", borderWidth: "thin", borderRadius: "var(--ceo-command-radius)", padding: "calc(var(--spacing) * 5)", boxShadow: "var(--shadow-lg)" };
const accent: React.CSSProperties = { minHeight: 42, background: "var(--ceo-command-accent)", color: "var(--ceo-command-panel-text)", border: 0, borderRadius: "var(--radius-lg)", padding: "calc(var(--spacing) * 2.25) calc(var(--spacing) * 3)", cursor: "pointer", fontWeight: "var(--font-weight-semibold)" };
export const crmControlStyle: React.CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: 42,
  border: "1px solid color-mix(in oklab, var(--ceo-command-ink) 24%, transparent)",
  borderRadius: "var(--radius-lg)",
  background: "color-mix(in oklab, var(--ceo-command-surface) 90%, white)",
  color: "var(--ceo-command-ink)",
  padding: "calc(var(--spacing) * 2.25) calc(var(--spacing) * 2.75)",
  font: "inherit",
};
export const crmFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))",
  alignItems: "end",
  gap: "calc(var(--spacing) * 2.5)",
  marginTop: "calc(var(--spacing) * 3.5)",
  padding: "calc(var(--spacing) * 3)",
  border: "1px solid color-mix(in oklab, var(--ceo-command-ink) 14%, transparent)",
  borderRadius: "var(--radius-xl)",
  background: "color-mix(in oklab, var(--ceo-command-surface) 95%, var(--ceo-command-ink))",
};

function StatusView<T>({ loading, error, data, emptyMessage, content }: { loading: boolean; error: { message: string } | null; data: T | null | undefined; emptyMessage: string; content: React.ReactNode }) {
  if (loading) return <p>Loading CRM data…</p>;
  if (error) return <p role="alert">Could not load CRM: {error.message}</p>;
  if (data == null || (Array.isArray(data) && data.length === 0)) return <p>{emptyMessage}</p>;
  return <div>{content}</div>;
}

function FounderForms({
  companyId,
  accounts,
  pipelines,
  onSaved,
}: {
  companyId: string;
  accounts: CrmRow[];
  pipelines: PipelineStage[];
  onSaved: () => void;
}) {
  const createAccount = usePluginAction("crm-create-account");
  const createContact = usePluginAction("crm-create-contact");
  const createDeal = usePluginAction("crm-create-deal");
  const bootstrap = usePluginAction("crm-bootstrap");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accountIdempotencyKey, setAccountIdempotencyKey] = useState(() => crypto.randomUUID());
  const [contactIdempotencyKey, setContactIdempotencyKey] = useState(() => crypto.randomUUID());
  const [dealIdempotencyKey, setDealIdempotencyKey] = useState(() => crypto.randomUUID());

  async function submit(action: () => Promise<unknown>) {
    setSaving(true);
    try {
      await action();
      setMessage("Saved to the company CRM.");
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CRM action failed");
    } finally {
      setSaving(false);
    }
  }

  const renderAccountOptions = (placeholderKey: string) => [
    <option key={placeholderKey} value="">No linked account</option>,
    ...accounts.map((account) => (
      <option key={account.id} value={account.id}>{account.name ?? account.id}</option>
    )),
  ];
  const renderPipelineOptions = () => [
    <option key="no-stage" value="">Select pipeline stage</option>,
    ...pipelines.map((stage) => (
      <option key={stage.stage_id} value={`${stage.pipeline_id}:${stage.stage_id}`}>
        {stage.pipeline_name} · {stage.stage_name}
      </option>
    )),
  ];

  return <section style={{ ...panel, marginTop: "calc(var(--spacing) * 4.5)" }} aria-label="Founder CRM create forms">
    <h2 key="founder-actions-heading" style={{ marginTop: 0 }}>Founder actions</h2>
    <button key="bootstrap" disabled={saving} style={accent} onClick={() => void submit(() => bootstrap({ companyId }))}>Create default pipeline</button>
    <form key="account-form" onSubmit={(event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); void submit(() => runFounderFormMutation(() => createAccount({ companyId, name: form.get("name"), domain: form.get("domain"), idempotencyKey: accountIdempotencyKey }), formElement, () => setAccountIdempotencyKey(crypto.randomUUID()))); }} style={crmFormStyle}>
      <strong key="account-label" style={{ gridColumn: "1 / -1" }}>Create account</strong><input key="account-name" required name="name" aria-label="Account name" placeholder="Account name" style={crmControlStyle} /><input key="account-domain" name="domain" aria-label="Account domain" placeholder="Domain (optional)" style={crmControlStyle} /><button key="account-submit" disabled={saving} style={accent}>Add account</button>
    </form>
    <form key="contact-form" onSubmit={(event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); void submit(() => runFounderFormMutation(() => createContact({ companyId, accountId: form.get("accountId"), firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"), title: form.get("title"), idempotencyKey: contactIdempotencyKey }), formElement, () => setContactIdempotencyKey(crypto.randomUUID()))); }} style={crmFormStyle}>
      <strong key="contact-label" style={{ gridColumn: "1 / -1" }}>Create contact</strong><input key="contact-first" required name="firstName" aria-label="Contact first name" placeholder="First name" style={crmControlStyle} /><input key="contact-last" name="lastName" aria-label="Contact last name" placeholder="Last name" style={crmControlStyle} /><input key="contact-email" name="email" type="email" aria-label="Contact email" placeholder="Email" style={crmControlStyle} /><select key="contact-account" name="accountId" aria-label="Contact account" style={crmControlStyle}>{renderAccountOptions("no-contact-account")}</select><input key="contact-title" name="title" aria-label="Contact title" placeholder="Title (optional)" style={crmControlStyle} /><button key="contact-submit" disabled={saving} style={accent}>Add contact</button>
    </form>
    <form key="deal-form" onSubmit={(event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const [pipelineId, stageId] = String(form.get("pipelineStage") ?? "").split(":"); void submit(() => runFounderFormMutation(() => createDeal({ companyId, name: form.get("name"), accountId: form.get("accountId"), pipelineId, stageId, amount: form.get("amount"), currency: form.get("currency"), idempotencyKey: dealIdempotencyKey }), formElement, () => setDealIdempotencyKey(crypto.randomUUID()))); }} style={crmFormStyle}>
      <strong key="deal-label" style={{ gridColumn: "1 / -1" }}>Create deal</strong><input key="deal-name" required name="name" aria-label="Deal name" placeholder="Deal name" style={crmControlStyle} /><select key="deal-account" name="accountId" aria-label="Deal account" style={crmControlStyle}>{renderAccountOptions("no-deal-account")}</select><select key="deal-stage" required name="pipelineStage" aria-label="Deal pipeline stage" style={crmControlStyle}>{renderPipelineOptions()}</select><input key="deal-amount" name="amount" type="number" min="0" step="0.01" aria-label="Deal amount" placeholder="Amount" style={crmControlStyle} /><input key="deal-currency" name="currency" defaultValue="USD" maxLength={3} aria-label="Deal currency" style={crmControlStyle} /><button key="deal-submit" disabled={saving || pipelines.length === 0} style={accent}>Add deal</button>
      {pipelines.length === 0 ? <small key="deal-help" style={{ gridColumn: "1 / -1" }}>Create the default pipeline before adding a deal.</small> : null}
    </form>
    {message ? <p key="action-message" role="status">{message}</p> : null}
  </section>;
}

function RowList({ rows }: { rows: CrmRow[] }) {
  return <ul aria-label="CRM records">{rows.map((row) => {
    const primary = row.name ?? ([row.first_name, row.last_name].filter(Boolean).join(" ") || row.body || row.field_name || "CRM record");
    const proposedValue = row.proposed_value == null
      ? null
      : typeof row.proposed_value === "string" ? row.proposed_value : JSON.stringify(row.proposed_value);
    return <li key={row.id}><strong key={`${row.id}-primary`}>{primary}</strong>{proposedValue ? ` — proposed ${proposedValue}` : ""}{row.status ? ` — ${row.status}` : ""}{row.source ? ` (${row.source})` : ""}</li>;
  })}</ul>;
}

function ScopedCrmPage({ companyId }: { companyId: string }) {
  const [section, setSection] = useState<Section>("Overview");
  const overview = usePluginData<Overview>("crm-overview", { companyId });
  const pipelines = usePluginData<PipelineStage[]>("crm-pipelines", { companyId });
  const accounts = usePluginData<CrmRow[]>("crm-accounts", { companyId });
  const contacts = usePluginData<CrmRow[]>("crm-contacts", { companyId });
  const deals = usePluginData<CrmRow[]>("crm-deals", { companyId });
  const activities = usePluginData<CrmRow[]>("crm-activities", { companyId });
  const evidence = usePluginData<CrmRow[]>("crm-evidence", { companyId });
  const surfaces: Record<Exclude<Section, "Overview">, typeof accounts> = { Accounts: accounts, Contacts: contacts, Deals: deals, Activity: activities, Evidence: evidence };
  const selected = section === "Overview" ? null : surfaces[section];
  function refreshCrm() {
    overview.refresh();
    pipelines.refresh();
    accounts.refresh();
    contacts.refresh();
    deals.refresh();
    activities.refresh();
    evidence.refresh();
  }
  return <main style={shell}>
    <div style={{ ...panel, maxWidth: "var(--tc-shell-max-w)", margin: "0 auto" }}>
      <p key="crm-kicker" style={{ color: "var(--ceo-command-accent)", fontWeight: "var(--font-weight-bold)", margin: 0 }}>CEO CRM · company-scoped business data</p><h1 key="crm-heading">Customer relationships, without a second control plane</h1>
      <nav key="crm-nav" aria-label="CRM sections" style={{ display: "flex", flexWrap: "wrap", gap: "calc(var(--spacing) * 2)" }}>{(["Overview", "Accounts", "Contacts", "Deals", "Activity", "Evidence"] as Section[]).map((item) => <button key={item} style={item === section ? accent : { ...accent, background: "var(--ceo-command-panel)" }} onClick={() => setSection(item)}>{item}</button>)}</nav>
      <section key="crm-surface" style={{ marginTop: "calc(var(--spacing) * 5)" }}>
        {section === "Overview"
          ? <StatusView key="overview-status" {...overview} emptyMessage="No CRM records yet. Create an account, contact, or deal to begin." content={overview.data ? <div key="overview-data" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(calc(var(--spacing) * 35),1fr))", gap: "calc(var(--spacing) * 2.5)" }}>{Object.entries(overview.data).map(([label, value]) => <div style={{ background: "color-mix(in oklab, var(--ceo-command-surface) 85%, var(--ceo-command-accent))", borderRadius: "var(--radius-xl)", padding: "calc(var(--spacing) * 3)" }} key={label}><strong key={`${label}-value`}>{value}</strong><br key={`${label}-break`} /><span key={`${label}-label`}>{label}</span></div>)}</div> : null} />
          : selected
            ? <StatusView key={`status-${section}`} {...selected} emptyMessage={`No ${section.toLowerCase()} records yet.`} content={<RowList key="surface-rows" rows={selected.data ?? []} />} />
            : null}
      </section>
      {pipelines.error ? <p key="pipeline-error" role="alert">Could not load CRM pipelines: {pipelines.error.message}</p> : null}
      <FounderForms
        key="founder-forms"
        companyId={companyId}
        accounts={accounts.data ?? []}
        pipelines={pipelines.data ?? []}
        onSaved={refreshCrm}
      />
    </div>
  </main>;
}

export function CrmPage({ context }: PluginPageProps) {
  const host = useHostContext();
  const companyId = context.companyId ?? host.companyId;
  if (!companyId) return <main style={shell}><div style={panel}>Select a company to view its CRM.</div></main>;
  return <ScopedCrmPage companyId={companyId} />;
}

export function CrmSidebarLink(_props: PluginSidebarProps) {
  const navigation = useHostNavigation();
  return <a {...navigation.linkProps("/crm")} style={{ color: "inherit", textDecoration: "none", fontWeight: "var(--font-weight-bold)" }}>CRM</a>;
}

function ScopedCrmDashboardWidget({ companyId }: { companyId: string }) {
  const overview = usePluginData<Overview>("crm-overview", { companyId });
  return <section style={panel} aria-label="CRM overview dashboard widget"><h2 key="widget-heading" style={{ marginTop: 0 }}>CRM overview</h2><StatusView key="widget-status" {...overview} emptyMessage="No CRM records yet." content={overview.data ? <p>{formatCrmOverviewSummary(overview.data)}</p> : null} /></section>;
}

export function CrmDashboardWidget({ context }: PluginWidgetProps) {
  if (!context.companyId) return <section style={panel}>Select a company to view CRM overview.</section>;
  return <ScopedCrmDashboardWidget companyId={context.companyId} />;
}
