import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { appendOnlyColumns, id, locale, metadata, status, trackedColumns, utcTimestamp } from "./common";
import { properties } from "./property";

export const users = pgTable(
  "users",
  {
    id: id(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    emailNormalized: varchar("email_normalized", { length: 320 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    locale: locale().notNull().default("id"),
    status: status().notNull().default("ACTIVE"),
    lastLoginAt: utcTimestamp("last_login_at"),
    archivedAt: utcTimestamp("archived_at"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_users_email_normalized").on(table.emailNormalized),
    check("ck_users_locale", sql`${table.locale} in ('id', 'en')`),
    check("ck_users_status", sql`${table.status} in ('ACTIVE', 'SUSPENDED', 'ARCHIVED')`),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 128 }).notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    revokedAt: utcTimestamp("revoked_at"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_auth_sessions_token").on(table.token),
    index("ix_auth_sessions_user_expiry").on(table.userId, table.expiresAt),
  ],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerId: varchar("provider_id", { length: 80 }).notNull(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    passwordHash: text("password_hash"),
    credentialData: metadata("credential_data"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_auth_accounts_provider")
      .on(table.providerId, table.accountId),
    index("ix_auth_accounts_user").on(table.userId),
  ],
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: id(),
    identifier: varchar("identifier", { length: 320 }).notNull(),
    value: varchar("value", { length: 512 }).notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    consumedAt: utcTimestamp("consumed_at"),
    // Better Auth's adapter updates verification rows in place (e.g. OTP
    // retry bookkeeping), so this needs updatedAt alongside the append-only
    // creation columns, unlike a true audit-trail table.
    updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_auth_verifications_identifier_expiry").on(table.identifier, table.expiresAt)],
);

// Legacy compatibility table created by migration 0004. MFA was removed from
// the product decision on 2026-08-02; keeping this mapping avoids rewriting an
// already-applied migration. Runtime authentication does not use this table.
export const twoFactorCredentials = pgTable(
  "two_factor_credentials",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: utcTimestamp("locked_until"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_two_factor_credentials_user").on(table.userId),
    index("ix_two_factor_credentials_secret").on(table.secret),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: id(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    systemRole: boolean("system_role").notNull().default(false),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_roles_code").on(table.code)],
);

export const permissions = pgTable(
  "permissions",
  {
    id: id(),
    code: varchar("code", { length: 120 }).notNull(),
    module: varchar("module", { length: 64 }).notNull(),
    description: text("description"),
    sensitive: boolean("sensitive").notNull().default(false),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_permissions_code").on(table.code)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    effectiveFrom: utcTimestamp("effective_from").notNull().defaultNow(),
    effectiveTo: utcTimestamp("effective_to"),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId, table.propertyId, table.effectiveFrom] }),
    index("ix_user_roles_active").on(table.userId, table.propertyId, table.effectiveTo),
    check("ck_user_roles_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
    ...appendOnlyColumns,
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const employeeProfiles = pgTable(
  "employee_profiles",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    employeeCode: varchar("employee_code", { length: 40 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    employmentStatus: status("employment_status").notNull().default("ACTIVE"),
    defaultAttendanceMode: status("default_attendance_mode").notNull().default("SHIFT"),
    archivedAt: utcTimestamp("archived_at"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_employee_profiles_user").on(table.userId),
    uniqueIndex("uq_employee_profiles_code").on(table.propertyId, table.employeeCode),
    check("ck_employee_status", sql`${table.employmentStatus} in ('ACTIVE', 'INACTIVE', 'TERMINATED')`),
    check("ck_employee_attendance_mode", sql`${table.defaultAttendanceMode} in ('SHIFT', 'FREE')`),
  ],
);
