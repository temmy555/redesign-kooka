import { createCipheriv, randomBytes } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import {
  createDatabasePool,
  migrate,
  migrationStatus,
} from "./lib/database-migrations.mjs";
import {
  assertLocalUatTarget,
  readCredentials,
  readLocalEnvironment,
  uatCredentialPath,
  uatDatabaseName,
  uatDatabaseUrl,
  uatEnvironmentPath,
  writeCredentials,
  writeUatEnvironment,
} from "./lib/uat-environment.mjs";

const command = process.argv[2];

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function newPassword() {
  return `${randomBytes(18).toString("base64url")}Aa1!`;
}

function encryptUatValue(plaintext, encodedKey) {
  const key = Buffer.from(encodedKey ?? "", "base64");
  if (key.length !== 32) {
    throw new Error(
      "DATA_ENCRYPTION_KEY must decode to exactly 32 bytes before UAT can prepare payment instructions",
    );
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return ["v1", iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64")))
    .join(".");
}

function createCredentials() {
  return {
    generatedAt: new Date().toISOString(),
    environment: "LOCAL_PHASE_1_UAT",
    warning: "Synthetic accounts only. Never reuse these passwords.",
    accounts: {
      OWNER: {
        name: "UAT Owner",
        email: "owner.uat@kooka.example.invalid",
        password: newPassword(),
      },
      FRONT_OFFICE: {
        name: "UAT Front Office",
        email: "frontoffice.uat@kooka.example.invalid",
        password: newPassword(),
      },
      CLEANING: {
        name: "UAT Cleaning",
        email: "cleaning.uat@kooka.example.invalid",
        password: newPassword(),
      },
      FNB: {
        name: "UAT F&B",
        email: "fnb.uat@kooka.example.invalid",
        password: newPassword(),
      },
    },
  };
}

const ids = {
  property: "70000000-0000-4000-8000-000000000001",
  users: {
    OWNER: "71000000-0000-4000-8000-000000000001",
    FRONT_OFFICE: "71000000-0000-4000-8000-000000000002",
    CLEANING: "71000000-0000-4000-8000-000000000003",
    FNB: "71000000-0000-4000-8000-000000000004",
  },
};

async function ensureDedicatedDatabase(baseUrl) {
  const targetUrl = uatDatabaseUrl(baseUrl);
  assertLocalUatTarget(targetUrl);
  const adminPool = createDatabasePool(baseUrl, 1);
  try {
    const exists = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [uatDatabaseName],
    );
    if (exists.rowCount === 0) {
      await adminPool.query(
        `CREATE DATABASE ${quoteIdentifier(uatDatabaseName)}`,
      );
    }
  } finally {
    await adminPool.end();
  }
  return targetUrl;
}

async function assertExistingDatabaseIsUat(pool) {
  const table = await pool.query(
    "SELECT to_regclass('public.properties') AS relation",
  );
  if (!table.rows[0]?.relation) return;
  const properties = await pool.query("SELECT code FROM properties");
  if (
    properties.rowCount > 0 &&
    properties.rows.some((row) => row.code !== "KOOKA-UAT")
  ) {
    throw new Error(
      "Dedicated UAT database contains a non-UAT property; refusing to modify it",
    );
  }
}

async function seedIdentity(client, credentials) {
  const roles = ["OWNER", "FRONT_OFFICE", "CLEANING", "FNB"];
  const hashes = await Promise.all(
    roles.map((role) => hashPassword(credentials.accounts[role].password)),
  );

  for (const [index, role] of roles.entries()) {
    const account = credentials.accounts[role];
    const userId = ids.users[role];
    await client.query(
      `INSERT INTO users
         (id, name, email, email_normalized, email_verified)
       VALUES ($1, $2, $3, $3, true)
       ON CONFLICT (email_normalized) DO UPDATE
       SET name = excluded.name, status = 'ACTIVE'`,
      [userId, account.name, account.email],
    );
    await client.query(
      `INSERT INTO auth_accounts
         (id, user_id, provider_id, account_id, password_hash)
       VALUES ($1::uuid, $2::uuid, 'credential', $2::varchar, $3)
       ON CONFLICT (provider_id, account_id) DO UPDATE
       SET password_hash = excluded.password_hash`,
      [
        `71100000-0000-4000-8000-00000000000${index + 1}`,
        userId,
        hashes[index],
      ],
    );
    await client.query(
      `INSERT INTO employee_profiles
         (id, user_id, property_id, employee_code, display_name,
          employment_status, default_attendance_mode, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', 'FREE', $6)
       ON CONFLICT (user_id) DO NOTHING`,
      [
        `71200000-0000-4000-8000-00000000000${index + 1}`,
        userId,
        ids.property,
        `UAT-${role}`,
        account.name,
        ids.users.OWNER,
      ],
    );
    await client.query(
      `INSERT INTO user_roles
         (user_id, role_id, property_id, effective_from,
          granted_by_user_id, created_by_user_id)
       SELECT $1, id, $2, '2026-01-01T00:00:00+07', $3, $3
       FROM roles WHERE code = $4
       ON CONFLICT DO NOTHING`,
      [userId, ids.property, ids.users.OWNER, role],
    );
  }
}

async function seedOperationalData(client, localEnvironment) {
  await client.query(`
    INSERT INTO properties (id, code, name, address)
    VALUES (
      '${ids.property}', 'KOOKA-UAT', 'KOOKA Residence — Synthetic UAT',
      'Alamat sintetis untuk pengujian; bukan data produksi'
    ) ON CONFLICT (code) DO NOTHING;

    INSERT INTO room_types (id, property_id, code) VALUES
      ('72000000-0000-4000-8000-000000000001', '${ids.property}', 'DELUXE-UAT'),
      ('72000000-0000-4000-8000-000000000002', '${ids.property}', 'EXECUTIVE-UAT')
    ON CONFLICT (property_id, code) DO NOTHING;

    INSERT INTO room_type_versions
      (id, room_type_id, version_number, lifecycle_status, approval_status,
       name_id, name_en, bed_configuration, standard_adults, maximum_adults,
       maximum_children, maximum_total_guests, extra_bed_allowed,
       maximum_extra_beds, extra_bed_capacity_increment, effective_from,
       approved_at, reason)
    VALUES
      ('72100000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 1,
       'ACTIVE', 'APPROVED', 'Deluxe UAT', 'UAT Deluxe', 'Queen Bed', 2, 2, 1, 3,
       true, 1, 1, '2026-01-01T00:00:00+07', now(), 'Synthetic UAT fixture'),
      ('72100000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', 1,
       'ACTIVE', 'APPROVED', 'Executive UAT', 'UAT Executive', 'King Bed', 2, 3, 1, 4,
       false, 0, 0, '2026-01-01T00:00:00+07', now(), 'Synthetic UAT fixture')
    ON CONFLICT (room_type_id, version_number) DO NOTHING;

    INSERT INTO room_units (id, property_id, room_number, sort_order) VALUES
      ('73000000-0000-4000-8000-000000000001', '${ids.property}', '1', 1),
      ('73000000-0000-4000-8000-000000000002', '${ids.property}', '2', 2),
      ('73000000-0000-4000-8000-000000000003', '${ids.property}', '3', 3),
      ('73000000-0000-4000-8000-000000000004', '${ids.property}', '4', 4),
      ('73000000-0000-4000-8000-000000000005', '${ids.property}', '5', 5),
      ('73000000-0000-4000-8000-000000000006', '${ids.property}', '6', 6)
    ON CONFLICT (property_id, room_number) DO NOTHING;

    INSERT INTO room_unit_type_periods
      (id, room_unit_id, room_type_id, effective_from, reason)
    VALUES
      ('73100000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '2026-01-01T00:00:00+07', 'Synthetic initial type'),
      ('73100000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', '2026-01-01T00:00:00+07', 'Synthetic initial type'),
      ('73100000-0000-4000-8000-000000000003', '73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', '2026-01-01T00:00:00+07', 'Synthetic initial type'),
      ('73100000-0000-4000-8000-000000000004', '73000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000001', '2026-01-01T00:00:00+07', 'Synthetic initial type'),
      ('73100000-0000-4000-8000-000000000005', '73000000-0000-4000-8000-000000000005', '72000000-0000-4000-8000-000000000002', '2026-01-01T00:00:00+07', 'Synthetic initial type'),
      ('73100000-0000-4000-8000-000000000006', '73000000-0000-4000-8000-000000000006', '72000000-0000-4000-8000-000000000002', '2026-01-01T00:00:00+07', 'Synthetic initial type')
    ON CONFLICT DO NOTHING;

    INSERT INTO room_unit_states
      (room_unit_id, occupancy_status, housekeeping_status, serviceability_status)
    VALUES
      ('73000000-0000-4000-8000-000000000001', 'VACANT', 'INSPECTED', 'IN_SERVICE'),
      ('73000000-0000-4000-8000-000000000002', 'OCCUPIED', 'INSPECTED', 'IN_SERVICE'),
      ('73000000-0000-4000-8000-000000000003', 'OCCUPIED', 'DIRTY', 'IN_SERVICE'),
      ('73000000-0000-4000-8000-000000000004', 'VACANT', 'DIRTY', 'IN_SERVICE'),
      ('73000000-0000-4000-8000-000000000005', 'VACANT', 'CLEANING', 'IN_SERVICE'),
      ('73000000-0000-4000-8000-000000000006', 'VACANT', 'INSPECTED', 'BLOCKED')
    ON CONFLICT (room_unit_id) DO NOTHING;

    INSERT INTO tax_profiles (id, property_id, code, name, domain)
    VALUES ('74000000-0000-4000-8000-000000000001', '${ids.property}', 'NO-TAX-UAT', 'No Tax — UAT', 'LODGING')
    ON CONFLICT (property_id, code) DO NOTHING;
    INSERT INTO tax_profile_versions
      (id, tax_profile_id, version_number, lifecycle_status, approval_status,
       tax_rate, service_charge_rate, tax_inclusive, service_charge_inclusive,
       no_tax, effective_from, approved_at, reason)
    VALUES ('74100000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', 1,
      'ACTIVE', 'APPROVED', 0, 0, false, false, true,
      '2026-01-01T00:00:00+07', now(), 'Synthetic UAT fixture')
    ON CONFLICT (tax_profile_id, version_number) DO NOTHING;

    INSERT INTO rate_plans (id, property_id, code)
    VALUES ('74200000-0000-4000-8000-000000000001', '${ids.property}', 'BAR-UAT')
    ON CONFLICT (property_id, code) DO NOTHING;
    INSERT INTO rate_plan_versions
      (id, rate_plan_id, version_number, lifecycle_status, approval_status,
       name_id, name_en, source_eligibility, tax_profile_id, effective_from,
       approved_at, reason)
    VALUES ('74300000-0000-4000-8000-000000000001', '74200000-0000-4000-8000-000000000001', 1,
      'ACTIVE', 'APPROVED', 'Harga UAT', 'UAT Rate', 'ALL',
      '74000000-0000-4000-8000-000000000001', '2026-01-01T00:00:00+07', now(),
      'Synthetic UAT fixture')
    ON CONFLICT (rate_plan_id, version_number) DO NOTHING;
    INSERT INTO rate_rules
      (id, rate_plan_version_id, room_type_id, name, rule_type, priority,
       starts_on, ends_on, nightly_rate_idr, minimum_stay, maximum_stay)
    VALUES
      ('74400000-0000-4000-8000-000000000001', '74300000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'Deluxe UAT', 'BASE', 1, '2026-01-01', '2027-12-31', 450000, 1, 30),
      ('74400000-0000-4000-8000-000000000002', '74300000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002', 'Executive UAT', 'BASE', 1, '2026-01-01', '2027-12-31', 650000, 1, 30)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO guests (id, property_id, full_name, email, phone) VALUES
      ('75000000-0000-4000-8000-000000000001', '${ids.property}', 'Tamu Belum Bayar UAT', 'unpaid.uat@example.invalid', '+620000000001'),
      ('75000000-0000-4000-8000-000000000002', '${ids.property}', 'Tamu Datang Hari Ini UAT', 'arrival.uat@example.invalid', '+620000000002'),
      ('75000000-0000-4000-8000-000000000003', '${ids.property}', 'Tamu Menginap UAT', 'inhouse.uat@example.invalid', '+620000000003'),
      ('75000000-0000-4000-8000-000000000004', '${ids.property}', 'Tamu Checkout UAT', 'dueout.uat@example.invalid', '+620000000004')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO reservations
      (id, property_id, booking_code, source, status, booker_name,
       booker_email, booker_email_normalized, booker_phone, language,
       display_currency, official_currency, payment_deadline_at, guaranteed,
       internal_notes, payment_mode, required_payment_idr)
    VALUES
      ('76000000-0000-4000-8000-000000000001', '${ids.property}', 'UAT-UNPAID', 'ONLINE', 'ON_HOLD', 'Tamu Belum Bayar UAT', 'unpaid.uat@example.invalid', 'unpaid.uat@example.invalid', '+620000000001', 'id', 'USD', 'IDR', now() + interval '1 hour', false, 'SYNTHETIC UAT — online full payment', 'FULL', 900000),
      ('76000000-0000-4000-8000-000000000002', '${ids.property}', 'UAT-ARRIVAL', 'ADMIN_MANUAL', 'CONFIRMED', 'Tamu Datang Hari Ini UAT', 'arrival.uat@example.invalid', 'arrival.uat@example.invalid', '+620000000002', 'id', 'IDR', 'IDR', null, true, 'SYNTHETIC UAT — due in', 'FULL', 900000),
      ('76000000-0000-4000-8000-000000000003', '${ids.property}', 'UAT-INHOUSE', 'ADMIN_MANUAL', 'CONFIRMED', 'Tamu Menginap UAT', 'inhouse.uat@example.invalid', 'inhouse.uat@example.invalid', '+620000000003', 'en', 'AUD', 'IDR', null, true, 'SYNTHETIC UAT — in house/payment review', 'FULL', 900000),
      ('76000000-0000-4000-8000-000000000004', '${ids.property}', 'UAT-DUEOUT', 'ADMIN_MANUAL', 'CONFIRMED', 'Tamu Checkout UAT', 'dueout.uat@example.invalid', 'dueout.uat@example.invalid', '+620000000004', 'id', 'IDR', 'IDR', null, true, 'SYNTHETIC UAT — due out', 'FULL', 1350000)
    ON CONFLICT (booking_code) DO NOTHING;

    INSERT INTO reservation_guests (reservation_id, guest_id, role) VALUES
      ('76000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000001', 'BOOKER'),
      ('76000000-0000-4000-8000-000000000002', '75000000-0000-4000-8000-000000000002', 'BOOKER'),
      ('76000000-0000-4000-8000-000000000003', '75000000-0000-4000-8000-000000000003', 'BOOKER'),
      ('76000000-0000-4000-8000-000000000004', '75000000-0000-4000-8000-000000000004', 'BOOKER')
    ON CONFLICT DO NOTHING;

    INSERT INTO reservation_rooms
      (id, reservation_id, line_number, booked_room_type_id,
       fulfilled_room_type_id, rate_plan_version_id, check_in_date,
       checkout_date, adults, children, infants)
    VALUES
      ('76100000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000001', 1, '72000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '74300000-0000-4000-8000-000000000001', current_date + 3, current_date + 5, 2, 0, 0),
      ('76100000-0000-4000-8000-000000000002', '76000000-0000-4000-8000-000000000002', 1, '72000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '74300000-0000-4000-8000-000000000001', current_date, current_date + 2, 2, 0, 0),
      ('76100000-0000-4000-8000-000000000003', '76000000-0000-4000-8000-000000000003', 1, '72000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '74300000-0000-4000-8000-000000000001', current_date - 1, current_date + 1, 2, 0, 0),
      ('76100000-0000-4000-8000-000000000004', '76000000-0000-4000-8000-000000000004', 1, '72000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '74300000-0000-4000-8000-000000000001', current_date - 3, current_date, 2, 0, 0)
    ON CONFLICT (reservation_id, line_number) DO NOTHING;

    INSERT INTO room_stays
      (id, reservation_room_id, status, lead_guest_id, planned_arrival_at,
       planned_departure_at, actual_check_in_at, charge_privilege)
    VALUES
      ('76200000-0000-4000-8000-000000000001', '76100000-0000-4000-8000-000000000001', 'NOT_STARTED', '75000000-0000-4000-8000-000000000001', current_date + interval '3 days 14 hours', current_date + interval '5 days 12 hours', null, 'APPROVAL_REQUIRED'),
      ('76200000-0000-4000-8000-000000000002', '76100000-0000-4000-8000-000000000002', 'DUE_IN', '75000000-0000-4000-8000-000000000002', current_date + interval '14 hours', current_date + interval '2 days 12 hours', null, 'ALLOWED'),
      ('76200000-0000-4000-8000-000000000003', '76100000-0000-4000-8000-000000000003', 'IN_HOUSE', '75000000-0000-4000-8000-000000000003', current_date - interval '10 hours', current_date + interval '1 day 12 hours', current_date - interval '10 hours', 'ALLOWED'),
      ('76200000-0000-4000-8000-000000000004', '76100000-0000-4000-8000-000000000004', 'DUE_OUT', '75000000-0000-4000-8000-000000000004', current_date - interval '2 days 10 hours', current_date + interval '12 hours', current_date - interval '2 days 10 hours', 'ALLOWED')
    ON CONFLICT (reservation_room_id) DO NOTHING;

    INSERT INTO room_assignments
      (id, room_stay_id, room_unit_id, effective_from, status,
       assigned_by_user_id, reason)
    VALUES
      ('76300000-0000-4000-8000-000000000002', '76200000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000001', current_date + interval '14 hours', 'PLANNED', '${ids.users.OWNER}', 'Synthetic due-in assignment'),
      ('76300000-0000-4000-8000-000000000003', '76200000-0000-4000-8000-000000000003', '73000000-0000-4000-8000-000000000002', current_date - interval '10 hours', 'ACTIVE', '${ids.users.OWNER}', 'Synthetic in-house assignment'),
      ('76300000-0000-4000-8000-000000000004', '76200000-0000-4000-8000-000000000004', '73000000-0000-4000-8000-000000000003', current_date - interval '2 days 10 hours', 'ACTIVE', '${ids.users.OWNER}', 'Synthetic due-out assignment')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO folios (id, reservation_id) VALUES
      ('77000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000001'),
      ('77000000-0000-4000-8000-000000000002', '76000000-0000-4000-8000-000000000002'),
      ('77000000-0000-4000-8000-000000000003', '76000000-0000-4000-8000-000000000003'),
      ('77000000-0000-4000-8000-000000000004', '76000000-0000-4000-8000-000000000004')
    ON CONFLICT (reservation_id) DO NOTHING;

    INSERT INTO folio_billing_buckets
      (id, folio_id, code, name, payer_guest_id, billing_details, status)
    VALUES
      ('77400000-0000-4000-8000-000000000001', '77000000-0000-4000-8000-000000000001', 'MASTER', 'Tagihan utama', '75000000-0000-4000-8000-000000000001', '{"uat":true}', 'ACTIVE'),
      ('77400000-0000-4000-8000-000000000002', '77000000-0000-4000-8000-000000000002', 'MASTER', 'Tagihan utama', '75000000-0000-4000-8000-000000000002', '{"uat":true}', 'ACTIVE'),
      ('77400000-0000-4000-8000-000000000003', '77000000-0000-4000-8000-000000000003', 'MASTER', 'Tagihan utama', '75000000-0000-4000-8000-000000000003', '{"uat":true}', 'ACTIVE'),
      ('77400000-0000-4000-8000-000000000004', '77000000-0000-4000-8000-000000000004', 'MASTER', 'Tagihan utama', '75000000-0000-4000-8000-000000000004', '{"uat":true}', 'ACTIVE')
    ON CONFLICT (folio_id, code) DO UPDATE
    SET name = excluded.name,
        payer_guest_id = excluded.payer_guest_id,
        billing_details = excluded.billing_details,
        status = 'ACTIVE',
        updated_at = now();

    INSERT INTO folio_entries
      (id, folio_id, entry_type, category, description, source_type,
       source_id, reservation_room_id, service_date, quantity,
       unit_amount_idr, net_amount_idr, total_amount_idr, pricing_snapshot,
       idempotency_key)
    VALUES
      ('77100000-0000-4000-8000-000000000001', '77000000-0000-4000-8000-000000000001', 'DEBIT', 'ROOM', '2 malam Deluxe — UAT', 'RESERVATION_ROOM', '76100000-0000-4000-8000-000000000001', '76100000-0000-4000-8000-000000000001', current_date + 3, 2, 450000, 900000, 900000, '{"uat":true}', 'uat-folio-unpaid'),
      ('77100000-0000-4000-8000-000000000002', '77000000-0000-4000-8000-000000000002', 'DEBIT', 'ROOM', '2 malam Deluxe — UAT', 'RESERVATION_ROOM', '76100000-0000-4000-8000-000000000002', '76100000-0000-4000-8000-000000000002', current_date, 2, 450000, 900000, 900000, '{"uat":true}', 'uat-folio-arrival'),
      ('77100000-0000-4000-8000-000000000003', '77000000-0000-4000-8000-000000000003', 'DEBIT', 'ROOM', '2 malam Deluxe — UAT', 'RESERVATION_ROOM', '76100000-0000-4000-8000-000000000003', '76100000-0000-4000-8000-000000000003', current_date - 1, 2, 450000, 900000, 900000, '{"uat":true}', 'uat-folio-inhouse'),
      ('77100000-0000-4000-8000-000000000004', '77000000-0000-4000-8000-000000000004', 'DEBIT', 'ROOM', '3 malam Deluxe — UAT', 'RESERVATION_ROOM', '76100000-0000-4000-8000-000000000004', '76100000-0000-4000-8000-000000000004', current_date - 3, 3, 450000, 1350000, 1350000, '{"uat":true}', 'uat-folio-dueout')
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO payments
      (id, folio_id, payment_code, method, amount_idr, status, received_at,
       reference, verified_at, verified_by_user_id, idempotency_key)
    VALUES
      ('77200000-0000-4000-8000-000000000001', '77000000-0000-4000-8000-000000000002', 'PAY-UAT-ARRIVAL', 'BANK_TRANSFER', 900000, 'VERIFIED', now() - interval '1 hour', 'UAT-TRANSFER-001', now() - interval '30 minutes', '${ids.users.OWNER}', 'uat-payment-arrival'),
      ('77200000-0000-4000-8000-000000000002', '77000000-0000-4000-8000-000000000003', 'PAY-UAT-REVIEW', 'BANK_TRANSFER', 450000, 'PENDING_VERIFICATION', now() - interval '20 minutes', 'UAT-TRANSFER-002', null, null, 'uat-payment-review'),
      ('77200000-0000-4000-8000-000000000003', '77000000-0000-4000-8000-000000000004', 'PAY-UAT-DUEOUT', 'CASH', 1350000, 'VERIFIED', now() - interval '2 days', 'UAT-CASH-001', now() - interval '2 days', '${ids.users.OWNER}', 'uat-payment-dueout')
    ON CONFLICT (payment_code) DO NOTHING;

    INSERT INTO payment_status_events
      (id, payment_id, action, from_status, to_status, reason, actor_user_id)
    VALUES
      ('77300000-0000-4000-8000-000000000001', '77200000-0000-4000-8000-000000000001', 'VERIFY', 'PENDING_VERIFICATION', 'VERIFIED', 'Synthetic verified payment', '${ids.users.OWNER}'),
      ('77300000-0000-4000-8000-000000000002', '77200000-0000-4000-8000-000000000002', 'SUBMIT', null, 'PENDING_VERIFICATION', 'Synthetic payment review queue', null),
      ('77300000-0000-4000-8000-000000000003', '77200000-0000-4000-8000-000000000003', 'VERIFY', 'PENDING_VERIFICATION', 'VERIFIED', 'Synthetic cash payment', '${ids.users.OWNER}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO cleaning_tasks
      (id, property_id, room_unit_id, room_stay_id, public_area, task_type,
       priority, status, target_at, requested_entry_permission,
       assignee_employee_id, notes)
    VALUES
      ('78000000-0000-4000-8000-000000000001', '${ids.property}', '73000000-0000-4000-8000-000000000002', '76200000-0000-4000-8000-000000000003', null, 'STAYOVER', 'HIGH', 'REQUESTED', now() + interval '1 hour', 'GUEST_AWAY_REQUEST', '71200000-0000-4000-8000-000000000003', 'Tamu sedang pergi dan meminta kamar dibersihkan'),
      ('78000000-0000-4000-8000-000000000002', '${ids.property}', '73000000-0000-4000-8000-000000000005', null, null, 'CHECKOUT_TURNOVER', 'NORMAL', 'ASSIGNED', now() + interval '2 hours', null, '71200000-0000-4000-8000-000000000003', 'Synthetic turnover queue'),
      ('78000000-0000-4000-8000-000000000003', '${ids.property}', null, null, 'Lobby', 'PUBLIC_AREA', 'LOW', 'IN_PROGRESS', now() + interval '3 hours', null, '71200000-0000-4000-8000-000000000003', 'Synthetic public area task')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO menu_categories
      (id, property_id, code, name_id, name_en, sort_order)
    VALUES ('79000000-0000-4000-8000-000000000001', '${ids.property}', 'UAT-MAIN', 'Menu UAT', 'UAT Menu', 1)
    ON CONFLICT (property_id, code) DO NOTHING;
    INSERT INTO menu_items (id, category_id, code, currently_available) VALUES
      ('79100000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000001', 'NASI-GORENG-UAT', true),
      ('79100000-0000-4000-8000-000000000002', '79000000-0000-4000-8000-000000000001', 'TEH-UAT', true)
    ON CONFLICT (category_id, code) DO NOTHING;
    INSERT INTO menu_item_versions
      (id, menu_item_id, version_number, name_id, name_en, price_idr,
       tax_profile_version_id, lifecycle_status, effective_from)
    VALUES
      ('79200000-0000-4000-8000-000000000001', '79100000-0000-4000-8000-000000000001', 1, 'Nasi Goreng UAT', 'UAT Fried Rice', 45000, '74100000-0000-4000-8000-000000000001', 'ACTIVE', '2026-01-01T00:00:00+07'),
      ('79200000-0000-4000-8000-000000000002', '79100000-0000-4000-8000-000000000002', 1, 'Teh UAT', 'UAT Tea', 15000, '74100000-0000-4000-8000-000000000001', 'ACTIVE', '2026-01-01T00:00:00+07')
    ON CONFLICT (menu_item_id, version_number) DO NOTHING;

    INSERT INTO inventory_days
      (property_id, room_type_id, stay_date, physical_capacity)
    SELECT '${ids.property}', type_id, day::date, capacity
    FROM (VALUES
      ('72000000-0000-4000-8000-000000000001'::uuid, 4),
      ('72000000-0000-4000-8000-000000000002'::uuid, 2)
    ) AS types(type_id, capacity)
    CROSS JOIN generate_series(current_date - 3, current_date + 60, interval '1 day') day
    ON CONFLICT (property_id, room_type_id, stay_date) DO NOTHING;

    INSERT INTO audit_events
      (property_id, actor_type, action, target_type, target_id, after_json,
       reason, result)
    SELECT '${ids.property}', 'SYSTEM', 'UAT_DATASET_PREPARED', 'PROPERTY',
      '${ids.property}', '{"synthetic":true,"version":1}',
      'Roadmap Step 23 synthetic fixture', 'SUCCESS'
    WHERE NOT EXISTS (
      SELECT 1 FROM audit_events WHERE action = 'UAT_DATASET_PREPARED'
    );
  `);

  const accountNumberCiphertext = encryptUatValue(
    "0000123456",
    localEnvironment.DATA_ENCRYPTION_KEY,
  );
  await client.query(
    `INSERT INTO payment_instruction_sets (id, property_id, code, name)
     VALUES ('74500000-0000-4000-8000-000000000001', $1, 'TRANSFER-UAT', 'Transfer Bank UAT')
     ON CONFLICT (property_id, code) DO NOTHING`,
    [ids.property],
  );
  await client.query(
    `INSERT INTO payment_instruction_versions
       (id, instruction_set_id, version_number, lifecycle_status,
        approval_status, bank_name, account_holder,
        account_number_ciphertext, account_number_last4, currency,
        instruction_id, instruction_en, effective_from, approved_at, reason)
     VALUES
       ('74600000-0000-4000-8000-000000000001',
        (SELECT id FROM payment_instruction_sets WHERE property_id=$1 AND code='TRANSFER-UAT'),
        1, 'ACTIVE', 'APPROVED',
        'Bank UAT', 'KOOKA Residence UAT', $2, '3456', 'IDR',
        'Transfer penuh dalam batas waktu yang tertera. Setelah transfer, kirim kode booking dan bukti pembayaran melalui WhatsApp.',
        'Transfer the full amount before the stated deadline. Then send your booking code and payment proof through WhatsApp.',
        '2026-01-01T00:00:00+07', now(), 'Synthetic UAT fixture')
     ON CONFLICT (instruction_set_id, version_number) DO UPDATE SET
       account_number_ciphertext = excluded.account_number_ciphertext,
       lifecycle_status = 'ACTIVE'`,
    [ids.property, accountNumberCiphertext],
  );
  await client.query(
    `UPDATE rate_plan_versions
     SET payment_instruction_set_id =
       (SELECT id FROM payment_instruction_sets WHERE property_id=$1 AND code='TRANSFER-UAT')
     WHERE id = '74300000-0000-4000-8000-000000000001'`,
    [ids.property],
  );
  await client.query(
    `INSERT INTO property_setting_sets (id, property_id, code, name)
     VALUES ('74700000-0000-4000-8000-000000000001', $1, 'BOOKING_PAYMENT', 'Batas pembayaran booking online')
     ON CONFLICT (property_id, code) DO NOTHING`,
    [ids.property],
  );
  await client.query(
    `INSERT INTO property_setting_versions
       (id, setting_set_id, version_number, lifecycle_status, approval_status,
        effective_from, values, reason)
     VALUES
       ('74800000-0000-4000-8000-000000000001',
        (SELECT id FROM property_setting_sets WHERE property_id=$1 AND code='BOOKING_PAYMENT'),
        1, 'ACTIVE', 'NOT_REQUIRED',
        '2026-01-01T00:00:00+07',
        '{"onlineDeadlineMinutes":60,"sameDayDeadlineMinutes":60}'::jsonb,
        'Synthetic UAT fixture')
     ON CONFLICT (setting_set_id, version_number) DO UPDATE SET
       values = excluded.values, lifecycle_status = 'ACTIVE'`,
    [ids.property],
  );
  await client.query(
    `INSERT INTO document_profiles (id, property_id, code)
     VALUES ('74a00000-0000-4000-8000-000000000001', $1, 'DEFAULT-UAT')
     ON CONFLICT (property_id, code) DO UPDATE SET updated_at = now()`,
    [ids.property],
  );
  await client.query(
    `INSERT INTO document_profile_versions
       (id, document_profile_id, version_number, lifecycle_status,
        approval_status, legal_name, display_name, address, contact,
        footer_id, footer_en, template_reference, effective_from,
        approved_by_user_id, approved_at, reason)
     VALUES
       ('74b00000-0000-4000-8000-000000000001',
        (SELECT id FROM document_profiles WHERE property_id=$1 AND code='DEFAULT-UAT'),
        1, 'ACTIVE', 'APPROVED',
        'KOOKA Residence Surabaya', 'KOOKA Residence Surabaya',
        'Alamat sintetis untuk pengujian; bukan data produksi',
        'Front Office KOOKA Residence UAT',
        'Terima kasih telah memilih KOOKA Residence Surabaya.',
        'Thank you for choosing KOOKA Residence Surabaya.',
        'KOOKA-UAT-V1', '2026-01-01T00:00:00+07', $2, now(),
        'Synthetic UAT financial document profile')
     ON CONFLICT (document_profile_id, version_number) DO UPDATE SET
       lifecycle_status = 'ACTIVE', approval_status = 'APPROVED',
       effective_from = excluded.effective_from, effective_to = null,
       updated_at = now()`,
    [ids.property, ids.users.OWNER],
  );
  await client.query(
    `INSERT INTO exchange_rate_snapshots
       (id, property_id, base_currency, quote_currency, rate, source,
        as_of_at, expires_at, rounding_rule)
     VALUES
       ('74900000-0000-4000-8000-000000000001', $1, 'IDR', 'USD', 0.000061, 'SYNTHETIC_UAT', '2026-01-01T00:00:00+07', '2030-01-01T00:00:00+07', '{"decimals":2}'::jsonb),
       ('74900000-0000-4000-8000-000000000002', $1, 'IDR', 'AUD', 0.000094, 'SYNTHETIC_UAT', '2026-01-01T00:00:00+07', '2030-01-01T00:00:00+07', '{"decimals":2}'::jsonb)
     ON CONFLICT (property_id, quote_currency, as_of_at) DO UPDATE SET
       rate = excluded.rate, expires_at = excluded.expires_at`,
    [ids.property],
  );
}

async function verify(pool) {
  const status = await migrationStatus(pool);
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM kooka_schema_migrations) AS migrations,
      (SELECT count(*)::int FROM users WHERE id IN (
        '71000000-0000-4000-8000-000000000001',
        '71000000-0000-4000-8000-000000000002',
        '71000000-0000-4000-8000-000000000003',
        '71000000-0000-4000-8000-000000000004'
      )) AS fixture_users,
      (SELECT count(*)::int FROM employee_profiles WHERE id IN (
        '71200000-0000-4000-8000-000000000001',
        '71200000-0000-4000-8000-000000000002',
        '71200000-0000-4000-8000-000000000003',
        '71200000-0000-4000-8000-000000000004'
      )) AS fixture_employees,
      (SELECT count(*)::int FROM room_units WHERE id IN (
        '73000000-0000-4000-8000-000000000001',
        '73000000-0000-4000-8000-000000000002',
        '73000000-0000-4000-8000-000000000003',
        '73000000-0000-4000-8000-000000000004',
        '73000000-0000-4000-8000-000000000005',
        '73000000-0000-4000-8000-000000000006'
      )) AS fixture_rooms,
      (SELECT count(*)::int FROM room_types WHERE id IN (
        '72000000-0000-4000-8000-000000000001',
        '72000000-0000-4000-8000-000000000002'
      )) AS fixture_room_types,
      (SELECT count(*)::int FROM reservations WHERE id IN (
        '76000000-0000-4000-8000-000000000001',
        '76000000-0000-4000-8000-000000000002',
        '76000000-0000-4000-8000-000000000003',
        '76000000-0000-4000-8000-000000000004'
      )) AS fixture_reservations,
      (SELECT count(*)::int FROM folio_billing_buckets WHERE id IN (
        '77400000-0000-4000-8000-000000000001',
        '77400000-0000-4000-8000-000000000002',
        '77400000-0000-4000-8000-000000000003',
        '77400000-0000-4000-8000-000000000004'
      ) AND status='ACTIVE') AS fixture_billing_buckets,
      (SELECT count(*)::int FROM payments WHERE id IN (
        '77200000-0000-4000-8000-000000000001',
        '77200000-0000-4000-8000-000000000002',
        '77200000-0000-4000-8000-000000000003'
      )) AS fixture_payments,
      (SELECT count(*)::int FROM room_stays WHERE id IN (
        '76200000-0000-4000-8000-000000000001',
        '76200000-0000-4000-8000-000000000002',
        '76200000-0000-4000-8000-000000000003',
        '76200000-0000-4000-8000-000000000004'
      )) AS fixture_room_stays,
      (SELECT count(*)::int FROM cleaning_tasks WHERE id IN (
        '78000000-0000-4000-8000-000000000001',
        '78000000-0000-4000-8000-000000000002',
        '78000000-0000-4000-8000-000000000003'
      )) AS fixture_cleaning_tasks,
      (SELECT count(*)::int FROM cleaning_tasks
       WHERE id='78000000-0000-4000-8000-000000000001'
         AND requested_entry_permission='GUEST_AWAY_REQUEST') AS fixture_guest_away_requests,
      (SELECT count(*)::int FROM menu_items WHERE id IN (
        '79100000-0000-4000-8000-000000000001',
        '79100000-0000-4000-8000-000000000002'
      )) AS fixture_menu_items,
      (SELECT count(*)::int
       FROM document_profile_versions v
       JOIN document_profiles p ON p.id=v.document_profile_id
       WHERE p.property_id='${ids.property}'
         AND p.code='DEFAULT-UAT'
         AND v.lifecycle_status='ACTIVE'
         AND v.effective_from <= now()
         AND (v.effective_to IS NULL OR v.effective_to > now())) AS fixture_document_profiles,
      (SELECT count(*)::int FROM reconciliation_exceptions WHERE severity='CRITICAL' AND status IN ('OPEN','ACKNOWLEDGED','INVESTIGATING')) AS critical_reconciliation
  `);
  const checks = {
    migrationsApplied: status.every((item) => item.state === "applied"),
    fourRoleAccounts:
      result.rows[0].fixture_users === 4 &&
      result.rows[0].fixture_employees === 4,
    roomDataset:
      result.rows[0].fixture_rooms === 6 &&
      result.rows[0].fixture_room_types === 2,
    operationalScenarios:
      result.rows[0].fixture_reservations === 4 &&
      result.rows[0].fixture_payments === 3 &&
      result.rows[0].fixture_room_stays === 4,
    housekeepingScenarios:
      result.rows[0].fixture_cleaning_tasks === 3 &&
      result.rows[0].fixture_guest_away_requests === 1,
    fnbScenario:
      result.rows[0].fixture_menu_items === 2 &&
      result.rows[0].fixture_billing_buckets === 4,
    documentProfileReady: result.rows[0].fixture_document_profiles === 1,
    reconciliationClean: result.rows[0].critical_reconciliation === 0,
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed);
  console.log(JSON.stringify({ database: uatDatabaseName, checks }, null, 2));
  if (failed.length > 0) {
    throw new Error(
      `UAT verification failed: ${failed.map(([key]) => key).join(", ")}`,
    );
  }
}

async function prepare() {
  const localEnvironment = await readLocalEnvironment();
  const uatRuntimeEnvironment = {
    ...localEnvironment,
    DATA_ENCRYPTION_KEY:
      localEnvironment.DATA_ENCRYPTION_KEY ??
      randomBytes(32).toString("base64"),
  };
  const targetUrl = await ensureDedicatedDatabase(
    localEnvironment.DATABASE_URL,
  );
  const pool = createDatabasePool(targetUrl, 2);
  try {
    await assertExistingDatabaseIsUat(pool);
    await migrate(pool);
    const credentials = (await readCredentials()) ?? createCredentials();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO properties (id, code, name, address)
         VALUES ($1, 'KOOKA-UAT', 'KOOKA Residence — Synthetic UAT',
                 'Alamat sintetis untuk pengujian; bukan data produksi')
         ON CONFLICT (code) DO NOTHING`,
        [ids.property],
      );
      await seedIdentity(client, credentials);
      await seedOperationalData(client, uatRuntimeEnvironment);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await writeCredentials(credentials);
    await writeUatEnvironment(uatRuntimeEnvironment, targetUrl);
    await verify(pool);
    console.log(`UAT environment: ${uatEnvironmentPath}`);
    console.log(`UAT credentials: ${uatCredentialPath}`);
  } finally {
    await pool.end();
  }
}

async function verifyPrepared() {
  const localEnvironment = await readLocalEnvironment();
  const targetUrl = uatDatabaseUrl(localEnvironment.DATABASE_URL);
  assertLocalUatTarget(targetUrl);
  const pool = createDatabasePool(targetUrl, 1);
  try {
    await verify(pool);
  } finally {
    await pool.end();
  }
}

async function migratePrepared() {
  const localEnvironment = await readLocalEnvironment();
  const targetUrl = uatDatabaseUrl(localEnvironment.DATABASE_URL);
  assertLocalUatTarget(targetUrl);
  const pool = createDatabasePool(targetUrl, 1);
  try {
    await assertExistingDatabaseIsUat(pool);
    await migrate(pool, console.log);
    console.log(`UAT database ${uatDatabaseName} is up to date.`);
  } finally {
    await pool.end();
  }
}

async function reset() {
  if (process.env.ALLOW_UAT_RESET !== "YES") {
    throw new Error("Reset requires ALLOW_UAT_RESET=YES");
  }
  const localEnvironment = await readLocalEnvironment();
  const targetUrl = uatDatabaseUrl(localEnvironment.DATABASE_URL);
  assertLocalUatTarget(targetUrl);
  const targetPool = createDatabasePool(targetUrl, 1);
  try {
    const marker = await targetPool.query(
      "SELECT count(*)::int AS count FROM properties WHERE code='KOOKA-UAT'",
    );
    if (marker.rows[0]?.count !== 1) {
      throw new Error("UAT marker property was not found; reset refused");
    }
  } finally {
    await targetPool.end();
  }
  const adminPool = createDatabasePool(localEnvironment.DATABASE_URL, 1);
  try {
    await adminPool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [uatDatabaseName],
    );
    await adminPool.query(`DROP DATABASE ${quoteIdentifier(uatDatabaseName)}`);
  } finally {
    await adminPool.end();
  }
  console.log(`Removed synthetic database ${uatDatabaseName}.`);
}

async function verifyCleanStart(pool) {
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM reservations) AS reservations,
      (SELECT count(*)::int FROM booking_quotes) AS booking_quotes,
      (SELECT count(*)::int FROM folios) AS folios,
      (SELECT count(*)::int FROM payments) AS payments,
      (SELECT count(*)::int FROM food_orders) AS food_orders,
      (SELECT count(*)::int FROM cleaning_tasks) AS cleaning_tasks,
      (SELECT count(*)::int FROM maintenance_issues) AS maintenance_issues,
      (SELECT count(*)::int FROM room_blocks) AS room_blocks,
      (SELECT count(*)::int FROM inventory_claims) AS inventory_claims,
      (SELECT count(*)::int FROM room_unit_night_claims) AS room_unit_night_claims,
      (SELECT count(*)::int FROM attendance_sessions) AS attendance_sessions,
      (SELECT count(*)::int FROM lost_found_items) AS lost_found_items,
      (SELECT count(*)::int
       FROM room_units room
       JOIN room_unit_states state ON state.room_unit_id = room.id
       WHERE room.property_id = '${ids.property}' AND room.status = 'ACTIVE'
         AND state.occupancy_status = 'VACANT'
         AND state.housekeeping_status = 'INSPECTED'
         AND state.serviceability_status = 'IN_SERVICE') AS ready_rooms,
      (SELECT count(*)::int
       FROM room_units
       WHERE property_id = '${ids.property}' AND status = 'ACTIVE') AS active_rooms,
      (SELECT count(*)::int
       FROM inventory_days
       WHERE property_id = '${ids.property}' AND sales_closed) AS closed_inventory_days
  `);
  const summary = result.rows[0];
  const transactionKeys = [
    "reservations",
    "booking_quotes",
    "folios",
    "payments",
    "food_orders",
    "cleaning_tasks",
    "maintenance_issues",
    "room_blocks",
    "inventory_claims",
    "room_unit_night_claims",
    "attendance_sessions",
    "lost_found_items",
  ];
  const transactionsEmpty = transactionKeys.every((key) => summary[key] === 0);
  const roomsReady =
    summary.active_rooms > 0 && summary.ready_rooms === summary.active_rooms;
  const inventoryOpen = summary.closed_inventory_days === 0;
  const checks = { transactionsEmpty, roomsReady, inventoryOpen };
  console.log(
    JSON.stringify(
      { database: uatDatabaseName, mode: "CLEAN_START", checks, summary },
      null,
      2,
    ),
  );
  const failed = Object.entries(checks).filter(([, passed]) => !passed);
  if (failed.length > 0) {
    throw new Error(
      `UAT clean-start verification failed: ${failed
        .map(([key]) => key)
        .join(", ")}`,
    );
  }
}

async function clean() {
  if (process.env.ALLOW_UAT_RESET !== "YES") {
    throw new Error("Clean start requires ALLOW_UAT_RESET=YES");
  }
  const localEnvironment = await readLocalEnvironment();
  const targetUrl = uatDatabaseUrl(localEnvironment.DATABASE_URL);
  assertLocalUatTarget(targetUrl);
  const pool = createDatabasePool(targetUrl, 1);
  const client = await pool.connect();
  try {
    const marker = await client.query(
      "SELECT count(*)::int AS count FROM properties WHERE code='KOOKA-UAT'",
    );
    if (marker.rows[0]?.count !== 1) {
      throw new Error("UAT marker property was not found; clean start refused");
    }
    await client.query("BEGIN");
    await client.query(`
      TRUNCATE TABLE
        booking_quotes,
        reservations,
        guests,
        folios,
        payments,
        refunds,
        food_orders,
        cleaning_tasks,
        maintenance_issues,
        damage_incidents,
        departure_clearances,
        guest_requests,
        booking_amendments,
        business_day_runs,
        room_blocks,
        inventory_claims,
        room_unit_night_claims,
        resource_claims,
        notification_messages,
        booking_lookup_sessions,
        reconciliation_exceptions,
        report_exports,
        shift_assignments,
        attendance_sessions,
        lost_found_items,
        file_access_events,
        audit_events,
        idempotency_keys,
        outbox_events,
        job_executions,
        security_events,
        document_sequences
      RESTART IDENTITY CASCADE
    `);
    await client.query(`
      INSERT INTO room_unit_states
        (room_unit_id, occupancy_status, housekeeping_status,
         serviceability_status, changed_at)
      SELECT id, 'VACANT', 'INSPECTED', 'IN_SERVICE', now()
      FROM room_units
      WHERE property_id = '${ids.property}'
      ON CONFLICT (room_unit_id) DO UPDATE SET
        occupancy_status = 'VACANT',
        housekeeping_status = 'INSPECTED',
        serviceability_status = 'IN_SERVICE',
        changed_at = now(),
        updated_at = now(),
        version = room_unit_states.version + 1
    `);
    await client.query(`
      UPDATE inventory_days
      SET sales_closed = false, updated_at = now(), version = version + 1
      WHERE property_id = '${ids.property}'
    `);
    await client.query("COMMIT");
    await verifyCleanStart(client);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function rotate() {
  const localEnvironment = await readLocalEnvironment();
  const targetUrl = uatDatabaseUrl(localEnvironment.DATABASE_URL);
  assertLocalUatTarget(targetUrl);
  const pool = createDatabasePool(targetUrl, 1);
  const credentials = createCredentials();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await seedIdentity(client, credentials);
    await client.query(
      `DELETE FROM auth_sessions
       WHERE user_id = ANY($1::uuid[])`,
      [Object.values(ids.users)],
    );
    await client.query("COMMIT");
    await writeCredentials(credentials);
    console.log(`Rotated synthetic UAT credentials: ${uatCredentialPath}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (
  !new Set(["prepare", "migrate", "verify", "reset", "clean", "rotate"]).has(
    command,
  )
) {
  throw new Error(
    "Usage: node scripts/uat.mjs <prepare|migrate|verify|reset|clean|rotate>",
  );
}

await {
  prepare,
  migrate: migratePrepared,
  verify: verifyPrepared,
  reset,
  clean,
  rotate,
}[command]();
