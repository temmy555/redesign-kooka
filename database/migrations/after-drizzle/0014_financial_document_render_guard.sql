-- Financial document versions remain append-only, except for the one-way
-- attachment of the asynchronously rendered PDF file.

CREATE OR REPLACE FUNCTION kooka_guard_financial_document_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_immutable_mutation', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.rendered_file_id IS NULL
     AND NEW.rendered_file_id IS NOT NULL
     AND (to_jsonb(NEW) - 'rendered_file_id') = (to_jsonb(OLD) - 'rendered_file_id') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION '% is append-only; only the initial rendered PDF attachment is allowed', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_document_versions_immutable
  ON financial_document_versions;

CREATE TRIGGER trg_financial_document_versions_immutable
  BEFORE UPDATE OR DELETE ON financial_document_versions
  FOR EACH ROW EXECUTE FUNCTION kooka_guard_financial_document_version_mutation();
