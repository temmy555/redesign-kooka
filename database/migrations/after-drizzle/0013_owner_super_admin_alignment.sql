-- Final Owner decision: OWNER is the Super Admin role for the single-property
-- KOOKA deployment. It receives every named permission currently installed,
-- including operational and sensitive-data permissions. Authorization remains
-- permission-based (no code bypass), property-scoped, MFA-gated, and audited.

UPDATE roles
SET
  name = 'Super Admin / Owner',
  description = 'Full administration and operational access across the KOOKA property'
WHERE code = 'OWNER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT owner_role.id, permission.id
FROM roles owner_role
CROSS JOIN permissions permission
WHERE owner_role.code = 'OWNER'
  AND owner_role.status = 'ACTIVE'
ON CONFLICT (role_id, permission_id) DO NOTHING;
