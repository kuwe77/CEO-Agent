ALTER TABLE plugin_ceo_crm_6dfa6b60e3.crm_work_links
  ALTER COLUMN actor_user_id TYPE text
  USING actor_user_id::text;
