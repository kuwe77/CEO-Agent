# CEO CRM bounded context

The bundled `@paperclipai/plugin-ceo-crm` package is the first company-scoped CRM vertical slice. It adds business data without changing Paperclip's role as the tenant and control plane or Hermes's role as the execution runtime.

## Ownership matrix

| Object | Canonical owner | Boundary |
| --- | --- | --- |
| Tenant/company, agents, runs, approvals, budgets | Paperclip | CRM stores a required `company_id`; it never duplicates Companies, agents, sessions, or auth. |
| Customer organization | CRM `crm_accounts` | Called an Account to avoid overloading Paperclip Company. |
| Customer person | CRM `crm_contacts` | Unique and queried only within `company_id`. |
| Pipeline, stages, opportunities, internal activities | CRM plugin namespace | All business rows are company-scoped. |
| CRM evidence | CRM `crm_evidence` | Append-only proposals; human canonical fields are never changed by an agent proposal. |
| Follow-up execution work | Paperclip `issues` | `crm_work_links` stores only a scoped issue ID and relationship. |
| Credentials and provider connections | Paperclip secrets and Apps v2 | The plugin has no direct database or provider credentials. |

## Governance

- Board API writes are `board` authenticated and company-resolved by the host.
- Agent reads and reversible internal writes run only through registered plugin tools. Handlers derive company scope from the authenticated run context and reject a mismatched `companyId`.
- Evidence proposals and internal notes are auditable and reversible/internal. They cannot auto-change a deal's stage, amount, or owner, and they cannot overwrite a contact's canonical fields.
- Every core mutation is retry-safe through a company-scoped idempotency key. Duplicate normalized Account domains or Contact emails resolve to an explicit conflict rather than an internal worker error.
- Follow-up retries converge on one Paperclip issue through a unique CRM origin and host create-or-get operation; the linked issue must match the CRM row's company at the database layer.
- Evidence proposals, CRM outbox events, and Paperclip activity metadata retain the initiating user, agent, and run identifiers when present.
- External email, calendar, exports, deletes, bulk operations, real-data imports, and automatic outreach are outside this slice and require a later governed approval design.

## Provenance

The design evaluated `trycompai/crm` commit `477e5928da9b9a135a98f3828b2972b4384647e9`, whose root license is MIT (copyright 2026 Comp AI). Domain concepts were evaluated and adapted; no TryComp code, branding, assets, runtime, or credentials were copied, vendored, fetched, or merged. The package-local notice records the same provenance.

## Rollout

1. Build, test, and apply the plugin namespace migration in an isolated local development instance.
2. Review the founder UI, scoped route behavior, tool access policy, and audit/outbox records with an empty company.
3. Explicitly install and enable the package only after operator approval; this change does not do that.
4. Treat any connection, import, external action, or release as a separate approval gate.
