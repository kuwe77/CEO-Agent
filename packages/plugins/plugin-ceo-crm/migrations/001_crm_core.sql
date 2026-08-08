CREATE TABLE plugin_ceo_crm_6dfa6b60e3.crm_accounts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_domain text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by_actor_type text NOT NULL CHECK (created_by_actor_type IN ('user', 'agent', 'system')),
  created_by_actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (company_id, normalized_domain)
);

CREATE TABLE plugin_ceo_crm_6dfa6b60e3.crm_contacts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid,
  first_name text NOT NULL,
  last_name text,
  email text,
  normalized_email text,
  title text,
  canonical_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_actor_type text NOT NULL CHECK (created_by_actor_type IN ('user', 'agent', 'system')),
  created_by_actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (company_id, normalized_email),
  FOREIGN KEY (account_id, company_id) REFERENCES plugin_ceo_crm_6dfa6b60e3.crm_accounts(id, company_id) ON DELETE RESTRICT
);

CREATE TABLE plugin_ceo_crm_6dfa6b60e3.crm_pipelines (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (company_id, name)
);

CREATE UNIQUE INDEX crm_pipelines_one_default_per_company
  ON plugin_ceo_crm_6dfa6b60e3.crm_pipelines (company_id)
  WHERE is_default;

CREATE TABLE plugin_ceo_crm_6dfa6b60e3.crm_pipeline_stages (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (id, company_id, pipeline_id),
  UNIQUE (company_id, pipeline_id, name),
  UNIQUE (company_id, pipeline_id, position),
  FOREIGN KEY (pipeline_id, company_id) REFERENCES plugin_ceo_crm_6dfa6b60e3.crm_pipelines(id, company_id) ON DELETE CASCADE
);

CREATE TABLE plugin_ceo_crm_6dfa6b60e3.crm_deals (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid,
  pipeline_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric(14, 2),
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  owner_agent_id uuid,
  expected_close_on date,
  created_by_actor_type text NOT NULL CHECK (created_by_actor_type IN ('user', 'agent', 'system')),
  created_by_actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  CHECK (amount IS NULL OR amount >= 0),
  FOREIGN KEY (account_id, company_id) REFERENCES plugin_ceo_crm_6dfa6b60e3.crm_accounts(id, company_id) ON DELETE RESTRICT,
  FOREIGN KEY (pipeline_id, company_id) REFERENCES plugin_ceo_crm_6dfa6b60e3.crm_pipelines(id, company_id) ON DELETE RESTRICT,
  FOREIGN KEY (stage_id, company_id, pipeline_id) REFERENCES plugin_ceo_crm_6dfa6b60e3.crm_pipeline_stages(id, company_id, pipeline_id) ON DELETE RESTRICT
);

CREATE TABLE plugin_ceo_crm_6dfa6b60e3.crm_activities (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid,
  contact_id uuid,
  deal_id uuid,
  kind text NOT NULL CHECK (kind IN ('internal_note', 'call', 'meeting', 'email')),
  body text NOT NULL,
  idempotency_key text,
  created_by_actor_type text NOT NULL CHECK (created_by_actor_type IN ('user', 'agent', 'system')),
  created_by_actor_id text NOT NULL,
  run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(account_id, contact_id, deal_id) = 1),
  UNIQUE (id, company_id),
  UNIQUE (company_id, idempotency_key),
  FOREIGN KEY (account_id, company_id) REFERENCES plugin_ceo_crm_6dfa6b60e3.crm_accounts(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id, company_id) REFERENCES plugin_ceo_crm_6dfa6b60e3.crm_contacts(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY (deal_id, company_id) REFERENCES plugin_ceo_crm_6dfa6b60e3.crm_deals(id, company_id) ON DELETE CASCADE
);

CREATE TABLE plugin_ceo_crm_6dfa6b60e3.crm_evidence (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_kind text NOT NULL CHECK (entity_kind IN ('account', 'contact', 'deal')),
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  proposed_value jsonb NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'dismissed', 'superseded')),
  actor_agent_id uuid,
  actor_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id)
);

CREATE TABLE plugin_ceo_crm_6dfa6b60e3.crm_work_links (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  crm_entity_kind text NOT NULL CHECK (crm_entity_kind IN ('account', 'contact', 'deal', 'activity', 'evidence')),
  crm_entity_id uuid NOT NULL,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('follow_up', 'research', 'approval', 'delivery', 'support')),
  idempotency_key text NOT NULL,
  actor_agent_id uuid,
  actor_user_id uuid,
  actor_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, idempotency_key),
  UNIQUE (company_id, crm_entity_kind, crm_entity_id, issue_id, relationship)
);

CREATE TABLE plugin_ceo_crm_6dfa6b60e3.crm_outbox (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE (company_id, idempotency_key)
);

CREATE INDEX crm_accounts_company_name_idx ON plugin_ceo_crm_6dfa6b60e3.crm_accounts (company_id, name);
CREATE INDEX crm_contacts_company_name_idx ON plugin_ceo_crm_6dfa6b60e3.crm_contacts (company_id, last_name, first_name);
CREATE INDEX crm_deals_company_stage_idx ON plugin_ceo_crm_6dfa6b60e3.crm_deals (company_id, stage_id);
CREATE INDEX crm_activities_company_created_idx ON plugin_ceo_crm_6dfa6b60e3.crm_activities (company_id, created_at DESC);
CREATE INDEX crm_evidence_company_entity_idx ON plugin_ceo_crm_6dfa6b60e3.crm_evidence (company_id, entity_kind, entity_id, created_at DESC);
CREATE INDEX crm_outbox_pending_idx ON plugin_ceo_crm_6dfa6b60e3.crm_outbox (company_id, created_at) WHERE status = 'pending';
