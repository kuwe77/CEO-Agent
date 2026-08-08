ALTER TABLE plugin_ceo_crm_6dfa6b60e3.crm_accounts
  ADD COLUMN idempotency_key text;

CREATE UNIQUE INDEX crm_accounts_company_idempotency_idx
  ON plugin_ceo_crm_6dfa6b60e3.crm_accounts (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE plugin_ceo_crm_6dfa6b60e3.crm_contacts
  ADD COLUMN idempotency_key text;

CREATE UNIQUE INDEX crm_contacts_company_idempotency_idx
  ON plugin_ceo_crm_6dfa6b60e3.crm_contacts (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE plugin_ceo_crm_6dfa6b60e3.crm_deals
  ADD COLUMN idempotency_key text;

CREATE UNIQUE INDEX crm_deals_company_idempotency_idx
  ON plugin_ceo_crm_6dfa6b60e3.crm_deals (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE plugin_ceo_crm_6dfa6b60e3.crm_evidence
  ADD COLUMN idempotency_key text;

CREATE UNIQUE INDEX crm_evidence_company_idempotency_idx
  ON plugin_ceo_crm_6dfa6b60e3.crm_evidence (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE plugin_ceo_crm_6dfa6b60e3.crm_work_links
  ALTER COLUMN issue_id DROP NOT NULL;

CREATE INDEX crm_work_links_issue_pending_idx
  ON plugin_ceo_crm_6dfa6b60e3.crm_work_links (company_id, created_at)
  WHERE issue_id IS NULL;
