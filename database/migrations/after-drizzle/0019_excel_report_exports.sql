ALTER TABLE report_exports
  DROP CONSTRAINT IF EXISTS ck_report_export_format;

ALTER TABLE report_exports
  ALTER COLUMN format SET DEFAULT 'XLSX';

ALTER TABLE report_exports
  ADD CONSTRAINT ck_report_export_format
  CHECK (format IN ('CSV', 'XLSX'));
