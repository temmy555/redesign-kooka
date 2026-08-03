-- Technical Batch 4: bilingual CMS, authentic public media, and landing-page
-- publication controls. Public rendering reads operational room fields from
-- the lodging master; these constraints cover editorial lifecycle only.

ALTER TABLE content_pages
  DROP CONSTRAINT IF EXISTS ck_content_page_status,
  ADD CONSTRAINT ck_content_page_status CHECK (status IN ('ACTIVE', 'ARCHIVED'));

ALTER TABLE content_page_versions
  DROP CONSTRAINT IF EXISTS ck_content_page_version_lifecycle,
  ADD CONSTRAINT ck_content_page_version_lifecycle CHECK (
    lifecycle_status IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED')
  ),
  DROP CONSTRAINT IF EXISTS ck_content_page_version_publish_fields,
  ADD CONSTRAINT ck_content_page_version_publish_fields CHECK (
    lifecycle_status <> 'PUBLISHED'
    OR (published_at IS NOT NULL AND published_by_user_id IS NOT NULL)
  );

ALTER TABLE content_translations
  DROP CONSTRAINT IF EXISTS ck_content_translation_status,
  ADD CONSTRAINT ck_content_translation_status CHECK (
    translation_status IN ('DRAFT', 'PUBLISHED')
  );

ALTER TABLE media_assets
  DROP CONSTRAINT IF EXISTS ck_media_asset_status,
  ADD CONSTRAINT ck_media_asset_status CHECK (
    status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')
  ),
  DROP CONSTRAINT IF EXISTS ck_media_asset_type,
  ADD CONSTRAINT ck_media_asset_type CHECK (media_type IN ('IMAGE', 'VIDEO'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_page_single_published
  ON content_page_versions (content_page_id)
  WHERE lifecycle_status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS ix_content_public_lookup
  ON content_page_versions (content_page_id, lifecycle_status, effective_from, published_at DESC);

CREATE INDEX IF NOT EXISTS ix_media_public_delivery
  ON media_assets (id, status, file_id)
  WHERE status = 'PUBLISHED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_usage_asset_target
  ON media_usages (media_asset_id, usage_type, target_id);

INSERT INTO permissions (code, module, description, sensitive)
VALUES
  ('cms.content.view', 'cms', 'View CMS pages, revisions, and publication status', false),
  ('cms.content.edit', 'cms', 'Create bilingual CMS page revisions and submit review', false),
  ('cms.content.review', 'cms', 'Review bilingual CMS revisions', false),
  ('cms.content.publish', 'cms', 'Publish, archive, and restore public CMS revisions', false),
  ('cms.preview', 'cms', 'Create protected short-lived content preview links', false),
  ('cms.media.manage', 'cms', 'Upload and manage staged CMS media metadata', false),
  ('cms.media.publish', 'cms', 'Publish or archive scanned CMS media', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('OWNER', 'cms.content.view'),
  ('OWNER', 'cms.content.edit'),
  ('OWNER', 'cms.content.review'),
  ('OWNER', 'cms.content.publish'),
  ('OWNER', 'cms.preview'),
  ('OWNER', 'cms.media.manage'),
  ('OWNER', 'cms.media.publish'),
  ('FRONT_OFFICE', 'cms.content.view'),
  ('FRONT_OFFICE', 'cms.content.edit'),
  ('FRONT_OFFICE', 'cms.preview'),
  ('FRONT_OFFICE', 'cms.media.manage')
) AS batch4(role_code, permission_code)
JOIN roles r ON r.code = batch4.role_code
JOIN permissions p ON p.code = batch4.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;
