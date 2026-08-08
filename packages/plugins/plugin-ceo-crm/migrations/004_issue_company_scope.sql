ALTER TABLE plugin_ceo_crm_6dfa6b60e3.crm_work_links
  DROP CONSTRAINT IF EXISTS crm_work_links_issue_id_fkey;

ALTER TABLE plugin_ceo_crm_6dfa6b60e3.crm_work_links
  ADD CONSTRAINT crm_work_links_issue_company_fk
  FOREIGN KEY (issue_id, company_id)
  REFERENCES public.issues(id, company_id)
  ON DELETE CASCADE;
