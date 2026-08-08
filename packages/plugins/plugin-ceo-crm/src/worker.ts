import {
  definePlugin,
  PLUGIN_RPC_ERROR_CODES,
  runWorker,
  type PluginApiRequestInput,
  type PluginContext,
  type PluginPerformActionContext,
  type ToolResult,
} from "@paperclipai/plugin-sdk";
import manifest from "./manifest.js";
import {
  bootstrapDefaultPipeline,
  classifyCrmPublicError,
  createAccount,
  createContact,
  createDeal,
  createFollowupIssue,
  getOverview,
  getPipelineStages,
  proposeEvidence,
  recordInternalNote,
  requireCompanyScope,
  searchCrm,
  type MutationActor,
} from "./domain/crm.js";

function text(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} is required`);
  return value.trim();
}

function bodyObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toolDeclaration(name: string) {
  const declaration = manifest.tools?.find((tool) => tool.name === name);
  if (!declaration) throw new Error(`Missing manifest declaration for ${name}`);
  return declaration;
}

function actionActor(context: PluginPerformActionContext): MutationActor {
  if (context.actor.type !== "user" || !context.actor.userId) throw new Error("CRM founder actions require an authenticated board user");
  return { type: "user", id: context.actor.userId, userId: context.actor.userId, runId: context.actor.runId };
}

function actionCompany(params: Record<string, unknown>, context: PluginPerformActionContext) {
  if (!context.companyId) throw new Error("A host-authorized company scope is required");
  return requireCompanyScope(params.companyId, context.companyId);
}

function publicActionErrorCode(status: number): number {
  if (status === 400) return PLUGIN_RPC_ERROR_CODES.ACTION_BAD_REQUEST;
  if (status === 404) return PLUGIN_RPC_ERROR_CODES.ACTION_NOT_FOUND;
  if (status === 409) return PLUGIN_RPC_ERROR_CODES.ACTION_CONFLICT;
  return PLUGIN_RPC_ERROR_CODES.INVOCATION_SCOPE_DENIED;
}

export async function performCrmAction<T>(ctx: PluginContext, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const publicError = classifyCrmPublicError(error);
    if (!publicError) {
      ctx.logger.error("CRM action failed with an internal error", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw Object.assign(new Error("CRM action failed"), {
        code: PLUGIN_RPC_ERROR_CODES.WORKER_ERROR,
      });
    }
    throw Object.assign(new Error(publicError.message), {
      code: publicActionErrorCode(publicError.status),
    });
  }
}

function apiActor(input: PluginApiRequestInput): MutationActor {
  return input.actor.actorType === "agent"
    ? { type: "agent", id: input.actor.agentId ?? input.actor.actorId, agentId: input.actor.agentId ?? input.actor.actorId, runId: input.actor.runId ?? null }
    : { type: "user", id: input.actor.userId ?? input.actor.actorId, userId: input.actor.userId ?? input.actor.actorId, runId: input.actor.runId ?? null };
}

function apiCompany(input: PluginApiRequestInput, body?: Record<string, unknown>) {
  return requireCompanyScope(body?.companyId ?? input.query.companyId, input.companyId);
}

function table(ctx: PluginContext, name: "crm_accounts" | "crm_contacts" | "crm_deals" | "crm_activities" | "crm_evidence") {
  return `${ctx.db.namespace}.${name}`;
}

async function listSurface(ctx: PluginContext, companyId: string, surface: "accounts" | "contacts" | "deals" | "activities" | "evidence") {
  const lookup = {
    accounts: "crm_accounts",
    contacts: "crm_contacts",
    deals: "crm_deals",
    activities: "crm_activities",
    evidence: "crm_evidence",
  } as const;
  return ctx.db.query(`SELECT * FROM ${table(ctx, lookup[surface])} WHERE company_id = $1 ORDER BY created_at DESC LIMIT 100`, [companyId]);
}

async function getScopedRecord(ctx: PluginContext, companyId: string, kind: "contact" | "deal", id: unknown) {
  const tableName = kind === "contact" ? "crm_contacts" : "crm_deals";
  const rows = await ctx.db.query(`SELECT * FROM ${table(ctx, tableName)} WHERE id = $1 AND company_id = $2`, [text(id, `${kind}Id`), companyId]);
  return rows[0] ?? null;
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register("crm-overview", async (params) => getOverview(ctx, text(params.companyId, "companyId")));
    ctx.data.register("crm-pipelines", async (params) => getPipelineStages(ctx, text(params.companyId, "companyId")));
    ctx.data.register("crm-accounts", async (params) => listSurface(ctx, text(params.companyId, "companyId"), "accounts"));
    ctx.data.register("crm-contacts", async (params) => listSurface(ctx, text(params.companyId, "companyId"), "contacts"));
    ctx.data.register("crm-deals", async (params) => listSurface(ctx, text(params.companyId, "companyId"), "deals"));
    ctx.data.register("crm-activities", async (params) => listSurface(ctx, text(params.companyId, "companyId"), "activities"));
    ctx.data.register("crm-evidence", async (params) => listSurface(ctx, text(params.companyId, "companyId"), "evidence"));

    ctx.actions.register("crm-bootstrap", async (params, actionContext) => performCrmAction(ctx, () => bootstrapDefaultPipeline(ctx, { companyId: actionCompany(params, actionContext), actor: actionActor(actionContext) })));
    ctx.actions.register("crm-create-account", async (params, actionContext) => performCrmAction(ctx, () => createAccount(ctx, { companyId: actionCompany(params, actionContext), name: params.name, domain: params.domain, idempotencyKey: params.idempotencyKey, actor: actionActor(actionContext) })));
    ctx.actions.register("crm-create-contact", async (params, actionContext) => performCrmAction(ctx, () => createContact(ctx, { companyId: actionCompany(params, actionContext), accountId: params.accountId, firstName: params.firstName, lastName: params.lastName, email: params.email, title: params.title, idempotencyKey: params.idempotencyKey, actor: actionActor(actionContext) })));
    ctx.actions.register("crm-create-deal", async (params, actionContext) => performCrmAction(ctx, () => createDeal(ctx, { companyId: actionCompany(params, actionContext), accountId: params.accountId, pipelineId: params.pipelineId, stageId: params.stageId, name: params.name, amount: params.amount, currency: params.currency, idempotencyKey: params.idempotencyKey, actor: actionActor(actionContext) })));
    ctx.actions.register("crm-record-note", async (params, actionContext) => performCrmAction(ctx, () => recordInternalNote(ctx, { companyId: actionCompany(params, actionContext), entityKind: params.entityKind, entityId: params.entityId, body: params.body, idempotencyKey: params.idempotencyKey, actor: actionActor(actionContext) })));

    ctx.tools.register("crm_search", toolDeclaration("crm_search"), async (params, runContext): Promise<ToolResult> => {
      const input = bodyObject(params);
      const companyId = requireCompanyScope(input.companyId, runContext.companyId);
      const results = await searchCrm(ctx, companyId, input.query);
      return { content: results.length ? `Found ${results.length} CRM records.` : "No CRM records found.", data: { companyId, results } };
    });
    ctx.tools.register("crm_get_contact", toolDeclaration("crm_get_contact"), async (params, runContext): Promise<ToolResult> => {
      const input = bodyObject(params);
      const companyId = requireCompanyScope(input.companyId, runContext.companyId);
      const contact = await getScopedRecord(ctx, companyId, "contact", input.contactId);
      return contact ? { content: "CRM contact retrieved.", data: { companyId, contact } } : { error: "Contact not found" };
    });
    ctx.tools.register("crm_get_deal", toolDeclaration("crm_get_deal"), async (params, runContext): Promise<ToolResult> => {
      const input = bodyObject(params);
      const companyId = requireCompanyScope(input.companyId, runContext.companyId);
      const deal = await getScopedRecord(ctx, companyId, "deal", input.dealId);
      return deal ? { content: "CRM deal retrieved.", data: { companyId, deal } } : { error: "Deal not found" };
    });
    ctx.tools.register("crm_propose_fact", toolDeclaration("crm_propose_fact"), async (params, runContext): Promise<ToolResult> => {
      const input = bodyObject(params);
      const companyId = requireCompanyScope(input.companyId, runContext.companyId);
      const proposal = await proposeEvidence(ctx, { companyId, entityKind: input.entityKind, entityId: input.entityId, field: input.field, value: input.value, source: input.source, idempotencyKey: input.idempotencyKey, actor: { type: "agent", id: runContext.agentId, agentId: runContext.agentId, runId: runContext.runId } });
      return { content: "Created an internal evidence proposal; canonical CRM fields were not changed.", data: proposal };
    });
    ctx.tools.register("crm_create_followup_issue", toolDeclaration("crm_create_followup_issue"), async (params, runContext): Promise<ToolResult> => {
      const input = bodyObject(params);
      const companyId = requireCompanyScope(input.companyId, runContext.companyId);
      const result = await createFollowupIssue(ctx, { companyId, entityKind: input.entityKind, entityId: input.entityId, title: input.title, description: input.description, idempotencyKey: input.idempotencyKey, actor: { type: "agent", id: runContext.agentId, agentId: runContext.agentId, runId: runContext.runId } });
      return { content: result.created ? `Created follow-up issue ${result.issueId}.` : `Reused follow-up issue ${result.issueId}.`, data: result };
    });
  },

  async onApiRequest(input) {
    try {
      const body = bodyObject(input.body);
      const companyId = apiCompany(input, body);
      const actor = apiActor(input);
      if (input.routeKey === "overview") return { body: await getOverview(ctxForApi(), companyId) };
      if (input.routeKey === "pipelines") return { body: await getPipelineStages(ctxForApi(), companyId) };
      if (input.routeKey === "search") return { body: await searchCrm(ctxForApi(), companyId, input.query.query) };
      if (input.routeKey === "get-contact") {
        const contact = await getScopedRecord(ctxForApi(), companyId, "contact", input.params.contactId);
        return contact ? { body: contact } : { status: 404, body: { error: "contact not found" } };
      }
      if (input.routeKey === "get-deal") {
        const deal = await getScopedRecord(ctxForApi(), companyId, "deal", input.params.dealId);
        return deal ? { body: deal } : { status: 404, body: { error: "deal not found" } };
      }
      if (input.routeKey === "accounts" || input.routeKey === "contacts" || input.routeKey === "deals" || input.routeKey === "activities" || input.routeKey === "evidence") return { body: await listSurface(ctxForApi(), companyId, input.routeKey) };
      if (input.routeKey === "bootstrap") return { status: 201, body: await bootstrapDefaultPipeline(ctxForApi(), { companyId, actor }) };
      if (input.routeKey === "create-account") return { status: 201, body: await createAccount(ctxForApi(), { companyId, name: body.name, domain: body.domain, idempotencyKey: body.idempotencyKey, actor }) };
      if (input.routeKey === "create-contact") return { status: 201, body: await createContact(ctxForApi(), { companyId, accountId: body.accountId, firstName: body.firstName, lastName: body.lastName, email: body.email, title: body.title, idempotencyKey: body.idempotencyKey, actor }) };
      if (input.routeKey === "create-deal") return { status: 201, body: await createDeal(ctxForApi(), { companyId, accountId: body.accountId, pipelineId: body.pipelineId, stageId: body.stageId, name: body.name, amount: body.amount, currency: body.currency, idempotencyKey: body.idempotencyKey, actor }) };
      if (input.routeKey === "record-note") return { status: 201, body: await recordInternalNote(ctxForApi(), { companyId, entityKind: body.entityKind, entityId: body.entityId, body: body.body, idempotencyKey: body.idempotencyKey, actor }) };
      if (input.routeKey === "propose-evidence") return { status: 201, body: await proposeEvidence(ctxForApi(), { companyId, entityKind: body.entityKind, entityId: body.entityId, field: body.field, value: body.value, source: body.source, idempotencyKey: body.idempotencyKey, actor }) };
      if (input.routeKey === "create-followup") return { status: 201, body: await createFollowupIssue(ctxForApi(), { companyId, entityKind: body.entityKind, entityId: body.entityId, title: body.title, description: body.description, idempotencyKey: body.idempotencyKey, actor }) };
      return { status: 404, body: { error: `Unknown CRM route: ${input.routeKey}` } };
    } catch (error) {
      const publicError = classifyCrmPublicError(error);
      if (!publicError) throw error;
      return { status: publicError.status, body: { error: publicError.message } };
    }
  },
});

let workerContext: PluginContext | null = null;
function ctxForApi() {
  if (!workerContext) throw new Error("CRM worker is not initialized");
  return workerContext;
}
const originalSetup = plugin.definition.setup;
plugin.definition.setup = async (ctx) => {
  workerContext = ctx;
  await originalSetup(ctx);
};

export default plugin;
runWorker(plugin, import.meta.url);
