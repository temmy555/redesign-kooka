CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(160) NOT NULL,
	"address" text,
	"timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
	"default_locale" varchar(8) DEFAULT 'id' NOT NULL,
	"base_currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_properties_locale" CHECK ("properties"."default_locale" in ('id', 'en')),
	CONSTRAINT "ck_properties_currency" CHECK ("properties"."base_currency" = 'IDR'),
	CONSTRAINT "ck_properties_status" CHECK ("properties"."status" in ('ACTIVE', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" varchar(80) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"password_hash" text,
	"credential_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"identifier" varchar(320) NOT NULL,
	"value_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "employee_profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"employee_code" varchar(40) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"employment_status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"default_attendance_mode" varchar(48) DEFAULT 'SHIFT' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_employee_status" CHECK ("employee_profiles"."employment_status" in ('ACTIVE', 'INACTIVE', 'TERMINATED')),
	CONSTRAINT "ck_employee_attendance_mode" CHECK ("employee_profiles"."default_attendance_mode" in ('SHIFT', 'FREE'))
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"code" varchar(120) NOT NULL,
	"module" varchar(64) NOT NULL,
	"description" text,
	"sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"system_role" boolean DEFAULT false NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"granted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "user_roles_user_id_role_id_property_id_effective_from_pk" PRIMARY KEY("user_id","role_id","property_id","effective_from"),
	CONSTRAINT "ck_user_roles_period" CHECK ("user_roles"."effective_to" is null or "user_roles"."effective_to" > "user_roles"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_normalized" varchar(320) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"locale" varchar(8) DEFAULT 'id' NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"last_login_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_users_locale" CHECK ("users"."locale" in ('id', 'en')),
	CONSTRAINT "ck_users_status" CHECK ("users"."status" in ('ACTIVE', 'SUSPENDED', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid,
	"actor_user_id" uuid,
	"actor_type" varchar(24) NOT NULL,
	"action" varchar(120) NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" uuid,
	"before_json" jsonb,
	"after_json" jsonb,
	"reason" text,
	"result" varchar(48) NOT NULL,
	"request_id" varchar(100),
	"correlation_id" varchar(100),
	"ip_address" varchar(64),
	"device_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "file_access_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"file_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(40) NOT NULL,
	"result" varchar(48) NOT NULL,
	"reason" text,
	"request_id" varchar(100),
	"ip_address" varchar(64),
	"device_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"scope" varchar(100) NOT NULL,
	"key" varchar(160) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"owner_user_id" uuid,
	"status" varchar(48) DEFAULT 'PROCESSING' NOT NULL,
	"result_type" varchar(80),
	"result_id" uuid,
	"response_snapshot" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "ck_idempotency_status" CHECK ("idempotency_keys"."status" in ('PROCESSING', 'COMPLETED', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "job_executions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"job_name" varchar(120) NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"status" varchar(48) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"checkpoint" jsonb,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"topic" varchar(120) NOT NULL,
	"aggregate_type" varchar(80) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(48) DEFAULT 'PENDING' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(120),
	"attempts" bigint DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid,
	"actor_user_id" uuid,
	"category" varchar(80) NOT NULL,
	"severity" varchar(48) NOT NULL,
	"result" varchar(48) NOT NULL,
	"review_status" varchar(48) DEFAULT 'OPEN' NOT NULL,
	"target_type" varchar(80),
	"target_id" uuid,
	"details" jsonb,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "stored_files" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"original_name" varchar(255),
	"mime_type" varchar(160) NOT NULL,
	"byte_size" bigint NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"classification" varchar(48) NOT NULL,
	"purpose" varchar(80) NOT NULL,
	"scan_status" varchar(48) DEFAULT 'PENDING' NOT NULL,
	"retention_category" varchar(80) NOT NULL,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_stored_files_size" CHECK ("stored_files"."byte_size" >= 0),
	CONSTRAINT "ck_stored_files_scan" CHECK ("stored_files"."scan_status" in ('PENDING', 'CLEAN', 'REJECTED', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "document_profile_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"document_profile_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"address" text NOT NULL,
	"contact" text,
	"tax_identity_ciphertext" text,
	"logo_file_id" uuid,
	"footer_id" text,
	"footer_en" text,
	"template_reference" varchar(160) NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"approved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_document_profile_period" CHECK ("document_profile_versions"."effective_to" is null or "document_profile_versions"."effective_to" > "document_profile_versions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "document_profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_sequences" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"document_type" varchar(40) NOT NULL,
	"period_key" varchar(20) NOT NULL,
	"prefix" varchar(40) NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	"padding" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_document_sequence_positive" CHECK ("document_sequences"."next_value" > 0 and "document_sequences"."padding" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "exchange_rate_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"base_currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"quote_currency" varchar(3) NOT NULL,
	"rate" numeric(18, 6) NOT NULL,
	"source" varchar(120) NOT NULL,
	"as_of_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rounding_rule" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_exchange_base" CHECK ("exchange_rate_snapshots"."base_currency" = 'IDR'),
	CONSTRAINT "ck_exchange_quote" CHECK ("exchange_rate_snapshots"."quote_currency" in ('USD', 'AUD')),
	CONSTRAINT "ck_exchange_rate_positive" CHECK ("exchange_rate_snapshots"."rate" > 0 and "exchange_rate_snapshots"."expires_at" > "exchange_rate_snapshots"."as_of_at")
);
--> statement-breakpoint
CREATE TABLE "payment_instruction_sets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_instruction_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"instruction_set_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"bank_name" varchar(120) NOT NULL,
	"account_holder" varchar(160) NOT NULL,
	"account_number_ciphertext" text NOT NULL,
	"account_number_last4" varchar(4) NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"instruction_id" text NOT NULL,
	"instruction_en" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"approved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_payment_instruction_currency" CHECK ("payment_instruction_versions"."currency" = 'IDR'),
	CONSTRAINT "ck_payment_instruction_period" CHECK ("payment_instruction_versions"."effective_to" is null or "payment_instruction_versions"."effective_to" > "payment_instruction_versions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "policy_sets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"policy_type" varchar(48) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"policy_set_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"approval_status" varchar(48) DEFAULT 'PENDING' NOT NULL,
	"title_id" varchar(200) NOT NULL,
	"title_en" varchar(200) NOT NULL,
	"summary_id" text,
	"summary_en" text,
	"content_id" text NOT NULL,
	"content_en" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"checksum" varchar(64) NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_policy_versions_period" CHECK ("policy_versions"."effective_to" is null or "policy_versions"."effective_to" > "policy_versions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "property_setting_sets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_setting_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"setting_set_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"approval_status" varchar(48) DEFAULT 'NOT_REQUIRED' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"values" jsonb NOT NULL,
	"reason" text,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_property_setting_period" CHECK ("property_setting_versions"."effective_to" is null or "property_setting_versions"."effective_to" > "property_setting_versions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "tax_profile_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tax_profile_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"tax_rate" numeric(18, 6) DEFAULT '0' NOT NULL,
	"service_charge_rate" numeric(18, 6) DEFAULT '0' NOT NULL,
	"tax_inclusive" boolean DEFAULT false NOT NULL,
	"service_charge_inclusive" boolean DEFAULT false NOT NULL,
	"no_tax" boolean DEFAULT false NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"approved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_tax_profile_rates" CHECK ("tax_profile_versions"."tax_rate" >= 0 and "tax_profile_versions"."service_charge_rate" >= 0),
	CONSTRAINT "ck_tax_profile_period" CHECK ("tax_profile_versions"."effective_to" is null or "tax_profile_versions"."effective_to" > "tax_profile_versions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "tax_profiles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"domain" varchar(48) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"icon_key" varchar(80),
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amenity_translations" (
	"amenity_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "amenity_translations_amenity_id_locale_pk" PRIMARY KEY("amenity_id","locale"),
	CONSTRAINT "ck_amenity_translation_locale" CHECK ("amenity_translations"."locale" in ('id', 'en'))
);
--> statement-breakpoint
CREATE TABLE "rate_plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"rate_plan_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"name_id" varchar(160) NOT NULL,
	"name_en" varchar(160) NOT NULL,
	"source_eligibility" varchar(80) DEFAULT 'ALL' NOT NULL,
	"payment_instruction_set_id" uuid,
	"cancellation_policy_set_id" uuid,
	"tax_profile_id" uuid,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_rate_plan_version_period" CHECK ("rate_plan_versions"."effective_to" is null or "rate_plan_versions"."effective_to" > "rate_plan_versions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "rate_plans" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_rule_dates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"rate_rule_id" uuid NOT NULL,
	"stay_date" date NOT NULL,
	"nightly_rate_idr" numeric(18, 2) NOT NULL,
	"sales_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_rate_rule_date_amount" CHECK ("rate_rule_dates"."nightly_rate_idr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_rules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"rate_plan_version_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"weekdays_mask" integer DEFAULT 127 NOT NULL,
	"nightly_rate_idr" numeric(18, 2) NOT NULL,
	"minimum_stay" integer DEFAULT 1 NOT NULL,
	"maximum_stay" integer,
	"closed_to_arrival" boolean DEFAULT false NOT NULL,
	"closed_to_departure" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_rate_rule_dates" CHECK ("rate_rules"."ends_on" >= "rate_rules"."starts_on"),
	CONSTRAINT "ck_rate_rule_amount" CHECK ("rate_rules"."nightly_rate_idr" >= 0),
	CONSTRAINT "ck_rate_rule_stay" CHECK ("rate_rules"."minimum_stay" > 0 and ("rate_rules"."maximum_stay" is null or "rate_rules"."maximum_stay" >= "rate_rules"."minimum_stay")),
	CONSTRAINT "ck_rate_rule_weekdays" CHECK ("rate_rules"."weekdays_mask" between 1 and 127)
);
--> statement-breakpoint
CREATE TABLE "resource_pools" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name_id" varchar(160) NOT NULL,
	"name_en" varchar(160) NOT NULL,
	"inventory_tracked" boolean DEFAULT true NOT NULL,
	"physical_capacity" integer NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_resource_pool_capacity" CHECK ("resource_pools"."physical_capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "room_type_amenities" (
	"room_type_version_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "room_type_amenities_room_type_version_id_amenity_id_pk" PRIMARY KEY("room_type_version_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "room_type_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_type_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"name_id" varchar(160) NOT NULL,
	"name_en" varchar(160) NOT NULL,
	"description_id" text,
	"description_en" text,
	"bed_configuration" varchar(160),
	"standard_adults" integer DEFAULT 1 NOT NULL,
	"maximum_adults" integer NOT NULL,
	"maximum_children" integer DEFAULT 0 NOT NULL,
	"maximum_total_guests" integer NOT NULL,
	"extra_bed_allowed" boolean DEFAULT false NOT NULL,
	"maximum_extra_beds" integer DEFAULT 0 NOT NULL,
	"extra_bed_capacity_increment" integer DEFAULT 0 NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_room_type_capacity" CHECK ("room_type_versions"."standard_adults" >= 0 and "room_type_versions"."maximum_adults" >= "room_type_versions"."standard_adults" and "room_type_versions"."maximum_children" >= 0 and "room_type_versions"."maximum_total_guests" > 0),
	CONSTRAINT "ck_room_type_extra_bed" CHECK ("room_type_versions"."maximum_extra_beds" >= 0 and "room_type_versions"."extra_bed_capacity_increment" >= 0 and ("room_type_versions"."extra_bed_allowed" or "room_type_versions"."maximum_extra_beds" = 0)),
	CONSTRAINT "ck_room_type_version_period" CHECK ("room_type_versions"."effective_to" is null or "room_type_versions"."effective_to" > "room_type_versions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "room_types" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_room_types_status" CHECK ("room_types"."status" in ('ACTIVE', 'INACTIVE', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE "room_unit_amenity_overrides" (
	"room_unit_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	"available" boolean NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "room_unit_amenity_overrides_room_unit_id_amenity_id_pk" PRIMARY KEY("room_unit_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "room_unit_states" (
	"room_unit_id" uuid PRIMARY KEY NOT NULL,
	"occupancy_status" varchar(48) DEFAULT 'VACANT' NOT NULL,
	"housekeeping_status" varchar(48) DEFAULT 'DIRTY' NOT NULL,
	"serviceability_status" varchar(48) DEFAULT 'IN_SERVICE' NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_room_occupancy_status" CHECK ("room_unit_states"."occupancy_status" in ('VACANT', 'OCCUPIED')),
	CONSTRAINT "ck_room_housekeeping_status" CHECK ("room_unit_states"."housekeeping_status" in ('DIRTY', 'CLEANING', 'CLEANED', 'INSPECTED')),
	CONSTRAINT "ck_room_serviceability_status" CHECK ("room_unit_states"."serviceability_status" in ('IN_SERVICE', 'BLOCKED', 'OUT_OF_ORDER'))
);
--> statement-breakpoint
CREATE TABLE "room_unit_type_periods" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_unit_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_room_unit_type_period" CHECK ("room_unit_type_periods"."effective_to" is null or "room_unit_type_periods"."effective_to" > "room_unit_type_periods"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "room_units" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_number" varchar(32) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"floor_or_area" varchar(80),
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_room_units_status" CHECK ("room_units"."status" in ('ACTIVE', 'INACTIVE', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE "booking_lookup_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"matched_email_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "booking_quote_nights" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"quote_room_id" uuid NOT NULL,
	"stay_date" date NOT NULL,
	"rate_rule_id" uuid,
	"room_rate_idr" numeric(18, 2) NOT NULL,
	"discount_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"service_charge_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_idr" numeric(18, 2) NOT NULL,
	"tax_snapshot" jsonb,
	"price_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_booking_quote_night_amounts" CHECK ("booking_quote_nights"."room_rate_idr" >= 0 and "booking_quote_nights"."discount_idr" >= 0 and "booking_quote_nights"."tax_idr" >= 0 and "booking_quote_nights"."service_charge_idr" >= 0 and "booking_quote_nights"."total_idr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "booking_quote_rooms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"quote_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"rate_plan_version_id" uuid NOT NULL,
	"check_in_date" date NOT NULL,
	"checkout_date" date NOT NULL,
	"adults" integer NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"infants" integer DEFAULT 0 NOT NULL,
	"extra_bed_quantity" integer DEFAULT 0 NOT NULL,
	"total_idr" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_quote_room_dates" CHECK ("booking_quote_rooms"."checkout_date" > "booking_quote_rooms"."check_in_date"),
	CONSTRAINT "ck_quote_room_guests" CHECK ("booking_quote_rooms"."adults" > 0 and "booking_quote_rooms"."children" >= 0 and "booking_quote_rooms"."infants" >= 0 and "booking_quote_rooms"."extra_bed_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "booking_quotes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"language" varchar(8) DEFAULT 'id' NOT NULL,
	"display_currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"exchange_rate_snapshot_id" uuid,
	"total_idr" numeric(18, 2) NOT NULL,
	"display_total" numeric(18, 2),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_booking_quote_language" CHECK ("booking_quotes"."language" in ('id', 'en')),
	CONSTRAINT "ck_booking_quote_currency" CHECK ("booking_quotes"."display_currency" in ('IDR', 'USD', 'AUD')),
	CONSTRAINT "ck_booking_quote_total" CHECK ("booking_quotes"."total_idr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"email" varchar(320),
	"phone" varchar(40),
	"nationality_code" varchar(3),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_claim_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"inventory_claim_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"reason" text,
	"correlation_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "inventory_claims" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"inventory_day_id" uuid NOT NULL,
	"claim_type" varchar(48) NOT NULL,
	"claim_status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"source_id" uuid NOT NULL,
	"reservation_room_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_inventory_claim_type" CHECK ("inventory_claims"."claim_type" in ('CHECKOUT_HOLD', 'PAYMENT_HOLD', 'COMMITTED', 'BLOCKED', 'WHOLE_HOUSE')),
	CONSTRAINT "ck_inventory_claim_status" CHECK ("inventory_claims"."claim_status" in ('ACTIVE', 'RELEASED', 'EXPIRED')),
	CONSTRAINT "ck_inventory_claim_quantity" CHECK ("inventory_claims"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_days" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"stay_date" date NOT NULL,
	"physical_capacity" integer NOT NULL,
	"sales_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_inventory_day_capacity" CHECK ("inventory_days"."physical_capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reservation_addons" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_room_id" uuid NOT NULL,
	"resource_pool_id" uuid,
	"addon_type" varchar(64) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"charge_basis" varchar(32) NOT NULL,
	"unit_price_idr" numeric(18, 2) NOT NULL,
	"total_idr" numeric(18, 2) NOT NULL,
	"tax_snapshot" jsonb,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_reservation_addon_amount" CHECK ("reservation_addons"."quantity" > 0 and "reservation_addons"."unit_price_idr" >= 0 and "reservation_addons"."total_idr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reservation_guests" (
	"reservation_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"role" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "reservation_guests_reservation_id_guest_id_role_pk" PRIMARY KEY("reservation_id","guest_id","role"),
	CONSTRAINT "ck_reservation_guest_role" CHECK ("reservation_guests"."role" in ('BOOKER', 'GUEST', 'PAYER', 'INVOICE_RECIPIENT'))
);
--> statement-breakpoint
CREATE TABLE "reservation_room_nights" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_room_id" uuid NOT NULL,
	"stay_date" date NOT NULL,
	"room_rate_idr" numeric(18, 2) NOT NULL,
	"discount_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"service_charge_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_idr" numeric(18, 2) NOT NULL,
	"tax_profile_version_id" uuid,
	"price_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_reservation_night_amounts" CHECK ("reservation_room_nights"."room_rate_idr" >= 0 and "reservation_room_nights"."discount_idr" >= 0 and "reservation_room_nights"."tax_idr" >= 0 and "reservation_room_nights"."service_charge_idr" >= 0 and "reservation_room_nights"."total_idr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reservation_rooms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"booked_room_type_id" uuid NOT NULL,
	"fulfilled_room_type_id" uuid NOT NULL,
	"rate_plan_version_id" uuid NOT NULL,
	"check_in_date" date NOT NULL,
	"checkout_date" date NOT NULL,
	"adults" integer NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"infants" integer DEFAULT 0 NOT NULL,
	"extra_bed_quantity" integer DEFAULT 0 NOT NULL,
	"line_status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_reservation_room_dates" CHECK ("reservation_rooms"."checkout_date" > "reservation_rooms"."check_in_date"),
	CONSTRAINT "ck_reservation_room_guests" CHECK ("reservation_rooms"."adults" > 0 and "reservation_rooms"."children" >= 0 and "reservation_rooms"."infants" >= 0 and "reservation_rooms"."extra_bed_quantity" >= 0),
	CONSTRAINT "ck_reservation_room_status" CHECK ("reservation_rooms"."line_status" in ('ACTIVE', 'CANCELLED', 'COMPLETED'))
);
--> statement-breakpoint
CREATE TABLE "reservation_status_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"action" varchar(80) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"actor_user_id" uuid,
	"reason" text,
	"guard_result" jsonb,
	"correlation_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"booking_code" varchar(24) NOT NULL,
	"source" varchar(40) NOT NULL,
	"status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"booker_name" varchar(160) NOT NULL,
	"booker_email" varchar(320) NOT NULL,
	"booker_email_normalized" varchar(320) NOT NULL,
	"booker_phone" varchar(40),
	"language" varchar(8) DEFAULT 'id' NOT NULL,
	"display_currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"official_currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"exchange_rate" numeric(18, 6),
	"exchange_rate_snapshot_id" uuid,
	"quote_id" uuid,
	"payment_instruction_version_id" uuid,
	"cancellation_policy_version_id" uuid,
	"house_rules_version_id" uuid,
	"payment_deadline_at" timestamp with time zone,
	"guaranteed" boolean DEFAULT false NOT NULL,
	"internal_notes" text,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_reservation_status" CHECK ("reservations"."status" in ('DRAFT', 'ON_HOLD', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW')),
	CONSTRAINT "ck_reservation_source" CHECK ("reservations"."source" in ('ONLINE', 'ADMIN_MANUAL', 'OPENING')),
	CONSTRAINT "ck_reservation_language" CHECK ("reservations"."language" in ('id', 'en')),
	CONSTRAINT "ck_reservation_currencies" CHECK ("reservations"."display_currency" in ('IDR', 'USD', 'AUD') and "reservations"."official_currency" = 'IDR')
);
--> statement-breakpoint
CREATE TABLE "resource_claims" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"resource_inventory_day_id" uuid NOT NULL,
	"reservation_room_id" uuid NOT NULL,
	"claim_status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"quantity" integer NOT NULL,
	"expires_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_resource_claim_quantity" CHECK ("resource_claims"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "resource_inventory_days" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"resource_pool_id" uuid NOT NULL,
	"stay_date" date NOT NULL,
	"physical_capacity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_resource_inventory_capacity" CHECK ("resource_inventory_days"."physical_capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "room_assignment_nights" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_assignment_id" uuid NOT NULL,
	"room_unit_night_claim_id" uuid NOT NULL,
	"room_unit_id" uuid NOT NULL,
	"stay_date" date NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "room_assignments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_stay_id" uuid NOT NULL,
	"room_unit_id" uuid NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"assigned_by_user_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_room_assignment_period" CHECK ("room_assignments"."effective_to" is null or "room_assignments"."effective_to" > "room_assignments"."effective_from"),
	CONSTRAINT "ck_room_assignment_status" CHECK ("room_assignments"."status" in ('PLANNED', 'ACTIVE', 'RELEASED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "room_block_nights" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_block_id" uuid NOT NULL,
	"room_unit_night_claim_id" uuid NOT NULL,
	"room_unit_id" uuid NOT NULL,
	"stay_date" date NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "room_blocks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_unit_id" uuid NOT NULL,
	"block_type" varchar(48) NOT NULL,
	"status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"source_type" varchar(64),
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_room_block_period" CHECK ("room_blocks"."ends_at" > "room_blocks"."starts_at"),
	CONSTRAINT "ck_room_block_status" CHECK ("room_blocks"."status" in ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "room_move_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_move_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"guard_result" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "room_moves" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_stay_id" uuid NOT NULL,
	"from_assignment_id" uuid NOT NULL,
	"to_assignment_id" uuid,
	"status" varchar(48) DEFAULT 'PREPARED' NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"price_treatment" varchar(48) DEFAULT 'NO_CHANGE' NOT NULL,
	"price_adjustment_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"incidental_no_charge" boolean DEFAULT false NOT NULL,
	"requested_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_room_move_status" CHECK ("room_moves"."status" in ('PREPARED', 'APPLIED', 'REJECTED', 'CANCELLED')),
	CONSTRAINT "ck_room_move_price_treatment" CHECK ("room_moves"."price_treatment" in ('NO_CHANGE', 'CHARGE', 'CREDIT'))
);
--> statement-breakpoint
CREATE TABLE "room_stay_guests" (
	"room_stay_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"occupancy_starts_at" timestamp with time zone,
	"occupancy_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "room_stay_guests_room_stay_id_guest_id_pk" PRIMARY KEY("room_stay_id","guest_id"),
	CONSTRAINT "ck_room_stay_guest_period" CHECK ("room_stay_guests"."occupancy_ends_at" is null or "room_stay_guests"."occupancy_starts_at" is null or "room_stay_guests"."occupancy_ends_at" > "room_stay_guests"."occupancy_starts_at")
);
--> statement-breakpoint
CREATE TABLE "room_stays" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_room_id" uuid NOT NULL,
	"status" varchar(48) DEFAULT 'NOT_STARTED' NOT NULL,
	"lead_guest_id" uuid,
	"planned_arrival_at" timestamp with time zone,
	"planned_departure_at" timestamp with time zone,
	"actual_check_in_at" timestamp with time zone,
	"actual_check_out_at" timestamp with time zone,
	"early_check_in_approved_at" timestamp with time zone,
	"late_checkout_approved_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_room_stay_status" CHECK ("room_stays"."status" in ('NOT_STARTED', 'DUE_IN', 'IN_HOUSE', 'DUE_OUT', 'CHECKED_OUT', 'NO_SHOW'))
);
--> statement-breakpoint
CREATE TABLE "room_unit_night_claims" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_unit_id" uuid NOT NULL,
	"stay_date" date NOT NULL,
	"claim_type" varchar(48) NOT NULL,
	"source_id" uuid NOT NULL,
	"claim_status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "ck_room_unit_night_claim_type" CHECK ("room_unit_night_claims"."claim_type" in ('ASSIGNMENT', 'BLOCK')),
	CONSTRAINT "ck_room_unit_night_claim_status" CHECK ("room_unit_night_claims"."claim_status" in ('ACTIVE', 'RELEASED'))
);
--> statement-breakpoint
CREATE TABLE "stay_status_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_stay_id" uuid NOT NULL,
	"action" varchar(80) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"actor_user_id" uuid,
	"reason" text,
	"guard_result" jsonb,
	"correlation_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "document_entry_coverage" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"document_version_id" uuid NOT NULL,
	"folio_entry_id" uuid NOT NULL,
	"covered_amount_idr" numeric(18, 2) NOT NULL,
	"active_final_coverage" varchar(48) DEFAULT 'NO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "ck_document_entry_coverage_amount" CHECK ("document_entry_coverage"."covered_amount_idr" >= 0),
	CONSTRAINT "ck_document_entry_final" CHECK ("document_entry_coverage"."active_final_coverage" in ('YES', 'NO'))
);
--> statement-breakpoint
CREATE TABLE "financial_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"document_profile_version_id" uuid NOT NULL,
	"rendered_file_id" uuid,
	"subtotal_idr" numeric(18, 2) NOT NULL,
	"discount_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"service_charge_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_idr" numeric(18, 2) NOT NULL,
	"rendered_snapshot" jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_financial_document_version_amounts" CHECK ("financial_document_versions"."subtotal_idr" >= 0 and "financial_document_versions"."discount_idr" >= 0 and "financial_document_versions"."service_charge_idr" >= 0 and "financial_document_versions"."tax_idr" >= 0 and "financial_document_versions"."total_idr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "financial_documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"folio_id" uuid NOT NULL,
	"document_type" varchar(40) NOT NULL,
	"document_number" varchar(80),
	"status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"recipient_name" varchar(200) NOT NULL,
	"recipient_email" varchar(320),
	"language" varchar(8) DEFAULT 'id' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"issued_at" timestamp with time zone,
	"issued_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_financial_document_type" CHECK ("financial_documents"."document_type" in ('PROFORMA', 'INVOICE', 'RECEIPT', 'REFUND_NOTE', 'FOLIO_STATEMENT')),
	CONSTRAINT "ck_financial_document_status" CHECK ("financial_documents"."status" in ('DRAFT', 'ISSUED', 'VOIDED', 'SUPERSEDED')),
	CONSTRAINT "ck_financial_document_language" CHECK ("financial_documents"."language" in ('id', 'en') and "financial_documents"."currency" = 'IDR')
);
--> statement-breakpoint
CREATE TABLE "folio_billing_buckets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"folio_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"payer_guest_id" uuid,
	"billing_details" jsonb,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folio_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"folio_id" uuid NOT NULL,
	"billing_bucket_id" uuid,
	"entry_type" varchar(16) NOT NULL,
	"category" varchar(64) NOT NULL,
	"description" varchar(255) NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"source_id" uuid NOT NULL,
	"source_line_id" uuid,
	"reservation_room_id" uuid,
	"room_unit_id" uuid,
	"guest_id" uuid,
	"service_date" date NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit_amount_idr" numeric(18, 2) NOT NULL,
	"net_amount_idr" numeric(18, 2) NOT NULL,
	"discount_amount_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"service_charge_amount_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount_idr" numeric(18, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"tax_profile_version_id" uuid,
	"pricing_snapshot" jsonb NOT NULL,
	"reversal_of_entry_id" uuid,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_by_user_id" uuid,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "ck_folio_entry_type" CHECK ("folio_entries"."entry_type" in ('DEBIT', 'CREDIT')),
	CONSTRAINT "ck_folio_entry_currency" CHECK ("folio_entries"."currency" = 'IDR'),
	CONSTRAINT "ck_folio_entry_quantity" CHECK ("folio_entries"."quantity" > 0),
	CONSTRAINT "ck_folio_entry_amounts" CHECK ("folio_entries"."unit_amount_idr" >= 0 and "folio_entries"."net_amount_idr" >= 0 and "folio_entries"."discount_amount_idr" >= 0 and "folio_entries"."service_charge_amount_idr" >= 0 and "folio_entries"."tax_amount_idr" >= 0 and "folio_entries"."total_amount_idr" >= 0),
	CONSTRAINT "ck_folio_entry_not_self_reversal" CHECK ("folio_entries"."reversal_of_entry_id" is null or "folio_entries"."reversal_of_entry_id" <> "folio_entries"."id")
);
--> statement-breakpoint
CREATE TABLE "folio_status_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"folio_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"reason" text,
	"guard_result" jsonb,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "folios" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" varchar(48) DEFAULT 'OPEN' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_folio_currency" CHECK ("folios"."currency" = 'IDR'),
	CONSTRAINT "ck_folio_status" CHECK ("folios"."status" in ('OPEN', 'CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"payment_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"amount_idr" numeric(18, 2) NOT NULL,
	"allocated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"allocated_by_user_id" uuid,
	"reversal_of_allocation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "ck_payment_allocation_amount" CHECK ("payment_allocations"."amount_idr" > 0),
	CONSTRAINT "ck_payment_allocation_not_self" CHECK ("payment_allocations"."reversal_of_allocation_id" is null or "payment_allocations"."reversal_of_allocation_id" <> "payment_allocations"."id")
);
--> statement-breakpoint
CREATE TABLE "payment_proofs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"payment_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"submitted_via" varchar(40) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payment_status_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"payment_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"reason" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"folio_id" uuid NOT NULL,
	"payment_code" varchar(32) NOT NULL,
	"method" varchar(40) NOT NULL,
	"amount_idr" numeric(18, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" varchar(48) DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"received_at" timestamp with time zone,
	"reference" varchar(160),
	"payment_instruction_version_id" uuid,
	"destination_snapshot" jsonb,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" uuid,
	"folio_entry_id" uuid,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_payment_amount" CHECK ("payments"."amount_idr" > 0 and "payments"."currency" = 'IDR'),
	CONSTRAINT "ck_payment_status" CHECK ("payments"."status" in ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'VOIDED')),
	CONSTRAINT "ck_payment_method" CHECK ("payments"."method" in ('BANK_TRANSFER', 'CASH', 'PAY_AT_CHECKIN', 'PAY_AT_CHECKOUT', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "refund_attempts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"refund_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"processor_user_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"result" varchar(48) NOT NULL,
	"transfer_reference" varchar(160),
	"proof_file_id" uuid,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "ck_refund_attempt_number" CHECK ("refund_attempts"."attempt_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "refund_status_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"refund_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"reason" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"folio_id" uuid NOT NULL,
	"refund_code" varchar(32) NOT NULL,
	"amount_idr" numeric(18, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" varchar(48) DEFAULT 'REQUESTED' NOT NULL,
	"reason" text NOT NULL,
	"policy_snapshot" jsonb,
	"destination_ciphertext" text NOT NULL,
	"destination_last4" varchar(4),
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"refunded_at" timestamp with time zone,
	"folio_entry_id" uuid,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_refund_amount" CHECK ("refunds"."amount_idr" > 0 and "refunds"."currency" = 'IDR'),
	CONSTRAINT "ck_refund_status" CHECK ("refunds"."status" in ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'REFUNDED', 'FAILED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "booking_amendment_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"amendment_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"guard_result" jsonb,
	"notes" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "booking_amendments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"amendment_type" varchar(64) NOT NULL,
	"status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"target_reservation_room_id" uuid,
	"before_snapshot" jsonb NOT NULL,
	"proposed_snapshot" jsonb NOT NULL,
	"delta_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"guest_confirmation_evidence" jsonb,
	"reason" text NOT NULL,
	"applied_at" timestamp with time zone,
	"applied_by_user_id" uuid,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_booking_amendment_status" CHECK ("booking_amendments"."status" in ('DRAFT', 'PENDING_GUEST_CONFIRMATION', 'APPLIED', 'REJECTED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "business_day_runs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"run_type" varchar(48) NOT NULL,
	"status" varchar(48) DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"summary" jsonb,
	"error" text,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "checkin_capture_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"registration_id" uuid NOT NULL,
	"guest_id" uuid,
	"capture_type" varchar(48) NOT NULL,
	"outcome" varchar(48) NOT NULL,
	"file_id" uuid,
	"captured_at" timestamp with time zone,
	"decline_or_skip_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_checkin_capture_type" CHECK ("checkin_capture_items"."capture_type" in ('IDENTITY_DOCUMENT', 'GUEST_PHOTO', 'SIGNATURE')),
	CONSTRAINT "ck_checkin_capture_outcome" CHECK ("checkin_capture_items"."outcome" in ('CAPTURED', 'DECLINED', 'SKIPPED', 'FAILED')),
	CONSTRAINT "ck_checkin_capture_file" CHECK (("checkin_capture_items"."outcome" = 'CAPTURED' and "checkin_capture_items"."file_id" is not null) or ("checkin_capture_items"."outcome" <> 'CAPTURED'))
);
--> statement-breakpoint
CREATE TABLE "checkin_registrations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_stay_id" uuid NOT NULL,
	"status" varchar(48) DEFAULT 'NOT_STARTED' NOT NULL,
	"purpose_policy_version_id" uuid,
	"operated_by_user_id" uuid,
	"completed_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_checkin_registration_status" CHECK ("checkin_registrations"."status" in ('NOT_STARTED', 'PARTIAL', 'COMPLETE', 'SKIPPED'))
);
--> statement-breakpoint
CREATE TABLE "cleaning_task_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"cleaning_task_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"reason_code" varchar(64),
	"reason" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "cleaning_tasks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_unit_id" uuid,
	"room_stay_id" uuid,
	"room_move_id" uuid,
	"public_area" varchar(120),
	"task_type" varchar(64) NOT NULL,
	"priority" varchar(48) DEFAULT 'NORMAL' NOT NULL,
	"status" varchar(48) DEFAULT 'REQUESTED' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"target_at" timestamp with time zone,
	"requested_entry_permission" varchar(48),
	"assignee_employee_id" uuid,
	"notes" text,
	"completed_at" timestamp with time zone,
	"inspected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_cleaning_task_target" CHECK ("cleaning_tasks"."room_unit_id" is not null or "cleaning_tasks"."public_area" is not null),
	CONSTRAINT "ck_cleaning_task_status" CHECK ("cleaning_tasks"."status" in ('REQUESTED', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'INSPECTED', 'DEFERRED', 'UNABLE_TO_ACCESS', 'CANCELLED')),
	CONSTRAINT "ck_cleaning_priority" CHECK ("cleaning_tasks"."priority" in ('LOW', 'NORMAL', 'HIGH', 'URGENT'))
);
--> statement-breakpoint
CREATE TABLE "damage_assessments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"incident_id" uuid NOT NULL,
	"decision" varchar(48) NOT NULL,
	"amount_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"reason" text NOT NULL,
	"price_tax_snapshot" jsonb,
	"decided_by_user_id" uuid NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	"folio_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_damage_assessment_decision" CHECK ("damage_assessments"."decision" in ('APPROVED', 'WAIVED', 'DISPUTED')),
	CONSTRAINT "ck_damage_assessment_amount" CHECK ("damage_assessments"."amount_idr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "damage_catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "damage_catalog_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"damage_catalog_item_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"reference_price_idr" numeric(18, 2) NOT NULL,
	"tax_profile_version_id" uuid,
	"evidence_rule" text,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_damage_catalog_price" CHECK ("damage_catalog_versions"."reference_price_idr" >= 0),
	CONSTRAINT "ck_damage_catalog_period" CHECK ("damage_catalog_versions"."effective_to" is null or "damage_catalog_versions"."effective_to" > "damage_catalog_versions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "damage_incident_evidence" (
	"incident_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "damage_incidents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"room_stay_id" uuid,
	"room_unit_id" uuid,
	"damage_catalog_version_id" uuid,
	"status" varchar(48) DEFAULT 'REPORTED' NOT NULL,
	"description" text NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departure_clearance_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"departure_clearance_id" uuid NOT NULL,
	"item_code" varchar(80) NOT NULL,
	"result" varchar(48) NOT NULL,
	"notes" text,
	"source_type" varchar(64),
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departure_clearances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_stay_id" uuid NOT NULL,
	"outcome" varchar(48) NOT NULL,
	"checked_by_user_id" uuid,
	"checked_at" timestamp with time zone,
	"skip_or_issue_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_departure_clearance_outcome" CHECK ("departure_clearances"."outcome" in ('NOT_STARTED', 'CLEARED', 'ISSUE_FOUND', 'SKIPPED'))
);
--> statement-breakpoint
CREATE TABLE "guest_identity_details" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"registration_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"identity_type" varchar(40),
	"identity_number_ciphertext" text,
	"identity_number_last4" varchar(4),
	"name_on_identity_ciphertext" text,
	"expires_on_ciphertext" text,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_request_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"guest_request_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"notes" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "guest_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"reservation_room_id" uuid,
	"guest_id" uuid,
	"category" varchar(64) NOT NULL,
	"status" varchar(48) DEFAULT 'REQUESTED' NOT NULL,
	"description" text NOT NULL,
	"not_guaranteed" boolean DEFAULT true NOT NULL,
	"target_at" timestamp with time zone,
	"routed_source_type" varchar(64),
	"routed_source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_guest_request_status" CHECK ("guest_requests"."status" in ('REQUESTED', 'UNDER_REVIEW', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "maintenance_issue_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"maintenance_issue_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"notes" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "maintenance_issues" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_unit_id" uuid,
	"public_area" varchar(120),
	"category" varchar(64) NOT NULL,
	"severity" varchar(48) NOT NULL,
	"status" varchar(48) DEFAULT 'REPORTED' NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"serviceability_impact" varchar(48) DEFAULT 'NONE' NOT NULL,
	"reported_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_maintenance_target" CHECK ("maintenance_issues"."room_unit_id" is not null or "maintenance_issues"."public_area" is not null),
	CONSTRAINT "ck_maintenance_status" CHECK ("maintenance_issues"."status" in ('REPORTED', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'REOPENED', 'CANCELLED')),
	CONSTRAINT "ck_maintenance_impact" CHECK ("maintenance_issues"."serviceability_impact" in ('NONE', 'BLOCKED', 'OUT_OF_ORDER'))
);
--> statement-breakpoint
CREATE TABLE "policy_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"room_stay_id" uuid,
	"guest_id" uuid,
	"policy_version_id" uuid NOT NULL,
	"language" varchar(8) NOT NULL,
	"channel" varchar(40) NOT NULL,
	"outcome" varchar(48) NOT NULL,
	"acknowledged_at" timestamp with time zone NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "ck_policy_ack_language" CHECK ("policy_acknowledgements"."language" in ('id', 'en')),
	CONSTRAINT "ck_policy_ack_outcome" CHECK ("policy_acknowledgements"."outcome" in ('ACCEPTED', 'DECLINED', 'PROVIDED', 'SKIPPED'))
);
--> statement-breakpoint
CREATE TABLE "content_page_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"content_page_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"effective_from" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_pages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"route_key" varchar(160) NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_sections" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"page_version_id" uuid NOT NULL,
	"section_key" varchar(120) NOT NULL,
	"section_type" varchar(64) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_translations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"content_section_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"translation_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_content_translation_locale" CHECK ("content_translations"."locale" in ('id', 'en'))
);
--> statement-breakpoint
CREATE TABLE "food_order_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"food_order_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(48),
	"to_status" varchar(48) NOT NULL,
	"notes" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "food_order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"food_order_id" uuid NOT NULL,
	"menu_item_version_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price_idr" numeric(18, 2) NOT NULL,
	"tax_amount_idr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_idr" numeric(18, 2) NOT NULL,
	"price_tax_snapshot" jsonb NOT NULL,
	"notes" text,
	"folio_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_food_order_item_amount" CHECK ("food_order_items"."quantity" > 0 and "food_order_items"."unit_price_idr" >= 0 and "food_order_items"."tax_amount_idr" >= 0 and "food_order_items"."total_idr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "food_orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"order_code" varchar(32) NOT NULL,
	"paper_reference" varchar(80) NOT NULL,
	"reservation_id" uuid,
	"reservation_room_id" uuid,
	"room_stay_id" uuid,
	"folio_id" uuid,
	"settlement_route" varchar(32) NOT NULL,
	"status" varchar(48) DEFAULT 'ENTERED' NOT NULL,
	"customer_name" varchar(160),
	"notes" text,
	"entered_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_food_order_route" CHECK ("food_orders"."settlement_route" in ('STANDALONE', 'ROOM_CHARGE')),
	CONSTRAINT "ck_food_order_room_charge" CHECK ("food_orders"."settlement_route" <> 'ROOM_CHARGE' or ("food_orders"."folio_id" is not null and "food_orders"."room_stay_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"media_type" varchar(40) NOT NULL,
	"title" varchar(200),
	"alt_id" text,
	"alt_en" text,
	"caption_id" text,
	"caption_en" text,
	"rights_source" text,
	"authentic_property_media" boolean DEFAULT false NOT NULL,
	"status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_usages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"usage_type" varchar(64) NOT NULL,
	"target_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"crop_focal_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name_id" varchar(160) NOT NULL,
	"name_en" varchar(160) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"name_id" varchar(160) NOT NULL,
	"name_en" varchar(160) NOT NULL,
	"description_id" text,
	"description_en" text,
	"price_idr" numeric(18, 2) NOT NULL,
	"tax_profile_version_id" uuid,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_menu_item_price" CHECK ("menu_item_versions"."price_idr" >= 0),
	CONSTRAINT "ck_menu_item_period" CHECK ("menu_item_versions"."effective_to" is null or "menu_item_versions"."effective_to" > "menu_item_versions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"category_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"currently_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"reservation_id" uuid,
	"template_version_id" uuid,
	"channel" varchar(32) NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"status" varchar(48) DEFAULT 'QUEUED' NOT NULL,
	"rendered_subject" text,
	"rendered_body" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"provider_reference" varchar(160),
	"last_error" text,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"template_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"locale" varchar(8) NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"lifecycle_status" varchar(48) DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_notification_template_locale" CHECK ("notification_template_versions"."locale" in ('id', 'en'))
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(100) NOT NULL,
	"channel" varchar(32) NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_corrections" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"attendance_session_id" uuid NOT NULL,
	"target_event_id" uuid,
	"correction_type" varchar(64) NOT NULL,
	"before_snapshot" jsonb NOT NULL,
	"after_snapshot" jsonb NOT NULL,
	"reason" text NOT NULL,
	"corrected_by_user_id" uuid NOT NULL,
	"corrected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"attendance_session_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"event_type" varchar(24) NOT NULL,
	"server_time" timestamp with time zone DEFAULT now() NOT NULL,
	"device_time" timestamp with time zone,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_meters" double precision NOT NULL,
	"attendance_location_id" uuid,
	"distance_meters" double precision,
	"geofence_result" varchar(48) NOT NULL,
	"selfie_file_id" uuid NOT NULL,
	"event_status" varchar(48) DEFAULT 'ACCEPTED' NOT NULL,
	"device_metadata" jsonb,
	"idempotency_key" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "ck_attendance_event_type" CHECK ("attendance_events"."event_type" in ('CHECK_IN', 'CHECK_OUT')),
	CONSTRAINT "ck_attendance_event_coordinates" CHECK ("attendance_events"."latitude" between -90 and 90 and "attendance_events"."longitude" between -180 and 180 and "attendance_events"."accuracy_meters" >= 0),
	CONSTRAINT "ck_attendance_event_geofence" CHECK ("attendance_events"."geofence_result" in ('INSIDE', 'OUTSIDE', 'ACCURACY_REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "attendance_locations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"radius_meters" integer NOT NULL,
	"maximum_accuracy_meters" integer NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_attendance_location_coordinates" CHECK ("attendance_locations"."latitude" between -90 and 90 and "attendance_locations"."longitude" between -180 and 180),
	CONSTRAINT "ck_attendance_location_radius" CHECK ("attendance_locations"."radius_meters" > 0 and "attendance_locations"."maximum_accuracy_meters" > 0)
);
--> statement-breakpoint
CREATE TABLE "attendance_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"employee_id" uuid NOT NULL,
	"mode" varchar(48) NOT NULL,
	"business_date" date NOT NULL,
	"shift_assignment_id" uuid,
	"status" varchar(48) DEFAULT 'OPEN' NOT NULL,
	"checked_in_at" timestamp with time zone NOT NULL,
	"checked_out_at" timestamp with time zone,
	"calculated_duration_minutes" integer,
	"exception_flags" jsonb,
	"corrected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_attendance_session_mode" CHECK ("attendance_sessions"."mode" in ('SHIFT', 'FREE')),
	CONSTRAINT "ck_attendance_session_status" CHECK ("attendance_sessions"."status" in ('OPEN', 'CLOSED', 'CORRECTED', 'VOIDED')),
	CONSTRAINT "ck_attendance_session_shift" CHECK ("attendance_sessions"."mode" <> 'SHIFT' or "attendance_sessions"."shift_assignment_id" is not null),
	CONSTRAINT "ck_attendance_session_time" CHECK ("attendance_sessions"."checked_out_at" is null or "attendance_sessions"."checked_out_at" >= "attendance_sessions"."checked_in_at")
);
--> statement-breakpoint
CREATE TABLE "shift_assignments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"employee_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"shift_template_id" uuid NOT NULL,
	"attendance_location_id" uuid,
	"status" varchar(48) DEFAULT 'ASSIGNED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
	"checkin_window_before_minutes" integer DEFAULT 0 NOT NULL,
	"checkin_window_after_minutes" integer DEFAULT 0 NOT NULL,
	"late_tolerance_minutes" integer DEFAULT 0 NOT NULL,
	"crosses_midnight" varchar(48) DEFAULT 'NO' NOT NULL,
	"status" varchar(48) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_shift_template_windows" CHECK ("shift_templates"."checkin_window_before_minutes" >= 0 and "shift_templates"."checkin_window_after_minutes" >= 0 and "shift_templates"."late_tolerance_minutes" >= 0),
	CONSTRAINT "ck_shift_template_crosses_midnight" CHECK ("shift_templates"."crosses_midnight" in ('YES', 'NO'))
);
--> statement-breakpoint
CREATE TABLE "lost_found_claims" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"guest_id" uuid,
	"claimant_name" varchar(200) NOT NULL,
	"claimant_contact_ciphertext" text NOT NULL,
	"verification_details" jsonb NOT NULL,
	"status" varchar(48) DEFAULT 'PENDING' NOT NULL,
	"decision_reason" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_lost_found_claim_status" CHECK ("lost_found_claims"."status" in ('PENDING', 'VERIFIED', 'REJECTED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "lost_found_custody_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_location" varchar(160),
	"to_location" varchar(160),
	"handed_by_user_id" uuid,
	"received_by_user_id" uuid,
	"notes" text,
	"evidence_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "lost_found_evidence" (
	"item_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"evidence_type" varchar(48) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "lost_found_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"item_code" varchar(32) NOT NULL,
	"category" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"found_at" timestamp with time zone NOT NULL,
	"found_location" varchar(160) NOT NULL,
	"room_unit_id" uuid,
	"room_stay_id" uuid,
	"reservation_id" uuid,
	"status" varchar(48) DEFAULT 'FOUND' NOT NULL,
	"storage_location" varchar(160),
	"seal_reference" varchar(80),
	"high_value" varchar(48) DEFAULT 'NO' NOT NULL,
	"retention_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_lost_found_item_status" CHECK ("lost_found_items"."status" in ('FOUND', 'STORED', 'CLAIM_PENDING', 'CLAIMED', 'RETURNED', 'SHIPPED', 'DISPOSED', 'TRANSFERRED_TO_AUTHORITY')),
	CONSTRAINT "ck_lost_found_high_value" CHECK ("lost_found_items"."high_value" in ('YES', 'NO'))
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_access_events" ADD CONSTRAINT "file_access_events_file_id_stored_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_access_events" ADD CONSTRAINT "file_access_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_profile_versions" ADD CONSTRAINT "document_profile_versions_document_profile_id_document_profiles_id_fk" FOREIGN KEY ("document_profile_id") REFERENCES "public"."document_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_profile_versions" ADD CONSTRAINT "document_profile_versions_logo_file_id_stored_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_profile_versions" ADD CONSTRAINT "document_profile_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_profiles" ADD CONSTRAINT "document_profiles_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rate_snapshots" ADD CONSTRAINT "exchange_rate_snapshots_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_instruction_sets" ADD CONSTRAINT "payment_instruction_sets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_instruction_versions" ADD CONSTRAINT "payment_instruction_versions_instruction_set_id_payment_instruction_sets_id_fk" FOREIGN KEY ("instruction_set_id") REFERENCES "public"."payment_instruction_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_instruction_versions" ADD CONSTRAINT "payment_instruction_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_sets" ADD CONSTRAINT "policy_sets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_set_id_policy_sets_id_fk" FOREIGN KEY ("policy_set_id") REFERENCES "public"."policy_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_setting_sets" ADD CONSTRAINT "property_setting_sets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_setting_versions" ADD CONSTRAINT "property_setting_versions_setting_set_id_property_setting_sets_id_fk" FOREIGN KEY ("setting_set_id") REFERENCES "public"."property_setting_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_setting_versions" ADD CONSTRAINT "property_setting_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_profile_versions" ADD CONSTRAINT "tax_profile_versions_tax_profile_id_tax_profiles_id_fk" FOREIGN KEY ("tax_profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_profile_versions" ADD CONSTRAINT "tax_profile_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_profiles" ADD CONSTRAINT "tax_profiles_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_translations" ADD CONSTRAINT "amenity_translations_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plan_versions" ADD CONSTRAINT "rate_plan_versions_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plan_versions" ADD CONSTRAINT "rate_plan_versions_payment_instruction_set_id_payment_instruction_sets_id_fk" FOREIGN KEY ("payment_instruction_set_id") REFERENCES "public"."payment_instruction_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plan_versions" ADD CONSTRAINT "rate_plan_versions_cancellation_policy_set_id_policy_sets_id_fk" FOREIGN KEY ("cancellation_policy_set_id") REFERENCES "public"."policy_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plan_versions" ADD CONSTRAINT "rate_plan_versions_tax_profile_id_tax_profiles_id_fk" FOREIGN KEY ("tax_profile_id") REFERENCES "public"."tax_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_rule_dates" ADD CONSTRAINT "rate_rule_dates_rate_rule_id_rate_rules_id_fk" FOREIGN KEY ("rate_rule_id") REFERENCES "public"."rate_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_rules" ADD CONSTRAINT "rate_rules_rate_plan_version_id_rate_plan_versions_id_fk" FOREIGN KEY ("rate_plan_version_id") REFERENCES "public"."rate_plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_rules" ADD CONSTRAINT "rate_rules_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_pools" ADD CONSTRAINT "resource_pools_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_amenities" ADD CONSTRAINT "room_type_amenities_room_type_version_id_room_type_versions_id_fk" FOREIGN KEY ("room_type_version_id") REFERENCES "public"."room_type_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_amenities" ADD CONSTRAINT "room_type_amenities_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_versions" ADD CONSTRAINT "room_type_versions_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_unit_amenity_overrides" ADD CONSTRAINT "room_unit_amenity_overrides_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_unit_amenity_overrides" ADD CONSTRAINT "room_unit_amenity_overrides_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_unit_states" ADD CONSTRAINT "room_unit_states_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_unit_type_periods" ADD CONSTRAINT "room_unit_type_periods_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_unit_type_periods" ADD CONSTRAINT "room_unit_type_periods_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_units" ADD CONSTRAINT "room_units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_lookup_sessions" ADD CONSTRAINT "booking_lookup_sessions_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_quote_nights" ADD CONSTRAINT "booking_quote_nights_quote_room_id_booking_quote_rooms_id_fk" FOREIGN KEY ("quote_room_id") REFERENCES "public"."booking_quote_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_quote_rooms" ADD CONSTRAINT "booking_quote_rooms_quote_id_booking_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."booking_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_quote_rooms" ADD CONSTRAINT "booking_quote_rooms_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_quote_rooms" ADD CONSTRAINT "booking_quote_rooms_rate_plan_version_id_rate_plan_versions_id_fk" FOREIGN KEY ("rate_plan_version_id") REFERENCES "public"."rate_plan_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_quotes" ADD CONSTRAINT "booking_quotes_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_quotes" ADD CONSTRAINT "booking_quotes_exchange_rate_snapshot_id_exchange_rate_snapshots_id_fk" FOREIGN KEY ("exchange_rate_snapshot_id") REFERENCES "public"."exchange_rate_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_claim_events" ADD CONSTRAINT "inventory_claim_events_inventory_claim_id_inventory_claims_id_fk" FOREIGN KEY ("inventory_claim_id") REFERENCES "public"."inventory_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_claims" ADD CONSTRAINT "inventory_claims_inventory_day_id_inventory_days_id_fk" FOREIGN KEY ("inventory_day_id") REFERENCES "public"."inventory_days"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_claims" ADD CONSTRAINT "inventory_claims_reservation_room_id_reservation_rooms_id_fk" FOREIGN KEY ("reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_days" ADD CONSTRAINT "inventory_days_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_days" ADD CONSTRAINT "inventory_days_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_addons" ADD CONSTRAINT "reservation_addons_reservation_room_id_reservation_rooms_id_fk" FOREIGN KEY ("reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_addons" ADD CONSTRAINT "reservation_addons_resource_pool_id_resource_pools_id_fk" FOREIGN KEY ("resource_pool_id") REFERENCES "public"."resource_pools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_guests" ADD CONSTRAINT "reservation_guests_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_guests" ADD CONSTRAINT "reservation_guests_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_room_nights" ADD CONSTRAINT "reservation_room_nights_reservation_room_id_reservation_rooms_id_fk" FOREIGN KEY ("reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_room_nights" ADD CONSTRAINT "reservation_room_nights_tax_profile_version_id_tax_profile_versions_id_fk" FOREIGN KEY ("tax_profile_version_id") REFERENCES "public"."tax_profile_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_booked_room_type_id_room_types_id_fk" FOREIGN KEY ("booked_room_type_id") REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_fulfilled_room_type_id_room_types_id_fk" FOREIGN KEY ("fulfilled_room_type_id") REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_rate_plan_version_id_rate_plan_versions_id_fk" FOREIGN KEY ("rate_plan_version_id") REFERENCES "public"."rate_plan_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_status_events" ADD CONSTRAINT "reservation_status_events_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_status_events" ADD CONSTRAINT "reservation_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_exchange_rate_snapshot_id_exchange_rate_snapshots_id_fk" FOREIGN KEY ("exchange_rate_snapshot_id") REFERENCES "public"."exchange_rate_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_quote_id_booking_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."booking_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_payment_instruction_version_id_payment_instruction_versions_id_fk" FOREIGN KEY ("payment_instruction_version_id") REFERENCES "public"."payment_instruction_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cancellation_policy_version_id_policy_versions_id_fk" FOREIGN KEY ("cancellation_policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_house_rules_version_id_policy_versions_id_fk" FOREIGN KEY ("house_rules_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_claims" ADD CONSTRAINT "resource_claims_resource_inventory_day_id_resource_inventory_days_id_fk" FOREIGN KEY ("resource_inventory_day_id") REFERENCES "public"."resource_inventory_days"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_claims" ADD CONSTRAINT "resource_claims_reservation_room_id_reservation_rooms_id_fk" FOREIGN KEY ("reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_inventory_days" ADD CONSTRAINT "resource_inventory_days_resource_pool_id_resource_pools_id_fk" FOREIGN KEY ("resource_pool_id") REFERENCES "public"."resource_pools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignment_nights" ADD CONSTRAINT "room_assignment_nights_room_assignment_id_room_assignments_id_fk" FOREIGN KEY ("room_assignment_id") REFERENCES "public"."room_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignment_nights" ADD CONSTRAINT "room_assignment_nights_room_unit_night_claim_id_room_unit_night_claims_id_fk" FOREIGN KEY ("room_unit_night_claim_id") REFERENCES "public"."room_unit_night_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignment_nights" ADD CONSTRAINT "room_assignment_nights_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_block_nights" ADD CONSTRAINT "room_block_nights_room_block_id_room_blocks_id_fk" FOREIGN KEY ("room_block_id") REFERENCES "public"."room_blocks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_block_nights" ADD CONSTRAINT "room_block_nights_room_unit_night_claim_id_room_unit_night_claims_id_fk" FOREIGN KEY ("room_unit_night_claim_id") REFERENCES "public"."room_unit_night_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_block_nights" ADD CONSTRAINT "room_block_nights_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_move_events" ADD CONSTRAINT "room_move_events_room_move_id_room_moves_id_fk" FOREIGN KEY ("room_move_id") REFERENCES "public"."room_moves"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_moves" ADD CONSTRAINT "room_moves_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_moves" ADD CONSTRAINT "room_moves_from_assignment_id_room_assignments_id_fk" FOREIGN KEY ("from_assignment_id") REFERENCES "public"."room_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_moves" ADD CONSTRAINT "room_moves_to_assignment_id_room_assignments_id_fk" FOREIGN KEY ("to_assignment_id") REFERENCES "public"."room_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_moves" ADD CONSTRAINT "room_moves_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_stay_guests" ADD CONSTRAINT "room_stay_guests_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_stay_guests" ADD CONSTRAINT "room_stay_guests_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_stays" ADD CONSTRAINT "room_stays_reservation_room_id_reservation_rooms_id_fk" FOREIGN KEY ("reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_stays" ADD CONSTRAINT "room_stays_lead_guest_id_guests_id_fk" FOREIGN KEY ("lead_guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_unit_night_claims" ADD CONSTRAINT "room_unit_night_claims_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_status_events" ADD CONSTRAINT "stay_status_events_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_status_events" ADD CONSTRAINT "stay_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_entry_coverage" ADD CONSTRAINT "document_entry_coverage_document_version_id_financial_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."financial_document_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_entry_coverage" ADD CONSTRAINT "document_entry_coverage_folio_entry_id_folio_entries_id_fk" FOREIGN KEY ("folio_entry_id") REFERENCES "public"."folio_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_document_versions" ADD CONSTRAINT "financial_document_versions_document_id_financial_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."financial_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_document_versions" ADD CONSTRAINT "financial_document_versions_document_profile_version_id_document_profile_versions_id_fk" FOREIGN KEY ("document_profile_version_id") REFERENCES "public"."document_profile_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_document_versions" ADD CONSTRAINT "financial_document_versions_rendered_file_id_stored_files_id_fk" FOREIGN KEY ("rendered_file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_document_versions" ADD CONSTRAINT "financial_document_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_billing_buckets" ADD CONSTRAINT "folio_billing_buckets_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_billing_buckets" ADD CONSTRAINT "folio_billing_buckets_payer_guest_id_guests_id_fk" FOREIGN KEY ("payer_guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_entries" ADD CONSTRAINT "folio_entries_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_entries" ADD CONSTRAINT "folio_entries_billing_bucket_id_folio_billing_buckets_id_fk" FOREIGN KEY ("billing_bucket_id") REFERENCES "public"."folio_billing_buckets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_entries" ADD CONSTRAINT "folio_entries_reservation_room_id_reservation_rooms_id_fk" FOREIGN KEY ("reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_entries" ADD CONSTRAINT "folio_entries_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_entries" ADD CONSTRAINT "folio_entries_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_entries" ADD CONSTRAINT "folio_entries_tax_profile_version_id_tax_profile_versions_id_fk" FOREIGN KEY ("tax_profile_version_id") REFERENCES "public"."tax_profile_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_entries" ADD CONSTRAINT "folio_entries_posted_by_user_id_users_id_fk" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_status_events" ADD CONSTRAINT "folio_status_events_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_status_events" ADD CONSTRAINT "folio_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folios" ADD CONSTRAINT "folios_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folios" ADD CONSTRAINT "folios_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_document_id_financial_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."financial_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_allocated_by_user_id_users_id_fk" FOREIGN KEY ("allocated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_file_id_stored_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_status_events" ADD CONSTRAINT "payment_status_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_status_events" ADD CONSTRAINT "payment_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_instruction_version_id_payment_instruction_versions_id_fk" FOREIGN KEY ("payment_instruction_version_id") REFERENCES "public"."payment_instruction_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_folio_entry_id_folio_entries_id_fk" FOREIGN KEY ("folio_entry_id") REFERENCES "public"."folio_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_attempts" ADD CONSTRAINT "refund_attempts_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_attempts" ADD CONSTRAINT "refund_attempts_processor_user_id_users_id_fk" FOREIGN KEY ("processor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_attempts" ADD CONSTRAINT "refund_attempts_proof_file_id_stored_files_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_status_events" ADD CONSTRAINT "refund_status_events_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_status_events" ADD CONSTRAINT "refund_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_folio_entry_id_folio_entries_id_fk" FOREIGN KEY ("folio_entry_id") REFERENCES "public"."folio_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_amendment_events" ADD CONSTRAINT "booking_amendment_events_amendment_id_booking_amendments_id_fk" FOREIGN KEY ("amendment_id") REFERENCES "public"."booking_amendments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_amendment_events" ADD CONSTRAINT "booking_amendment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_amendments" ADD CONSTRAINT "booking_amendments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_amendments" ADD CONSTRAINT "booking_amendments_target_reservation_room_id_reservation_rooms_id_fk" FOREIGN KEY ("target_reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_amendments" ADD CONSTRAINT "booking_amendments_applied_by_user_id_users_id_fk" FOREIGN KEY ("applied_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_day_runs" ADD CONSTRAINT "business_day_runs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_capture_items" ADD CONSTRAINT "checkin_capture_items_registration_id_checkin_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."checkin_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_capture_items" ADD CONSTRAINT "checkin_capture_items_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_capture_items" ADD CONSTRAINT "checkin_capture_items_file_id_stored_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_registrations" ADD CONSTRAINT "checkin_registrations_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_registrations" ADD CONSTRAINT "checkin_registrations_purpose_policy_version_id_policy_versions_id_fk" FOREIGN KEY ("purpose_policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_registrations" ADD CONSTRAINT "checkin_registrations_operated_by_user_id_users_id_fk" FOREIGN KEY ("operated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_task_events" ADD CONSTRAINT "cleaning_task_events_cleaning_task_id_cleaning_tasks_id_fk" FOREIGN KEY ("cleaning_task_id") REFERENCES "public"."cleaning_tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_task_events" ADD CONSTRAINT "cleaning_task_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_room_move_id_room_moves_id_fk" FOREIGN KEY ("room_move_id") REFERENCES "public"."room_moves"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_assignee_employee_id_employee_profiles_id_fk" FOREIGN KEY ("assignee_employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_assessments" ADD CONSTRAINT "damage_assessments_incident_id_damage_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."damage_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_assessments" ADD CONSTRAINT "damage_assessments_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_assessments" ADD CONSTRAINT "damage_assessments_folio_entry_id_folio_entries_id_fk" FOREIGN KEY ("folio_entry_id") REFERENCES "public"."folio_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_catalog_items" ADD CONSTRAINT "damage_catalog_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_catalog_versions" ADD CONSTRAINT "damage_catalog_versions_damage_catalog_item_id_damage_catalog_items_id_fk" FOREIGN KEY ("damage_catalog_item_id") REFERENCES "public"."damage_catalog_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_catalog_versions" ADD CONSTRAINT "damage_catalog_versions_tax_profile_version_id_tax_profile_versions_id_fk" FOREIGN KEY ("tax_profile_version_id") REFERENCES "public"."tax_profile_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_incident_evidence" ADD CONSTRAINT "damage_incident_evidence_incident_id_damage_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."damage_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_incident_evidence" ADD CONSTRAINT "damage_incident_evidence_file_id_stored_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_incidents" ADD CONSTRAINT "damage_incidents_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_incidents" ADD CONSTRAINT "damage_incidents_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_incidents" ADD CONSTRAINT "damage_incidents_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_incidents" ADD CONSTRAINT "damage_incidents_damage_catalog_version_id_damage_catalog_versions_id_fk" FOREIGN KEY ("damage_catalog_version_id") REFERENCES "public"."damage_catalog_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_incidents" ADD CONSTRAINT "damage_incidents_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departure_clearance_items" ADD CONSTRAINT "departure_clearance_items_departure_clearance_id_departure_clearances_id_fk" FOREIGN KEY ("departure_clearance_id") REFERENCES "public"."departure_clearances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departure_clearances" ADD CONSTRAINT "departure_clearances_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departure_clearances" ADD CONSTRAINT "departure_clearances_checked_by_user_id_users_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_identity_details" ADD CONSTRAINT "guest_identity_details_registration_id_checkin_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."checkin_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_identity_details" ADD CONSTRAINT "guest_identity_details_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_request_events" ADD CONSTRAINT "guest_request_events_guest_request_id_guest_requests_id_fk" FOREIGN KEY ("guest_request_id") REFERENCES "public"."guest_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_request_events" ADD CONSTRAINT "guest_request_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_reservation_room_id_reservation_rooms_id_fk" FOREIGN KEY ("reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_issue_events" ADD CONSTRAINT "maintenance_issue_events_maintenance_issue_id_maintenance_issues_id_fk" FOREIGN KEY ("maintenance_issue_id") REFERENCES "public"."maintenance_issues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_issue_events" ADD CONSTRAINT "maintenance_issue_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_issues" ADD CONSTRAINT "maintenance_issues_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_issues" ADD CONSTRAINT "maintenance_issues_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_issues" ADD CONSTRAINT "maintenance_issues_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_policy_version_id_policy_versions_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policy_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_page_versions" ADD CONSTRAINT "content_page_versions_content_page_id_content_pages_id_fk" FOREIGN KEY ("content_page_id") REFERENCES "public"."content_pages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_page_versions" ADD CONSTRAINT "content_page_versions_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sections" ADD CONSTRAINT "content_sections_page_version_id_content_page_versions_id_fk" FOREIGN KEY ("page_version_id") REFERENCES "public"."content_page_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_content_section_id_content_sections_id_fk" FOREIGN KEY ("content_section_id") REFERENCES "public"."content_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_order_events" ADD CONSTRAINT "food_order_events_food_order_id_food_orders_id_fk" FOREIGN KEY ("food_order_id") REFERENCES "public"."food_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_order_events" ADD CONSTRAINT "food_order_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_order_items" ADD CONSTRAINT "food_order_items_food_order_id_food_orders_id_fk" FOREIGN KEY ("food_order_id") REFERENCES "public"."food_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_order_items" ADD CONSTRAINT "food_order_items_menu_item_version_id_menu_item_versions_id_fk" FOREIGN KEY ("menu_item_version_id") REFERENCES "public"."menu_item_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_order_items" ADD CONSTRAINT "food_order_items_folio_entry_id_folio_entries_id_fk" FOREIGN KEY ("folio_entry_id") REFERENCES "public"."folio_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_reservation_room_id_reservation_rooms_id_fk" FOREIGN KEY ("reservation_room_id") REFERENCES "public"."reservation_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_folio_id_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."folios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_entered_by_user_id_users_id_fk" FOREIGN KEY ("entered_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_file_id_stored_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_versions" ADD CONSTRAINT "menu_item_versions_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_versions" ADD CONSTRAINT "menu_item_versions_tax_profile_version_id_tax_profile_versions_id_fk" FOREIGN KEY ("tax_profile_version_id") REFERENCES "public"."tax_profile_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_template_version_id_notification_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."notification_template_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_session_id_attendance_sessions_id_fk" FOREIGN KEY ("attendance_session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_target_event_id_attendance_events_id_fk" FOREIGN KEY ("target_event_id") REFERENCES "public"."attendance_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_corrected_by_user_id_users_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_attendance_session_id_attendance_sessions_id_fk" FOREIGN KEY ("attendance_session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_attendance_location_id_attendance_locations_id_fk" FOREIGN KEY ("attendance_location_id") REFERENCES "public"."attendance_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_selfie_file_id_stored_files_id_fk" FOREIGN KEY ("selfie_file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_locations" ADD CONSTRAINT "attendance_locations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_shift_assignment_id_shift_assignments_id_fk" FOREIGN KEY ("shift_assignment_id") REFERENCES "public"."shift_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_template_id_shift_templates_id_fk" FOREIGN KEY ("shift_template_id") REFERENCES "public"."shift_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_attendance_location_id_attendance_locations_id_fk" FOREIGN KEY ("attendance_location_id") REFERENCES "public"."attendance_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_claims" ADD CONSTRAINT "lost_found_claims_item_id_lost_found_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."lost_found_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_claims" ADD CONSTRAINT "lost_found_claims_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_claims" ADD CONSTRAINT "lost_found_claims_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_custody_events" ADD CONSTRAINT "lost_found_custody_events_item_id_lost_found_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."lost_found_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_custody_events" ADD CONSTRAINT "lost_found_custody_events_handed_by_user_id_users_id_fk" FOREIGN KEY ("handed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_custody_events" ADD CONSTRAINT "lost_found_custody_events_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_custody_events" ADD CONSTRAINT "lost_found_custody_events_evidence_file_id_stored_files_id_fk" FOREIGN KEY ("evidence_file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_evidence" ADD CONSTRAINT "lost_found_evidence_item_id_lost_found_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."lost_found_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_evidence" ADD CONSTRAINT "lost_found_evidence_file_id_stored_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."stored_files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_room_unit_id_room_units_id_fk" FOREIGN KEY ("room_unit_id") REFERENCES "public"."room_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_room_stay_id_room_stays_id_fk" FOREIGN KEY ("room_stay_id") REFERENCES "public"."room_stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_properties_code" ON "properties" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_one_active_property" ON "properties" USING btree ("status") WHERE "properties"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_auth_accounts_provider" ON "auth_accounts" USING btree ("provider_id","provider_account_id");--> statement-breakpoint
CREATE INDEX "ix_auth_accounts_user" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_auth_sessions_token_hash" ON "auth_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ix_auth_sessions_user_expiry" ON "auth_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "ix_auth_verifications_identifier_expiry" ON "auth_verifications" USING btree ("identifier","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_employee_profiles_user" ON "employee_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_employee_profiles_code" ON "employee_profiles" USING btree ("property_id","employee_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_permissions_code" ON "permissions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_roles_code" ON "roles" USING btree ("code");--> statement-breakpoint
CREATE INDEX "ix_user_roles_active" ON "user_roles" USING btree ("user_id","property_id","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email_normalized" ON "users" USING btree ("email_normalized");--> statement-breakpoint
CREATE INDEX "ix_audit_target_time" ON "audit_events" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_audit_actor_time" ON "audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_audit_correlation" ON "audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "ix_file_access_file_time" ON "file_access_events" USING btree ("file_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_idempotency_scope_key" ON "idempotency_keys" USING btree ("scope","key");--> statement-breakpoint
CREATE INDEX "ix_idempotency_expiry" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_job_execution_key" ON "job_executions" USING btree ("job_name","idempotency_key");--> statement-breakpoint
CREATE INDEX "ix_outbox_pending" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "ix_security_review" ON "security_events" USING btree ("review_status","severity","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_stored_files_storage_key" ON "stored_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "ix_stored_files_retention" ON "stored_files" USING btree ("retention_category","created_at","purged_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_profile_versions_number" ON "document_profile_versions" USING btree ("document_profile_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_profiles_code" ON "document_profiles" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_sequences_scope" ON "document_sequences" USING btree ("property_id","document_type","period_key");--> statement-breakpoint
CREATE INDEX "ix_exchange_rates_lookup" ON "exchange_rate_snapshots" USING btree ("property_id","quote_currency","as_of_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_instruction_sets_code" ON "payment_instruction_sets" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_instruction_versions_number" ON "payment_instruction_versions" USING btree ("instruction_set_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_policy_sets_code" ON "policy_sets" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_policy_versions_number" ON "policy_versions" USING btree ("policy_set_id","version_number");--> statement-breakpoint
CREATE INDEX "ix_policy_versions_effective" ON "policy_versions" USING btree ("policy_set_id","lifecycle_status","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_property_setting_sets_code" ON "property_setting_sets" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_property_setting_versions_number" ON "property_setting_versions" USING btree ("setting_set_id","version_number");--> statement-breakpoint
CREATE INDEX "ix_property_setting_versions_effective" ON "property_setting_versions" USING btree ("setting_set_id","lifecycle_status","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_profile_versions_number" ON "tax_profile_versions" USING btree ("tax_profile_id","version_number");--> statement-breakpoint
CREATE INDEX "ix_tax_profile_versions_effective" ON "tax_profile_versions" USING btree ("tax_profile_id","lifecycle_status","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_profiles_code" ON "tax_profiles" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_amenities_code" ON "amenities" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rate_plan_versions_number" ON "rate_plan_versions" USING btree ("rate_plan_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rate_plans_code" ON "rate_plans" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rate_rule_dates" ON "rate_rule_dates" USING btree ("rate_rule_id","stay_date");--> statement-breakpoint
CREATE INDEX "ix_rate_rules_resolve" ON "rate_rules" USING btree ("room_type_id","starts_on","ends_on","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_resource_pools_code" ON "resource_pools" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_type_versions_number" ON "room_type_versions" USING btree ("room_type_id","version_number");--> statement-breakpoint
CREATE INDEX "ix_room_type_versions_effective" ON "room_type_versions" USING btree ("room_type_id","lifecycle_status","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_types_code" ON "room_types" USING btree ("property_id","code");--> statement-breakpoint
CREATE INDEX "ix_room_unit_type_periods_current" ON "room_unit_type_periods" USING btree ("room_unit_id","effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_units_number" ON "room_units" USING btree ("property_id","room_number");--> statement-breakpoint
CREATE INDEX "ix_room_units_board_order" ON "room_units" USING btree ("property_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_booking_lookup_token" ON "booking_lookup_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ix_booking_lookup_expiry" ON "booking_lookup_sessions" USING btree ("reservation_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_booking_quote_nights" ON "booking_quote_nights" USING btree ("quote_room_id","stay_date");--> statement-breakpoint
CREATE INDEX "ix_booking_quote_rooms_quote" ON "booking_quote_rooms" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "ix_booking_quotes_expiry" ON "booking_quotes" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "ix_guests_contact" ON "guests" USING btree ("property_id","email","phone");--> statement-breakpoint
CREATE INDEX "ix_inventory_claim_events" ON "inventory_claim_events" USING btree ("inventory_claim_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inventory_claim_idempotency" ON "inventory_claims" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ix_inventory_claims_active" ON "inventory_claims" USING btree ("inventory_day_id","claim_status");--> statement-breakpoint
CREATE INDEX "ix_inventory_claims_source" ON "inventory_claims" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inventory_days" ON "inventory_days" USING btree ("property_id","room_type_id","stay_date");--> statement-breakpoint
CREATE INDEX "ix_reservation_addons_room" ON "reservation_addons" USING btree ("reservation_room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reservation_room_nights" ON "reservation_room_nights" USING btree ("reservation_room_id","stay_date");--> statement-breakpoint
CREATE INDEX "ix_reservation_room_nights_date" ON "reservation_room_nights" USING btree ("stay_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reservation_rooms_line" ON "reservation_rooms" USING btree ("reservation_id","line_number");--> statement-breakpoint
CREATE INDEX "ix_reservation_rooms_dates" ON "reservation_rooms" USING btree ("fulfilled_room_type_id","check_in_date","checkout_date");--> statement-breakpoint
CREATE INDEX "ix_reservation_status_events" ON "reservation_status_events" USING btree ("reservation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reservations_booking_code" ON "reservations" USING btree ("booking_code");--> statement-breakpoint
CREATE INDEX "ix_reservation_lookup" ON "reservations" USING btree ("booking_code","booker_email_normalized");--> statement-breakpoint
CREATE INDEX "ix_reservations_status_deadline" ON "reservations" USING btree ("status","payment_deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_resource_claim_idempotency" ON "resource_claims" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ix_resource_claim_active" ON "resource_claims" USING btree ("resource_inventory_day_id","claim_status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_resource_inventory_days" ON "resource_inventory_days" USING btree ("resource_pool_id","stay_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_assignment_night_claim" ON "room_assignment_nights" USING btree ("room_unit_night_claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_assignment_night_active" ON "room_assignment_nights" USING btree ("room_unit_id","stay_date") WHERE "room_assignment_nights"."released_at" is null;--> statement-breakpoint
CREATE INDEX "ix_room_assignment_nights_assignment" ON "room_assignment_nights" USING btree ("room_assignment_id");--> statement-breakpoint
CREATE INDEX "ix_room_assignments_stay" ON "room_assignments" USING btree ("room_stay_id","status");--> statement-breakpoint
CREATE INDEX "ix_room_assignments_unit" ON "room_assignments" USING btree ("room_unit_id","status","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_block_night_claim" ON "room_block_nights" USING btree ("room_unit_night_claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_block_night_active" ON "room_block_nights" USING btree ("room_unit_id","stay_date") WHERE "room_block_nights"."released_at" is null;--> statement-breakpoint
CREATE INDEX "ix_room_block_nights_block" ON "room_block_nights" USING btree ("room_block_id");--> statement-breakpoint
CREATE INDEX "ix_room_blocks_unit_period" ON "room_blocks" USING btree ("room_unit_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "ix_room_move_events" ON "room_move_events" USING btree ("room_move_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_room_moves_stay" ON "room_moves" USING btree ("room_stay_id","effective_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_stays_reservation_room" ON "room_stays" USING btree ("reservation_room_id");--> statement-breakpoint
CREATE INDEX "ix_room_stays_operational" ON "room_stays" USING btree ("status","planned_arrival_at","planned_departure_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_unit_night_claim_active" ON "room_unit_night_claims" USING btree ("room_unit_id","stay_date") WHERE "room_unit_night_claims"."claim_status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "ix_room_unit_night_claim_source" ON "room_unit_night_claims" USING btree ("claim_type","source_id");--> statement-breakpoint
CREATE INDEX "ix_stay_status_events" ON "stay_status_events" USING btree ("room_stay_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_entry_coverage_version" ON "document_entry_coverage" USING btree ("document_version_id","folio_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_entry_active_final" ON "document_entry_coverage" USING btree ("folio_entry_id") WHERE "document_entry_coverage"."active_final_coverage" = 'YES';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_financial_document_versions" ON "financial_document_versions" USING btree ("document_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_financial_document_number" ON "financial_documents" USING btree ("property_id","document_type","document_number") WHERE "financial_documents"."document_number" is not null;--> statement-breakpoint
CREATE INDEX "ix_financial_documents_folio" ON "financial_documents" USING btree ("folio_id","document_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_folio_billing_bucket_code" ON "folio_billing_buckets" USING btree ("folio_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_folio_entries_idempotency" ON "folio_entries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_folio_entry_single_reversal" ON "folio_entries" USING btree ("reversal_of_entry_id") WHERE "folio_entries"."reversal_of_entry_id" is not null;--> statement-breakpoint
CREATE INDEX "ix_folio_entries_folio_date" ON "folio_entries" USING btree ("folio_id","service_date","posted_at");--> statement-breakpoint
CREATE INDEX "ix_folio_entries_source" ON "folio_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "ix_folio_status_events" ON "folio_status_events" USING btree ("folio_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_folios_reservation" ON "folios" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "ix_payment_allocations_payment" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "ix_payment_allocations_document" ON "payment_allocations" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_proof_file" ON "payment_proofs" USING btree ("payment_id","file_id");--> statement-breakpoint
CREATE INDEX "ix_payment_status_events" ON "payment_status_events" USING btree ("payment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_code" ON "payments" USING btree ("payment_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_idempotency" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_folio_entry" ON "payments" USING btree ("folio_entry_id");--> statement-breakpoint
CREATE INDEX "ix_payments_verification_queue" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refund_attempt_number" ON "refund_attempts" USING btree ("refund_id","attempt_number");--> statement-breakpoint
CREATE INDEX "ix_refund_status_events" ON "refund_status_events" USING btree ("refund_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refunds_code" ON "refunds" USING btree ("refund_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refunds_idempotency" ON "refunds" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refunds_folio_entry" ON "refunds" USING btree ("folio_entry_id");--> statement-breakpoint
CREATE INDEX "ix_refunds_queue" ON "refunds" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ix_booking_amendment_events" ON "booking_amendment_events" USING btree ("amendment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_booking_amendment_idempotency" ON "booking_amendments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ix_booking_amendment_reservation" ON "booking_amendments" USING btree ("reservation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_business_day_run" ON "business_day_runs" USING btree ("property_id","business_date","run_type","idempotency_key");--> statement-breakpoint
CREATE INDEX "ix_business_day_runs_status" ON "business_day_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_checkin_capture_type_guest" ON "checkin_capture_items" USING btree ("registration_id","guest_id","capture_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_checkin_registration_stay" ON "checkin_registrations" USING btree ("room_stay_id");--> statement-breakpoint
CREATE INDEX "ix_cleaning_task_events" ON "cleaning_task_events" USING btree ("cleaning_task_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_cleaning_tasks_queue" ON "cleaning_tasks" USING btree ("property_id","status","priority","target_at");--> statement-breakpoint
CREATE INDEX "ix_cleaning_tasks_room" ON "cleaning_tasks" USING btree ("room_unit_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_damage_assessment_folio_entry" ON "damage_assessments" USING btree ("folio_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_damage_catalog_code" ON "damage_catalog_items" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_damage_catalog_versions" ON "damage_catalog_versions" USING btree ("damage_catalog_item_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_damage_incident_evidence" ON "damage_incident_evidence" USING btree ("incident_id","file_id");--> statement-breakpoint
CREATE INDEX "ix_damage_incident_booking" ON "damage_incidents" USING btree ("reservation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_departure_clearance_item" ON "departure_clearance_items" USING btree ("departure_clearance_id","item_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_departure_clearance_stay" ON "departure_clearances" USING btree ("room_stay_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_guest_identity_registration_guest" ON "guest_identity_details" USING btree ("registration_id","guest_id");--> statement-breakpoint
CREATE INDEX "ix_guest_request_events" ON "guest_request_events" USING btree ("guest_request_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_guest_request_queue" ON "guest_requests" USING btree ("status","target_at");--> statement-breakpoint
CREATE INDEX "ix_maintenance_issue_events" ON "maintenance_issue_events" USING btree ("maintenance_issue_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_maintenance_issue_queue" ON "maintenance_issues" USING btree ("property_id","status","severity");--> statement-breakpoint
CREATE INDEX "ix_policy_ack_reservation" ON "policy_acknowledgements" USING btree ("reservation_id","policy_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_content_page_versions" ON "content_page_versions" USING btree ("content_page_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_content_pages_route" ON "content_pages" USING btree ("property_id","route_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_content_sections_key" ON "content_sections" USING btree ("page_version_id","section_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_content_translations" ON "content_translations" USING btree ("content_section_id","locale");--> statement-breakpoint
CREATE INDEX "ix_food_order_events" ON "food_order_events" USING btree ("food_order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_food_order_item_folio_entry" ON "food_order_items" USING btree ("folio_entry_id");--> statement-breakpoint
CREATE INDEX "ix_food_order_items_order" ON "food_order_items" USING btree ("food_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_food_orders_code" ON "food_orders" USING btree ("order_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_food_orders_paper_ref" ON "food_orders" USING btree ("property_id","paper_reference");--> statement-breakpoint
CREATE INDEX "ix_food_orders_queue" ON "food_orders" USING btree ("property_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_media_asset_file" ON "media_assets" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "ix_media_usages_target" ON "media_usages" USING btree ("usage_type","target_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_menu_categories_code" ON "menu_categories" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_menu_item_versions" ON "menu_item_versions" USING btree ("menu_item_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_menu_items_code" ON "menu_items" USING btree ("category_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notification_message_idempotency" ON "notification_messages" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ix_notification_queue" ON "notification_messages" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notification_template_versions" ON "notification_template_versions" USING btree ("template_id","version_number","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notification_templates_code" ON "notification_templates" USING btree ("property_id","code","channel");--> statement-breakpoint
CREATE INDEX "ix_attendance_corrections_session" ON "attendance_corrections" USING btree ("attendance_session_id","corrected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attendance_event_idempotency" ON "attendance_events" USING btree ("employee_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ix_attendance_events_session" ON "attendance_events" USING btree ("attendance_session_id","server_time");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attendance_locations_code" ON "attendance_locations" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attendance_session_open" ON "attendance_sessions" USING btree ("employee_id") WHERE "attendance_sessions"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "ix_attendance_sessions_history" ON "attendance_sessions" USING btree ("employee_id","business_date");--> statement-breakpoint
CREATE INDEX "ix_attendance_sessions_daily" ON "attendance_sessions" USING btree ("business_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shift_assignment_employee_date" ON "shift_assignments" USING btree ("employee_id","business_date");--> statement-breakpoint
CREATE INDEX "ix_shift_assignments_date" ON "shift_assignments" USING btree ("business_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shift_templates_code" ON "shift_templates" USING btree ("property_id","code");--> statement-breakpoint
CREATE INDEX "ix_lost_found_claim_queue" ON "lost_found_claims" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ix_lost_found_custody_item" ON "lost_found_custody_events" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lost_found_evidence" ON "lost_found_evidence" USING btree ("item_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lost_found_item_code" ON "lost_found_items" USING btree ("item_code");--> statement-breakpoint
CREATE INDEX "ix_lost_found_queue" ON "lost_found_items" USING btree ("property_id","status","retention_due_at");