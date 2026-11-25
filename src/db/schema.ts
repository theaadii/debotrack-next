import {
  pgSchema,
  integer,
  text,
  boolean,
  timestamp,
  numeric,
  jsonb,
  date,
  smallint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Everything lives in its own "app" schema, so it can share a PostgreSQL database with other software. */
export const app = pgSchema("app");

const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------- access
export const roles = app.table("roles", {
  id: id(),
  name: text("name").notNull().unique(),
  description: text("description"),
  /** "all" = administrator (every permission); "custom" = only the listed permission keys. */
  permissionType: text("permission_type", { enum: ["all", "custom"] }).notNull().default("custom"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  /** "own" = the user only sees learners / enquiries assigned to them. */
  viewScope: text("view_scope", { enum: ["all", "own"] }).notNull().default("all"),
  createdAt: createdAt(),
});

export const users = app.table(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    roleId: integer("role_id").notNull().references(() => roles.id),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(sql`lower(${t.email})`)],
);

export const sessions = app.table(
  "sessions",
  {
    /** SHA-256 of the cookie token — a stolen database cannot be replayed as a session. */
    id: text("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = app.table(
  "login_attempts",
  {
    id: id(),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

// ---------------------------------------------------------------- reference data
export const pipelineStages = app.table("pipeline_stages", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["open", "won", "lost"] }).notNull().default("open"),
  sortOrder: integer("sort_order").notNull().default(0),
  probability: smallint("probability").notNull().default(0),
});

export const leadSources = app.table("lead_sources", { id: id(), name: text("name").notNull().unique() });
export const leadTypes = app.table("lead_types", { id: id(), name: text("name").notNull().unique() });

export const programs = app.table("programs", {
  id: id(),
  name: text("name").notNull().unique(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const batches = app.table(
  "batches",
  {
    id: id(),
    programId: integer("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date"),
    fee: numeric("fee", { precision: 12, scale: 2 }).notNull().default("0"),
    seats: integer("seats"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("batches_program_idx").on(t.programId)],
);

// ---------------------------------------------------------------- people
/** Schools, colleges and companies. */
export const colleges = app.table(
  "colleges",
  {
    id: id(),
    name: text("name").notNull(),
    city: text("city"),
    website: text("website"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("colleges_name_key").on(sql`lower(${t.name})`)],
);

/** Students and working professionals (what the old CRM called "persons"). */
export const learners = app.table(
  "learners",
  {
    id: id(),
    name: text("name").notNull(),
    phones: jsonb("phones").$type<string[]>().notNull().default([]),
    emails: jsonb("emails").$type<string[]>().notNull().default([]),
    /** Last 10 digits of every phone / lower-cased emails: used to recognise an existing learner. */
    phoneKeys: text("phone_keys").array().notNull().default(sql`'{}'::text[]`),
    emailKeys: text("email_keys").array().notNull().default(sql`'{}'::text[]`),
    collegeId: integer("college_id").references(() => colleges.id, { onDelete: "set null" }),
    branch: text("branch"),
    year: smallint("year"),
    qualification: text("qualification"),
    city: text("city"),
    kind: text("kind", { enum: ["student", "professional"] }).notNull().default("student"),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("learners_college_idx").on(t.collegeId),
    index("learners_owner_idx").on(t.ownerId),
    index("learners_name_idx").on(sql`lower(${t.name})`),
  ],
);

/** Contacts we have made at institutions: HOD, Principal, TPO… (the old "Contact Book"). */
export const connections = app.table(
  "connections",
  {
    id: id(),
    name: text("name").notNull(),
    designation: text("designation"),
    phone: text("phone"),
    email: text("email"),
    collegeId: integer("college_id").references(() => colleges.id, { onDelete: "set null" }),
    notes: text("notes"),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("connections_college_idx").on(t.collegeId)],
);

// ---------------------------------------------------------------- enquiries
export const leads = app.table(
  "leads",
  {
    id: id(),
    learnerId: integer("learner_id").notNull().references(() => learners.id, { onDelete: "cascade" }),
    stageId: integer("stage_id").notNull().references(() => pipelineStages.id),
    sourceId: integer("source_id").references(() => leadSources.id, { onDelete: "set null" }),
    typeId: integer("type_id").references(() => leadTypes.id, { onDelete: "set null" }),
    programId: integer("program_id").references(() => programs.id, { onDelete: "set null" }),
    batchId: integer("batch_id").references(() => batches.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** Course fee: shown for reference, taken from the batch; never edited by hand. */
    courseFee: numeric("course_fee", { precision: 12, scale: 2 }),
    discountType: text("discount_type", { enum: ["percent", "fixed"] }),
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }),
    /** Course fee less the discount — what the learner actually pays. */
    finalFee: numeric("final_fee", { precision: 12, scale: 2 }),
    expectedCloseDate: date("expected_close_date"),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    remarks: text("remarks"),
    lostReason: text("lost_reason"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leads_learner_idx").on(t.learnerId),
    index("leads_stage_idx").on(t.stageId),
    index("leads_owner_idx").on(t.ownerId),
    index("leads_created_idx").on(t.createdAt),
  ],
);

export const activities = app.table(
  "activities",
  {
    id: id(),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    learnerId: integer("learner_id").references(() => learners.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type", { enum: ["note", "call", "meeting", "task", "email", "system"] }).notNull(),
    title: text("title").notNull(),
    comment: text("comment"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    done: boolean("done").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("activities_lead_idx").on(t.leadId), index("activities_starts_idx").on(t.startsAt)],
);

// ---------------------------------------------------------------- quotes
export type QuoteAddress = { address?: string; city?: string; state?: string; postcode?: string; country?: string };

/** A priced offer to a learner, with line items, tax and a PDF (the same idea as Laravel's quotes). */
export const quotes = app.table(
  "quotes",
  {
    id: id(),
    subject: text("subject").notNull(),
    description: text("description"),
    learnerId: integer("learner_id").notNull().references(() => learners.id, { onDelete: "cascade" }),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    /** The sales person. */
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    billingAddress: jsonb("billing_address").$type<QuoteAddress>(),
    subTotal: numeric("sub_total", { precision: 12, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    adjustmentAmount: numeric("adjustment_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull().default("0"),
    expiredAt: date("expired_at"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quotes_learner_idx").on(t.learnerId), index("quotes_lead_idx").on(t.leadId), index("quotes_owner_idx").on(t.ownerId), index("quotes_created_idx").on(t.createdAt)],
);

export const quoteItems = app.table(
  "quote_items",
  {
    id: id(),
    quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
    position: smallint("position").notNull().default(0),
    sku: text("sku"),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
    discountKind: text("discount_kind", { enum: ["percent", "amount"] }).notNull().default("percent"),
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    taxPercent: numeric("tax_percent", { precision: 6, scale: 2 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (t) => [index("quote_items_quote_idx").on(t.quoteId)],
);

// ---------------------------------------------------------------- misc
/** At most one row (id = 1): a planned shutdown of the server that counsellors are warned about. */
export const serverNotice = app.table("server_notice", {
  id: integer("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull(),
  message: text("message"),
});

export const settings = app.table("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
