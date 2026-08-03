import { sql } from "drizzle-orm";
import { check, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { currency, id, locale, status, trackedColumns } from "./common";

export const properties = pgTable(
  "properties",
  {
    id: id(),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    address: text("address"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Jakarta"),
    defaultLocale: locale("default_locale").notNull().default("id"),
    baseCurrency: currency("base_currency").notNull().default("IDR"),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_properties_code").on(table.code),
    uniqueIndex("uq_one_active_property")
      .on(table.status)
      .where(sql`${table.status} = 'ACTIVE'`),
    check("ck_properties_locale", sql`${table.defaultLocale} in ('id', 'en')`),
    check("ck_properties_currency", sql`${table.baseCurrency} = 'IDR'`),
    check("ck_properties_status", sql`${table.status} in ('ACTIVE', 'ARCHIVED')`),
  ],
);
