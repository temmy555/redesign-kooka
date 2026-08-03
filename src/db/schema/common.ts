import { sql } from "drizzle-orm";
import {
  date,
  integer,
  jsonb,
  numeric,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const id = (name = "id") =>
  uuid(name).primaryKey().default(sql`uuidv7()`);

export const utcTimestamp = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

export const businessDate = (name: string) => date(name, { mode: "string" });

export const money = (name: string) => numeric(name, { precision: 18, scale: 2 });

export const exchangeRate = (name: string) =>
  numeric(name, { precision: 18, scale: 6 });

export const quantity = (name: string) =>
  numeric(name, { precision: 12, scale: 3 });

export const status = (name = "status") => varchar(name, { length: 48 });

export const locale = (name = "locale") => varchar(name, { length: 8 });

export const currency = (name = "currency") => varchar(name, { length: 3 });

export const metadata = (name = "metadata") =>
  jsonb(name).$type<Record<string, unknown>>();

export const trackedColumns = {
  createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  updatedAt: utcTimestamp("updated_at").notNull().defaultNow(),
  createdByUserId: uuid("created_by_user_id"),
  updatedByUserId: uuid("updated_by_user_id"),
  version: integer("version").notNull().default(1),
};

export const appendOnlyColumns = {
  createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  createdByUserId: uuid("created_by_user_id"),
};
