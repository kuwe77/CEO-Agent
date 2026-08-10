import { randomUUID } from "node:crypto";
import type { PluginContext } from "@paperclipai/plugin-sdk";

export type MutationActor = {
  type: "user" | "agent" | "system";
  id: string;
  agentId?: string | null;
  userId?: string | null;
  runId?: string | null;
};

type CrmContext = Pick<PluginContext, "db" | "activity" | "issues">;
type EntityKind = "account" | "contact" | "deal";
type WorkEntityKind = EntityKind | "activity" | "evidence";

const DEFAULT_STAGES = ["Lead", "Qualified", "Proposal", "Won", "Lost"] as const;

function table(ctx: Pick<PluginContext, "db">, name: string) {
  return `${ctx.db.namespace}.${name}`;
}

function requireText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} is required`);
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function requireIdempotencyKey(value: unknown) {
  const key = requireText(value, "idempotencyKey");
  if (key.length > 200) throw new Error("idempotencyKey must be 200 characters or fewer");
  return key;
}

function normalizeEmail(value: string | null) {
  return value ? value.toLowerCase() : null;
}

function normalizeDomain(value: string | null) {
  return value ? value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") : null;
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalJson(entryValue)]),
    );
  }
  return value;
}

function jsonValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

export function requireCompanyScope(requestedCompanyId: unknown, hostCompanyId: string) {
  const requested = optionalText(requestedCompanyId);
  if (requested && requested !== hostCompanyId) throw new Error("companyId must match the authenticated host company scope");
  return hostCompanyId;
}

export function classifyCrmPublicError(error: unknown) {
  if (!(error instanceof Error)) return null;
  const message = error.message;
  if (/company.*(?:mismatch|must match)/i.test(message)) return { status: 403, message };
  if (/host-authorized company scope is required|founder actions require an authenticated board user/i.test(message)) return { status: 403, message };
  if (/not found$/i.test(message)) return { status: 404, message };
  if (/in progress|idempotency key was already used|already exists/i.test(message)) return { status: 409, message };
  if (/required|invalid|does not belong|must be|unsupported entity kind/i.test(message)) return { status: 400, message };
  return null;
}

function entityTable(kind: EntityKind) {
  if (kind === "account") return "crm_accounts";
  if (kind === "contact") return "crm_contacts";
  return "crm_deals";
}

function requireEntityKind(value: unknown): EntityKind {
  if (value === "account" || value === "contact" || value === "deal") return value;
  throw new Error("entityKind must be account, contact, or deal");
}

function requireWorkEntityKind(value: unknown): WorkEntityKind {
  if (value === "account" || value === "contact" || value === "deal" || value === "activity" || value === "evidence") return value;
  throw new Error("entityKind must be account, contact, deal, activity, or evidence");
}

async function requireScopedWorkEntity(ctx: CrmContext, companyId: string, kind: WorkEntityKind, entityId: string) {
  const tableName = kind === "account" ? "crm_accounts"
    : kind === "contact" ? "crm_contacts"
      : kind === "deal" ? "crm_deals"
        : kind === "activity" ? "crm_activities"
          : "crm_evidence";
  const rows = await ctx.db.query<{ id: string }>(
    `SELECT id FROM ${table(ctx, tableName)} WHERE id = $1 AND company_id = $2`,
    [entityId, companyId],
  );
  if (!rows[0]) throw new Error(`${kind} not found`);
}

async function requireScopedEntity(ctx: CrmContext, companyId: string, kind: EntityKind, entityId: string) {
  const rows = await ctx.db.query<{ id: string }>(
    `SELECT id FROM ${table(ctx, entityTable(kind))} WHERE id = $1 AND company_id = $2`,
    [entityId, companyId],
  );
  if (!rows[0]) throw new Error(`${kind} not found`);
}

async function recordMutation(
  ctx: CrmContext,
  input: { companyId: string; entityType: string; entityId: string; eventType: string; actor: MutationActor; payload: Record<string, unknown>; idempotencyKey?: string },
) {
  const idempotencyKey = input.idempotencyKey ?? `${input.eventType}:${input.entityId}:${randomUUID()}`;
  const eventPayload = {
    ...input.payload,
    actor: {
      type: input.actor.type,
      id: input.actor.id,
      agentId: input.actor.agentId ?? null,
      userId: input.actor.userId ?? null,
      runId: input.actor.runId ?? null,
    },
  };
  const outbox = await ctx.db.execute(
    `INSERT INTO ${table(ctx, "crm_outbox")} (id, company_id, event_type, payload, idempotency_key)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (company_id, idempotency_key) DO NOTHING`,
    [randomUUID(), input.companyId, input.eventType, JSON.stringify(eventPayload), idempotencyKey],
  );
  if (outbox.rowCount === 0) return;
  await ctx.activity.log({
    companyId: input.companyId,
    message: `CRM ${input.eventType}`,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: eventPayload,
  });
}

export async function bootstrapDefaultPipeline(ctx: CrmContext, input: { companyId: string; actor: MutationActor }) {
  const candidateId = randomUUID();
  await ctx.db.execute(
    `INSERT INTO ${table(ctx, "crm_pipelines")} (id, company_id, name, is_default)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (company_id, name) DO NOTHING`,
    [candidateId, input.companyId, "Sales"],
  );
  const pipelines = await ctx.db.query<{ id: string }>(
    `SELECT id FROM ${table(ctx, "crm_pipelines")} WHERE company_id = $1 AND name = $2`,
    [input.companyId, "Sales"],
  );
  const pipelineId = pipelines[0]?.id;
  if (!pipelineId) throw new Error("Failed to resolve the default CRM pipeline");
  for (const [position, name] of DEFAULT_STAGES.entries()) {
    await ctx.db.execute(
      `INSERT INTO ${table(ctx, "crm_pipeline_stages")} (id, company_id, pipeline_id, name, position, is_closed)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (company_id, pipeline_id, name) DO NOTHING`,
      [randomUUID(), input.companyId, pipelineId, name, position, name === "Won" || name === "Lost"],
    );
  }
  await recordMutation(ctx, { companyId: input.companyId, entityType: "crm_pipeline", entityId: pipelineId, eventType: "pipeline.bootstrapped", actor: input.actor, payload: { stageCount: DEFAULT_STAGES.length }, idempotencyKey: "default-sales-pipeline" });
  return { pipelineId, stages: [...DEFAULT_STAGES] };
}

export async function getOverview(ctx: CrmContext, companyId: string) {
  const rows = await ctx.db.query<{ account_count: number; contact_count: number; deal_count: number; evidence_count: number }>(
    `SELECT
       (SELECT count(*)::int FROM ${table(ctx, "crm_accounts")} WHERE company_id = $1) AS account_count,
       (SELECT count(*)::int FROM ${table(ctx, "crm_contacts")} WHERE company_id = $1) AS contact_count,
       (SELECT count(*)::int FROM ${table(ctx, "crm_deals")} WHERE company_id = $1) AS deal_count,
       (SELECT count(*)::int FROM ${table(ctx, "crm_evidence")} WHERE company_id = $1 AND status = 'proposed') AS evidence_count`,
    [companyId],
  );
  const row = rows[0] ?? { account_count: 0, contact_count: 0, deal_count: 0, evidence_count: 0 };
  return { accounts: Number(row.account_count), contacts: Number(row.contact_count), deals: Number(row.deal_count), evidenceProposals: Number(row.evidence_count) };
}

export async function getPipelineStages(ctx: CrmContext, companyId: string) {
  return ctx.db.query<{
    pipeline_id: string;
    pipeline_name: string;
    stage_id: string;
    stage_name: string;
    position: number;
  }>(
    `SELECT p.id AS pipeline_id, p.name AS pipeline_name, s.id AS stage_id,
            s.name AS stage_name, s.position
       FROM ${table(ctx, "crm_pipelines")} p
       JOIN ${table(ctx, "crm_pipeline_stages")} s
         ON s.pipeline_id = p.id AND s.company_id = p.company_id
      WHERE p.company_id = $1
      ORDER BY p.is_default DESC, p.name, s.position`,
    [companyId],
  );
}

export async function searchCrm(ctx: CrmContext, companyId: string, query: unknown) {
  const term = `%${requireText(query, "query")}%`;
  return ctx.db.query<{ id: string; kind: "account" | "contact" | "deal"; label: string }>(
    `SELECT id, 'account'::text AS kind, name AS label FROM ${table(ctx, "crm_accounts")} WHERE company_id = $1 AND name ILIKE $2
     UNION ALL
     SELECT id, 'contact'::text AS kind, concat_ws(' ', first_name, last_name) AS label FROM ${table(ctx, "crm_contacts")} WHERE company_id = $1 AND (first_name ILIKE $2 OR last_name ILIKE $2 OR normalized_email ILIKE $2)
     UNION ALL
     SELECT id, 'deal'::text AS kind, name AS label FROM ${table(ctx, "crm_deals")} WHERE company_id = $1 AND name ILIKE $2
     LIMIT 30`,
    [companyId, term],
  );
}

export async function createAccount(ctx: CrmContext, input: { companyId: string; name: unknown; domain?: unknown; idempotencyKey: unknown; actor: MutationActor }) {
  const candidateId = randomUUID();
  const name = requireText(input.name, "name");
  const domain = normalizeDomain(optionalText(input.domain));
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  await ctx.db.execute(
    `INSERT INTO ${table(ctx, "crm_accounts")} (id, company_id, name, normalized_domain, idempotency_key, created_by_actor_type, created_by_actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING`,
    [candidateId, input.companyId, name, domain, idempotencyKey, input.actor.type, input.actor.id],
  );
  const rows = await ctx.db.query<{ id: string; name: string; normalized_domain: string | null }>(
    `SELECT id, name, normalized_domain FROM ${table(ctx, "crm_accounts")} WHERE company_id = $1 AND idempotency_key = $2`,
    [input.companyId, idempotencyKey],
  );
  const account = rows[0];
  if (!account) {
    if (domain) {
      const existing = await ctx.db.query<{ id: string }>(
        `SELECT id FROM ${table(ctx, "crm_accounts")} WHERE company_id = $1 AND normalized_domain = $2`,
        [input.companyId, domain],
      );
      if (existing[0]) throw new Error("account domain already exists");
    }
    throw new Error("Failed to resolve the idempotent CRM account");
  }
  if (account.name !== name || account.normalized_domain !== domain) throw new Error("idempotencyKey was already used for a different account payload");
  await recordMutation(ctx, { companyId: input.companyId, entityType: "crm_account", entityId: account.id, eventType: "account.created", actor: input.actor, payload: { name }, idempotencyKey: `account.created:${idempotencyKey}` });
  return { id: account.id, companyId: input.companyId, name, domain };
}

export async function createContact(ctx: CrmContext, input: { companyId: string; accountId?: unknown; firstName: unknown; lastName?: unknown; email?: unknown; title?: unknown; idempotencyKey: unknown; actor: MutationActor }) {
  const candidateId = randomUUID();
  const accountId = optionalText(input.accountId);
  if (accountId) await requireScopedEntity(ctx, input.companyId, "account", accountId);
  const firstName = requireText(input.firstName, "firstName");
  const lastName = optionalText(input.lastName);
  const email = optionalText(input.email);
  const normalizedEmail = normalizeEmail(email);
  const title = optionalText(input.title);
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  await ctx.db.execute(
    `INSERT INTO ${table(ctx, "crm_contacts")} (id, company_id, account_id, first_name, last_name, email, normalized_email, title, idempotency_key, created_by_actor_type, created_by_actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT DO NOTHING`,
    [candidateId, input.companyId, accountId, firstName, lastName, email, normalizedEmail, title, idempotencyKey, input.actor.type, input.actor.id],
  );
  const rows = await ctx.db.query<{ id: string; account_id: string | null; first_name: string; last_name: string | null; email: string | null; title: string | null }>(
    `SELECT id, account_id, first_name, last_name, email, title FROM ${table(ctx, "crm_contacts")} WHERE company_id = $1 AND idempotency_key = $2`,
    [input.companyId, idempotencyKey],
  );
  const contact = rows[0];
  if (!contact) {
    if (normalizedEmail) {
      const existing = await ctx.db.query<{ id: string }>(
        `SELECT id FROM ${table(ctx, "crm_contacts")} WHERE company_id = $1 AND normalized_email = $2`,
        [input.companyId, normalizedEmail],
      );
      if (existing[0]) throw new Error("contact email already exists");
    }
    throw new Error("Failed to resolve the idempotent CRM contact");
  }
  if (contact.account_id !== accountId || contact.first_name !== firstName || contact.last_name !== lastName || contact.email !== email || contact.title !== title) throw new Error("idempotencyKey was already used for a different contact payload");
  await recordMutation(ctx, { companyId: input.companyId, entityType: "crm_contact", entityId: contact.id, eventType: "contact.created", actor: input.actor, payload: { accountId, email }, idempotencyKey: `contact.created:${idempotencyKey}` });
  return { id: contact.id, companyId: input.companyId, accountId, firstName, lastName, email };
}

export async function createDeal(ctx: CrmContext, input: { companyId: string; accountId?: unknown; pipelineId: unknown; stageId: unknown; name: unknown; amount?: unknown; currency?: unknown; idempotencyKey: unknown; actor: MutationActor }) {
  const candidateId = randomUUID();
  const accountId = optionalText(input.accountId);
  if (accountId) await requireScopedEntity(ctx, input.companyId, "account", accountId);
  const pipelineId = requireText(input.pipelineId, "pipelineId");
  const stageId = requireText(input.stageId, "stageId");
  const matchingStage = await ctx.db.query<{ id: string }>(
    `SELECT id FROM ${table(ctx, "crm_pipeline_stages")}
      WHERE id = $1 AND pipeline_id = $2 AND company_id = $3`,
    [stageId, pipelineId, input.companyId],
  );
  if (!matchingStage[0]) throw new Error("stage must belong to the selected company pipeline");
  const amount = input.amount == null || input.amount === "" ? null : Number(input.amount);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new Error("amount must be a non-negative number");
  const currency = (optionalText(input.currency) ?? "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a three-letter ISO code");
  const name = requireText(input.name, "name");
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  await ctx.db.execute(
    `INSERT INTO ${table(ctx, "crm_deals")} (id, company_id, account_id, pipeline_id, stage_id, name, amount, currency, idempotency_key, created_by_actor_type, created_by_actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (company_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
    [candidateId, input.companyId, accountId, pipelineId, stageId, name, amount, currency, idempotencyKey, input.actor.type, input.actor.id],
  );
  const rows = await ctx.db.query<{ id: string; account_id: string | null; pipeline_id: string; stage_id: string; name: string; amount: string | number | null; currency: string }>(
    `SELECT id, account_id, pipeline_id, stage_id, name, amount, currency FROM ${table(ctx, "crm_deals")} WHERE company_id = $1 AND idempotency_key = $2`,
    [input.companyId, idempotencyKey],
  );
  const deal = rows[0];
  if (!deal) throw new Error("Failed to resolve the idempotent CRM deal");
  const storedAmount = deal.amount === null ? null : Number(deal.amount);
  if (deal.account_id !== accountId || deal.pipeline_id !== pipelineId || deal.stage_id !== stageId || deal.name !== name || storedAmount !== amount || deal.currency !== currency) throw new Error("idempotencyKey was already used for a different deal payload");
  await recordMutation(ctx, { companyId: input.companyId, entityType: "crm_deal", entityId: deal.id, eventType: "deal.created", actor: input.actor, payload: { accountId, pipelineId, stageId, amount, currency }, idempotencyKey: `deal.created:${idempotencyKey}` });
  return { id: deal.id, companyId: input.companyId, accountId, pipelineId, stageId, amount, currency };
}

export async function recordInternalNote(ctx: CrmContext, input: { companyId: string; entityKind: unknown; entityId: unknown; body: unknown; idempotencyKey: unknown; actor: MutationActor }) {
  const entityKind = requireEntityKind(input.entityKind);
  const entityId = requireText(input.entityId, "entityId");
  await requireScopedEntity(ctx, input.companyId, entityKind, entityId);
  const candidateId = randomUUID();
  const body = requireText(input.body, "body");
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  await ctx.db.execute(
    `INSERT INTO ${table(ctx, "crm_activities")} (id, company_id, account_id, contact_id, deal_id, kind, body, idempotency_key, created_by_actor_type, created_by_actor_id, run_id)
     VALUES ($1, $2, $3, $4, $5, 'internal_note', $6, $7, $8, $9, $10)
     ON CONFLICT (company_id, idempotency_key) DO NOTHING`,
    [candidateId, input.companyId, entityKind === "account" ? entityId : null, entityKind === "contact" ? entityId : null, entityKind === "deal" ? entityId : null, body, idempotencyKey, input.actor.type, input.actor.id, input.actor.runId ?? null],
  );
  const rows = await ctx.db.query<{ id: string; account_id: string | null; contact_id: string | null; deal_id: string | null; body: string }>(
    `SELECT id, account_id, contact_id, deal_id, body FROM ${table(ctx, "crm_activities")} WHERE company_id = $1 AND idempotency_key = $2`,
    [input.companyId, idempotencyKey],
  );
  const note = rows[0];
  if (!note) throw new Error("Failed to resolve the idempotent CRM note");
  const storedEntityId = entityKind === "account" ? note.account_id : entityKind === "contact" ? note.contact_id : note.deal_id;
  if (storedEntityId !== entityId || note.body !== body) throw new Error("idempotencyKey was already used for a different internal note payload");
  await recordMutation(ctx, { companyId: input.companyId, entityType: "crm_activity", entityId: note.id, eventType: "activity.noted", actor: input.actor, payload: { entityKind, entityId }, idempotencyKey: `activity.noted:${idempotencyKey}` });
  return { id: note.id, companyId: input.companyId, entityKind, entityId };
}

export async function proposeEvidence(ctx: CrmContext, input: { companyId: string; entityKind: unknown; entityId: unknown; field: unknown; value: unknown; source: unknown; idempotencyKey: unknown; actor: MutationActor }) {
  const entityKind = requireEntityKind(input.entityKind);
  const entityId = requireText(input.entityId, "entityId");
  await requireScopedEntity(ctx, input.companyId, entityKind, entityId);
  const candidateId = randomUUID();
  const field = requireText(input.field, "field");
  const source = requireText(input.source, "source");
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  await ctx.db.execute(
    `INSERT INTO ${table(ctx, "crm_evidence")} (id, company_id, entity_kind, entity_id, field_name, proposed_value, source, idempotency_key, actor_agent_id, actor_user_id, actor_run_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
     ON CONFLICT (company_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
    [candidateId, input.companyId, entityKind, entityId, field, JSON.stringify(input.value), source, idempotencyKey, input.actor.agentId ?? null, input.actor.userId ?? null, input.actor.runId ?? null],
  );
  const rows = await ctx.db.query<{ id: string; entity_kind: EntityKind; entity_id: string; field_name: string; proposed_value: unknown; source: string }>(
    `SELECT id, entity_kind, entity_id, field_name, proposed_value, source FROM ${table(ctx, "crm_evidence")} WHERE company_id = $1 AND idempotency_key = $2`,
    [input.companyId, idempotencyKey],
  );
  const evidence = rows[0];
  if (!evidence) throw new Error("Failed to resolve the idempotent CRM evidence proposal");
  if (evidence.entity_kind !== entityKind || evidence.entity_id !== entityId || evidence.field_name !== field || evidence.source !== source || !jsonValuesEqual(evidence.proposed_value, input.value)) throw new Error("idempotencyKey was already used for a different evidence payload");
  await recordMutation(ctx, { companyId: input.companyId, entityType: "crm_evidence", entityId: evidence.id, eventType: "evidence.proposed", actor: input.actor, payload: { entityKind, entityId, field }, idempotencyKey: `evidence.proposed:${idempotencyKey}` });
  return { id: evidence.id, companyId: input.companyId, status: "proposed" as const, entityKind, entityId };
}

export async function createFollowupIssue(ctx: CrmContext, input: { companyId: string; entityKind: unknown; entityId: unknown; title: unknown; description?: unknown; idempotencyKey: unknown; actor: MutationActor }) {
  const entityKind = requireWorkEntityKind(input.entityKind);
  const entityId = requireText(input.entityId, "entityId");
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
  const title = requireText(input.title, "title");
  const description = optionalText(input.description) ?? undefined;
  await requireScopedWorkEntity(ctx, input.companyId, entityKind, entityId);

  const claimId = randomUUID();
  await ctx.db.execute(
    `INSERT INTO ${table(ctx, "crm_work_links")} (id, company_id, crm_entity_kind, crm_entity_id, issue_id, relationship, idempotency_key, actor_agent_id, actor_user_id, actor_run_id)
     VALUES ($1, $2, $3, $4, NULL, 'follow_up', $5, $6, $7, $8)
     ON CONFLICT (company_id, idempotency_key) DO NOTHING`,
    [claimId, input.companyId, entityKind, entityId, idempotencyKey, input.actor.agentId ?? null, input.actor.userId ?? null, input.actor.runId ?? null],
  );
  await ctx.db.execute(
    `UPDATE ${table(ctx, "crm_work_links")}
        SET id = $1, actor_agent_id = $2, actor_user_id = $3, actor_run_id = $4, created_at = now()
      WHERE company_id = $5 AND idempotency_key = $6 AND issue_id IS NULL
        AND created_at < now() - interval '5 minutes'`,
    [claimId, input.actor.agentId ?? null, input.actor.userId ?? null, input.actor.runId ?? null, input.companyId, idempotencyKey],
  );
  const links = await ctx.db.query<{ id: string; crm_entity_kind: WorkEntityKind; crm_entity_id: string; issue_id: string | null }>(
    `SELECT id, crm_entity_kind, crm_entity_id, issue_id FROM ${table(ctx, "crm_work_links")} WHERE company_id = $1 AND idempotency_key = $2`,
    [input.companyId, idempotencyKey],
  );
  const link = links[0];
  if (!link) throw new Error("Failed to reserve the follow-up idempotency key");
  if (link.crm_entity_kind !== entityKind || link.crm_entity_id !== entityId) throw new Error("idempotencyKey was already used for a different CRM entity");
  if (link.issue_id) return { issueId: link.issue_id, created: false };

  const originKind = `plugin:${PLUGIN_IDENTITY}:follow_up`;
  const priorIssues = await ctx.db.query<{ id: string }>(
    `SELECT id FROM public.issues WHERE company_id = $1 AND origin_kind = $2 AND origin_id = $3 ORDER BY created_at ASC LIMIT 1`,
    [input.companyId, originKind, idempotencyKey],
  );
  let issueId = priorIssues[0]?.id;
  let created = false;
  if (!issueId) {
    if (link.id !== claimId) throw new Error("follow-up creation is already in progress; retry shortly");
    let issue: { id: string; createdByRequest?: boolean };
    try {
      issue = await ctx.issues.create({
        companyId: input.companyId,
        title,
        description,
        priority: "medium",
        originKind,
        originId: idempotencyKey,
        createOrGetByOrigin: true,
        actor: { actorAgentId: input.actor.agentId ?? null, actorUserId: input.actor.userId ?? null, actorRunId: input.actor.runId ?? null },
      });
    } catch (error) {
      await ctx.db.execute(
        `DELETE FROM ${table(ctx, "crm_work_links")} WHERE id = $1 AND company_id = $2 AND issue_id IS NULL`,
        [claimId, input.companyId],
      );
      throw error;
    }
    issueId = issue.id;
    created = issue.createdByRequest === true;
  }
  const scopedIssue = await ctx.db.query<{ id: string }>(
    `SELECT id FROM public.issues WHERE id = $1 AND company_id = $2`,
    [issueId, input.companyId],
  );
  if (!scopedIssue[0]) throw new Error("Paperclip follow-up issue was not created in the authenticated company");
  const linked = await ctx.db.execute(
    `UPDATE ${table(ctx, "crm_work_links")} SET issue_id = $1 WHERE id = $2 AND company_id = $3 AND issue_id IS NULL`,
    [issueId, link.id, input.companyId],
  );
  if (linked.rowCount !== 1) {
    const canonical = await ctx.db.query<{ issue_id: string | null }>(
      `SELECT issue_id FROM ${table(ctx, "crm_work_links")} WHERE company_id = $1 AND idempotency_key = $2`,
      [input.companyId, idempotencyKey],
    );
    if (!canonical[0]?.issue_id) throw new Error("Failed to finalize the CRM follow-up link");
    issueId = canonical[0].issue_id;
    created = false;
  }
  await recordMutation(ctx, { companyId: input.companyId, entityType: "crm_work_link", entityId, eventType: "follow_up.created", actor: input.actor, payload: { issueId, entityKind }, idempotencyKey: `follow-up:${idempotencyKey}` });
  return { issueId, created };
}

const PLUGIN_IDENTITY = "paperclipai.plugin-ceo-crm";
