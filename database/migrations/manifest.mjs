export const migrations = Object.freeze([
  Object.freeze({
    id: "0000_vengeful_raider",
    path: "drizzle/0000_vengeful_raider.sql",
    description: "Generated PostgreSQL 18 application tables and indexes",
  }),
  Object.freeze({
    id: "0001_hard_constraints",
    path: "database/migrations/after-drizzle/0001_hard_constraints.sql",
    description:
      "Exclusion constraints, reversal keys, and immutable-history triggers",
  }),
  Object.freeze({
    id: "0002_whole_rupiah_amounts",
    path: "database/migrations/after-drizzle/0002_whole_rupiah_amounts.sql",
    description:
      "Whole-rupiah check constraints on official IDR amount columns",
  }),
  Object.freeze({
    id: "0003_auth_contract_alignment",
    path: "database/migrations/after-drizzle/0003_auth_contract_alignment.sql",
    description:
      "Rename auth_sessions/auth_verifications/auth_accounts columns to match Better Auth's default field contract",
  }),
  Object.freeze({
    id: "0004_two_factor_foundation",
    path: "database/migrations/after-drizzle/0004_two_factor_foundation.sql",
    description:
      "Legacy compatibility fields retained after MFA was removed from the runtime product decision",
  }),
  Object.freeze({
    id: "0005_rbac_baseline_catalog",
    path: "database/migrations/after-drizzle/0005_rbac_baseline_catalog.sql",
    description:
      "Baseline role/permission catalog and role-to-permission mapping (scaffold pending Owner's final matrix)",
  }),
  Object.freeze({
    id: "0006_platform_safety_hardening",
    path: "database/migrations/after-drizzle/0006_platform_safety_hardening.sql",
    description:
      "Outbox lease-state constraints and non-overlapping user-role grants",
  }),
  Object.freeze({
    id: "0007_master_configuration_controls",
    path: "database/migrations/after-drizzle/0007_master_configuration_controls.sql",
    description:
      "Version lifecycle, approval, overlap, pricing, and RBAC controls for property, room, and commercial master administration",
  }),
  Object.freeze({
    id: "0008_booking_transaction_flow",
    path: "database/migrations/after-drizzle/0008_booking_transaction_flow.sql",
    description:
      "Quote/reservation payment terms, booking snapshot foreign key, and inventory/payment/customer lookup indexes for Technical Batch 2",
  }),
  Object.freeze({
    id: "0009_operational_workflows",
    path: "database/migrations/after-drizzle/0009_operational_workflows.sql",
    description:
      "Room/stay operations, financial-document rendering, workflow constraints, and Batch 3 permission catalog",
  }),
  Object.freeze({
    id: "0010_cms_public_landing",
    path: "database/migrations/after-drizzle/0010_cms_public_landing.sql",
    description:
      "Bilingual CMS publication lifecycle, authentic public media controls, public lookup indexes, and Batch 4 permission catalog",
  }),
  Object.freeze({
    id: "0011_fnb_paper_orders",
    path: "database/migrations/after-drizzle/0011_fnb_paper_orders.sql",
    description:
      "Public menu, manual paper F&B orders, room-charge safeguards, standalone receipt records, and Batch 5 Front Office grants",
  }),
  Object.freeze({
    id: "0012_reporting_daily_operations",
    path: "database/migrations/after-drizzle/0012_reporting_daily_operations.sql",
    description:
      "Operational dashboard, business-day rollover, reconciliation exception workflow, privacy-safe CSV exports, and reporting permissions",
  }),
  Object.freeze({
    id: "0013_owner_super_admin_alignment",
    path: "database/migrations/after-drizzle/0013_owner_super_admin_alignment.sql",
    description:
      "Align OWNER as the property Super Admin with every installed named permission",
  }),
  Object.freeze({
    id: "0014_financial_document_render_guard",
    path: "database/migrations/after-drizzle/0014_financial_document_render_guard.sql",
    description:
      "Allow the asynchronous PDF renderer to attach its file once while keeping financial-document versions otherwise immutable",
  }),
  Object.freeze({
    id: "0015_attendance_location_configuration",
    path: "database/migrations/after-drizzle/0015_attendance_location_configuration.sql",
    description:
      "Effective attendance locations, dedicated permissions, and Owner/Front Office grants",
  }),
  Object.freeze({
    id: "0016_attendance_event_persistence",
    path: "database/migrations/after-drizzle/0016_attendance_event_persistence.sql",
    description:
      "One active attendance session per employee/business date, event reporting index, and event-status guard",
  }),
  Object.freeze({
    id: "0017_server_pagination_indexes",
    path: "database/migrations/after-drizzle/0017_server_pagination_indexes.sql",
    description:
      "Property and chronology indexes for paginated booking, payment, and audit histories",
  }),
  Object.freeze({
    id: "0018_global_payment_instructions",
    path: "database/migrations/after-drizzle/0018_global_payment_instructions.sql",
    description:
      "Snapshot every active property bank account offered for each reservation",
  }),
  Object.freeze({
    id: "0019_excel_report_exports",
    path: "database/migrations/after-drizzle/0019_excel_report_exports.sql",
    description:
      "Allow audited privacy-safe Excel report exports while retaining historical CSV metadata",
  }),
  Object.freeze({
    id: "0020_cancelled_room_assignment_cleanup",
    path: "database/migrations/after-drizzle/0020_cancelled_room_assignment_cleanup.sql",
    description:
      "Release historical physical-room assignments and night claims left by cancelled or expired reservations",
  }),
]);
