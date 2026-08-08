# CEO CRM plugin

`@paperclipai/plugin-ceo-crm` is Paperclip's bundled first-party, company-scoped CRM bounded context. It owns customer Accounts, Contacts, configurable Pipelines and stages, Deals, internal activities, evidence proposals, CRM-to-issue links, and its outbox in the plugin database namespace.

Paperclip Companies remain tenants and the control plane; an Account is a customer organization and must never be used as a replacement for a Paperclip Company. Paperclip Issues remain the source of truth for execution work. CRM links only retain an issue ID and relationship metadata.

Hermes and other agents only access CRM through the five plugin tools. The plugin never exposes database credentials, creates an agent profile, starts an agent runtime, stores OAuth tokens, or duplicates task/auth/session systems.

The first vertical slice deliberately excludes email/calendar sends, exports, deletion, bulk actions, automatic changes to deal stage/amount/owner, and automatic application of evidence proposals.

Core writes require company-scoped idempotency keys. Duplicate Account domains and Contact emails return deterministic conflicts. Follow-up creation uses a database-unique CRM origin plus host create-or-get semantics, while the CRM work link enforces the same Paperclip issue company through a composite foreign key. Evidence, outbox events, and host activity metadata retain the initiating user/agent/run provenance.

## Local verification

```sh
pnpm --filter @paperclipai/plugin-ceo-crm typecheck
pnpm --filter @paperclipai/plugin-ceo-crm test
pnpm --filter @paperclipai/plugin-ceo-crm build
```

This package is bundled source only. It is not installed or enabled in any running company by this change.

## Provenance

The design evaluated concepts from `trycompai/crm` at commit `477e5928da9b9a135a98f3828b2972b4384647e9`, under that repository's root MIT license. Concepts such as evidence-first enrichment and stable CRM identifiers were adapted to Paperclip's multi-company plugin boundary. No source files, branding, assets, credentials, runtime, or database schema were copied. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
