import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

export const PLUGIN_ID = "paperclipai.plugin-ceo-crm";

const companyIdQuery = { from: "query", key: "companyId" } as const;
const companyIdBody = { from: "body", key: "companyId" } as const;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: "0.1.0",
  displayName: "CEO CRM",
  description: "Company-scoped CRM accounts, contacts, deals, evidence proposals, and Paperclip follow-up links.",
  author: "Paperclip",
  categories: ["automation", "ui"],
  capabilities: [
    "api.routes.register",
    "database.namespace.migrate",
    "database.namespace.read",
    "database.namespace.write",
    "issues.create",
    "agent.tools.register",
    "activity.log.write",
    "ui.sidebar.register",
    "ui.page.register",
    "ui.dashboardWidget.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  database: {
    namespaceSlug: "ceo_crm",
    migrationsDir: "migrations",
    coreReadTables: ["companies", "issues"],
  },
  apiRoutes: [
    { routeKey: "overview", method: "GET", path: "/overview", auth: "board", capability: "api.routes.register", companyResolution: companyIdQuery },
    { routeKey: "pipelines", method: "GET", path: "/pipelines", auth: "board", capability: "api.routes.register", companyResolution: companyIdQuery },
    { routeKey: "search", method: "GET", path: "/search", auth: "board", capability: "api.routes.register", companyResolution: companyIdQuery },
    { routeKey: "accounts", method: "GET", path: "/accounts", auth: "board", capability: "api.routes.register", companyResolution: companyIdQuery },
    { routeKey: "contacts", method: "GET", path: "/contacts", auth: "board", capability: "api.routes.register", companyResolution: companyIdQuery },
    { routeKey: "deals", method: "GET", path: "/deals", auth: "board", capability: "api.routes.register", companyResolution: companyIdQuery },
    { routeKey: "get-contact", method: "GET", path: "/contacts/:contactId", auth: "board", capability: "api.routes.register", companyResolution: companyIdQuery },
    { routeKey: "get-deal", method: "GET", path: "/deals/:dealId", auth: "board", capability: "api.routes.register", companyResolution: companyIdQuery },
    { routeKey: "activities", method: "GET", path: "/activities", auth: "board", capability: "api.routes.register", companyResolution: companyIdQuery },
    { routeKey: "evidence", method: "GET", path: "/evidence", auth: "board", capability: "api.routes.register", companyResolution: companyIdQuery },
    { routeKey: "bootstrap", method: "POST", path: "/bootstrap", auth: "board", capability: "api.routes.register", companyResolution: companyIdBody },
    { routeKey: "create-account", method: "POST", path: "/accounts", auth: "board", capability: "api.routes.register", companyResolution: companyIdBody },
    { routeKey: "create-contact", method: "POST", path: "/contacts", auth: "board", capability: "api.routes.register", companyResolution: companyIdBody },
    { routeKey: "create-deal", method: "POST", path: "/deals", auth: "board", capability: "api.routes.register", companyResolution: companyIdBody },
    { routeKey: "record-note", method: "POST", path: "/activities", auth: "board", capability: "api.routes.register", companyResolution: companyIdBody },
    { routeKey: "propose-evidence", method: "POST", path: "/evidence/proposals", auth: "board", capability: "api.routes.register", companyResolution: companyIdBody },
    { routeKey: "create-followup", method: "POST", path: "/work/follow-ups", auth: "board", capability: "api.routes.register", companyResolution: companyIdBody },
  ],
  tools: [
    {
      name: "crm_search",
      displayName: "Search CRM",
      description: "Search accounts, contacts, and deals in the current company. Returns stable CRM IDs.",
      parametersSchema: { type: "object", properties: { query: { type: "string", minLength: 1 }, companyId: { type: "string" } }, required: ["query"] },
    },
    {
      name: "crm_get_contact",
      displayName: "Get CRM Contact",
      description: "Read one contact from the current company using its stable CRM ID.",
      parametersSchema: { type: "object", properties: { contactId: { type: "string" }, companyId: { type: "string" } }, required: ["contactId"] },
    },
    {
      name: "crm_get_deal",
      displayName: "Get CRM Deal",
      description: "Read one deal from the current company using its stable CRM ID.",
      parametersSchema: { type: "object", properties: { dealId: { type: "string" }, companyId: { type: "string" } }, required: ["dealId"] },
    },
    {
      name: "crm_propose_fact",
      displayName: "Propose CRM Fact",
      description: "Create a reversible internal evidence proposal. It never overwrites canonical contact fields.",
      parametersSchema: { type: "object", properties: { entityKind: { type: "string", enum: ["account", "contact", "deal"] }, entityId: { type: "string" }, field: { type: "string" }, value: {}, source: { type: "string", minLength: 1 }, idempotencyKey: { type: "string", minLength: 1, maxLength: 200 }, companyId: { type: "string" } }, required: ["entityKind", "entityId", "field", "value", "source", "idempotencyKey"] },
    },
    {
      name: "crm_create_followup_issue",
      displayName: "Create CRM Follow-up Issue",
      description: "Create or return one idempotently linked internal Paperclip follow-up issue for the current company.",
      parametersSchema: { type: "object", properties: { entityKind: { type: "string", enum: ["account", "contact", "deal", "activity", "evidence"] }, entityId: { type: "string" }, title: { type: "string", minLength: 1 }, description: { type: "string" }, idempotencyKey: { type: "string", minLength: 1, maxLength: 200 }, companyId: { type: "string" } }, required: ["entityKind", "entityId", "title", "idempotencyKey"] },
    },
  ],
  ui: {
    slots: [
      { type: "sidebar", id: "crm-sidebar", displayName: "CRM", exportName: "CrmSidebarLink", order: 36 },
      { type: "page", id: "crm-page", displayName: "CRM", exportName: "CrmPage", routePath: "crm" },
      { type: "dashboardWidget", id: "crm-overview", displayName: "CRM overview", exportName: "CrmDashboardWidget" },
    ],
  },
};

export default manifest;
