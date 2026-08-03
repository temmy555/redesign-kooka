-- Run after the two-factor-foundation batch.
-- Roadmap Langkah 7: named permission catalog and its baseline role
-- mapping, moved into a real migration (not the dev-only seed script) so it
-- exists identically in every environment -- test, UAT, and production --
-- the same way `roles` should have from the start. `roles` is re-inserted
-- here too (ON CONFLICT DO NOTHING) purely so production gets the baseline
-- without depending on `db:seed:dev`, which stays development/test-only for
-- the synthetic property.
--
-- This is a SCAFFOLD catalog, not the final named permission matrix: the
-- roadmap explicitly reserves that decision for Owner input
-- ("Owner input: final named permission matrix dan siapa yang menerima
-- setiap role", docs/IMPLEMENTATION-ROADMAP.md Langkah 7). Every row below
-- is derived directly from the role descriptions already approved in
-- docs/SECURITY-PRIVACY-RETENTION.md §3, not invented business policy:
--   - Owner/Super Admin: "konfigurasi role, approval, audit, security/
--     retention rule" -> identity.role.manage, identity.permission.manage,
--     identity.employee.manage, audit.view, security.config.manage.
--   - Front Office: "booking/stay/payment sesuai izin; akses KTP/signature
--     hanya jika permission khusus diberikan" -> booking.manage,
--     stay.manage, payment.manage. The sensitive KTP/signature/evidence
--     permissions below are deliberately NOT granted to any role here --
--     they are only "diberikan" (granted) selectively once Owner decides.
--   - Cleaning: "room/task/operational note minimum; tanpa payment, folio,
--     KTP, signature, atau refund account" -> housekeeping.task.manage,
--     housekeeping.note.manage only.
--   - F&B: "order, room number, Room Lead Guest identifier minimum, charge
--     privilege, dan billing destination; tanpa data sensitif lodging" ->
--     fnb.order.manage, fnb.charge.manage, fnb.guest_lookup.view.
--   - All four roles get attendance.self.view, matching
--     docs/TECHNICAL-ARCHITECTURE.md §3: "Role F&B, Cleaning, Front Office,
--     dan Owner dapat melihat attendance pribadi melalui login yang sama
--     jika memiliki employee profile aktif."
--
-- Owner is deliberately NOT given booking/stay/payment/housekeeping/fnb
-- permissions by default: the doc scopes Owner's baseline to governance
-- (role/audit/security config), not day-to-day operations. An Owner who
-- also works the front desk can be granted the FRONT_OFFICE role in
-- addition to OWNER through the same user_roles grant mechanism used for
-- anyone else -- that is a deployment/provisioning decision, not a schema
-- one.

INSERT INTO roles (code, name, description, system_role)
VALUES
  ('OWNER', 'Super Admin / Owner', 'Role/permission configuration, approval, audit, and security/retention rules', true),
  ('FRONT_OFFICE', 'Admin / Front Office', 'Booking, stay, and payment within granted permissions', true),
  ('CLEANING', 'Cleaning', 'Room/task/operational notes only; no payment, folio, or sensitive guest data', true),
  ('FNB', 'F&B', 'Order, room number, and Room Lead Guest identifier only; no sensitive lodging data', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module, description, sensitive)
VALUES
  ('identity.role.manage', 'identity', 'Grant/revoke user-role assignments and manage role catalog', false),
  ('identity.permission.manage', 'identity', 'Manage the permission catalog and role-to-permission mapping', false),
  ('identity.employee.manage', 'identity', 'Create/update employee profiles and link them to a user account', false),
  ('audit.view', 'audit', 'View audit events and security event review queue', false),
  ('security.config.manage', 'security', 'Manage security and retention configuration', false),
  ('booking.manage', 'booking', 'Create/modify reservations within granted permissions', false),
  ('stay.manage', 'stay', 'Manage in-house stay operations within granted permissions', false),
  ('payment.manage', 'payment', 'Record/verify/void payments and refunds within granted permissions', false),
  ('housekeeping.task.manage', 'housekeeping', 'Manage housekeeping/maintenance tasks', false),
  ('housekeeping.note.manage', 'housekeeping', 'Manage internal room/operational notes', false),
  ('fnb.order.manage', 'fnb', 'Record F&B orders against a room number', false),
  ('fnb.charge.manage', 'fnb', 'Post F&B charges to the correct billing destination', false),
  ('fnb.guest_lookup.view', 'fnb', 'Look up the Room Lead Guest identifier for an order', false),
  ('attendance.self.view', 'attendance', 'View one''s own attendance sessions/events', false),
  ('guest.identity_document.view', 'guest', 'View KTP/passport identity document images', true),
  ('guest.signature.view', 'guest', 'View captured guest signatures', true),
  ('payment.evidence.view', 'payment', 'View payment/refund evidence attachments', true),
  ('attendance.selfie.view', 'attendance', 'View attendance selfie captures', true),
  ('data.export', 'export', 'Export data containing personal or financial information', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('OWNER', 'identity.role.manage'),
  ('OWNER', 'identity.permission.manage'),
  ('OWNER', 'identity.employee.manage'),
  ('OWNER', 'audit.view'),
  ('OWNER', 'security.config.manage'),
  ('OWNER', 'attendance.self.view'),
  ('FRONT_OFFICE', 'booking.manage'),
  ('FRONT_OFFICE', 'stay.manage'),
  ('FRONT_OFFICE', 'payment.manage'),
  ('FRONT_OFFICE', 'attendance.self.view'),
  ('CLEANING', 'housekeeping.task.manage'),
  ('CLEANING', 'housekeeping.note.manage'),
  ('CLEANING', 'attendance.self.view'),
  ('FNB', 'fnb.order.manage'),
  ('FNB', 'fnb.charge.manage'),
  ('FNB', 'fnb.guest_lookup.view'),
  ('FNB', 'attendance.self.view')
) AS baseline(role_code, permission_code)
JOIN roles r ON r.code = baseline.role_code
JOIN permissions p ON p.code = baseline.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;
