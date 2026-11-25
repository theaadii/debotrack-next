"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, batches, leads, learners, pipelineStages, programs, leadTypes } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { echo, type FormState } from "@/lib/form-state";
import { computeFinalFee, type DiscountType } from "@/lib/fees";
import { keysFor, splitList } from "@/lib/phone";
import { optional, optionalInt, optionalNumber, str, tidy } from "@/lib/utils";
import { dateProblem, learnerErrors, LIMITS, tooLong } from "@/lib/validate";
import { parseYear } from "@/lib/year";
import { ensureCollege, fillBlankDetails, findExistingLearner } from "@/server/learner-service";
import { getLead, logSystemActivity } from "@/server/leads";
import { learnerScope, leadScope } from "@/server/scope";

type Errors = Record<string, string>;

function readLearner(form: FormData) {
  return {
    name: tidy(str(form, "name")),
    phones: splitList(str(form, "phone")),
    emails: splitList(str(form, "email")),
    college: str(form, "college"),
    branch: optional(form, "branch"),
    year: parseYear(str(form, "year")),
    city: optional(form, "city"),
    qualification: optional(form, "qualification"),
  };
}

/** The part of the form about the enquiry itself, checked against the database. */
async function readEnquiry(form: FormData, errors: Errors) {
  const programId = optionalInt(form, "program_id");
  const batchId = optionalInt(form, "batch_id");

  let batch: { id: number; programId: number; name: string; fee: string } | undefined;
  if (batchId) {
    [batch] = await db.select({ id: batches.id, programId: batches.programId, name: batches.name, fee: batches.fee }).from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) errors.batch_id = "Choose a batch from the list.";
  }
  if (batch && programId && batch.programId !== programId) errors.batch_id = "That batch belongs to a different program.";

  const effectiveProgramId = batch?.programId ?? programId;
  let programName: string | null = null;
  if (effectiveProgramId) {
    const [p] = await db.select({ name: programs.name }).from(programs).where(eq(programs.id, effectiveProgramId)).limit(1);
    programName = p?.name ?? null;
    if (!p) errors.program_id = "Choose a program from the list.";
  }

  // The course fee always comes from the batch — it is shown for reference and never typed in.
  const courseFee = batch ? Number(batch.fee) : null;

  const discountType = (optional(form, "discount_type") as DiscountType | null) ?? null;
  const discountValue = optionalNumber(form, "discount_value");
  if (discountType && discountType !== "percent" && discountType !== "fixed") errors.discount_type = "Choose percent or fixed amount.";
  if (discountValue !== null && discountValue < 0) errors.discount_value = "The discount cannot be negative.";
  if (discountValue && !discountType) errors.discount_type = "Choose how the discount is given.";
  if (discountType === "percent" && discountValue !== null && discountValue >= 100) errors.discount_value = "A discount must be less than 100%.";
  if (discountType === "fixed" && discountValue !== null && courseFee !== null && discountValue >= courseFee && courseFee > 0) errors.discount_value = "The discount must be less than the course fee.";

  const closeDate = optional(form, "expected_close_date");
  const closeProblem = closeDate ? dateProblem(closeDate) : null;
  if (closeProblem) errors.expected_close_date = closeProblem;
  const remarks = optional(form, "remarks");
  const remarksProblem = tooLong(remarks, LIMITS.long, "The remarks");
  if (remarksProblem) errors.remarks = remarksProblem;

  return {
    sourceId: optionalInt(form, "source_id"),
    typeId: optionalInt(form, "type_id"),
    programId: effectiveProgramId,
    batchId: batch?.id ?? null,
    batchName: batch?.name ?? null,
    programName,
    courseFee,
    discountType: discountValue && discountType ? discountType : null,
    discountValue: discountValue && discountType ? discountValue : null,
    finalFee: computeFinalFee(courseFee, discountValue && discountType ? discountType : null, discountValue),
    expectedCloseDate: closeDate,
    remarks,
  };
}

const money = (n: number | null) => (n === null ? null : n.toFixed(2));

export async function createLeadAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.can("leads.create")) return { error: "You don't have permission to create enquiries." };

  const errors: Errors = {};
  const learner = readLearner(form);
  const existingId = optionalInt(form, "learner_id");
  Object.assign(errors, learnerErrors(learner));
  const enquiry = await readEnquiry(form, errors);
  if (Object.keys(errors).length) return { fieldErrors: errors, error: "Please fix the highlighted fields.", values: echo(form) };

  // Counsellors with "own" scope always own what they create; others may assign it.
  const ownerId = session.user.viewScope === "all" ? (optionalInt(form, "owner_id") ?? session.user.id) : session.user.id;

  const collegeId = await ensureCollege(learner.college);
  const scope = learnerScope(session);

  let learnerId: number | null = null;
  if (existingId) {
    const [own] = await db.select({ id: learners.id }).from(learners).where(and(eq(learners.id, existingId), scope)).limit(1);
    learnerId = own?.id ?? null;
  }
  learnerId ??= await findExistingLearner(learner.phones, learner.emails, scope);

  if (learnerId) {
    await fillBlankDetails(learnerId, { collegeId, branch: learner.branch, year: learner.year, city: learner.city, qualification: learner.qualification });
  } else {
    const [created] = await db
      .insert(learners)
      .values({ name: learner.name, phones: learner.phones, emails: learner.emails, ...keysFor(learner.phones, learner.emails), collegeId, branch: learner.branch, year: learner.year, city: learner.city, qualification: learner.qualification, ownerId })
      .returning({ id: learners.id });
    learnerId = created!.id;
  }

  const [firstStage] = await db.select({ id: pipelineStages.id }).from(pipelineStages).where(eq(pipelineStages.kind, "open")).orderBy(asc(pipelineStages.sortOrder)).limit(1);
  const [firstType] = await db.select({ id: leadTypes.id }).from(leadTypes).orderBy(asc(leadTypes.id)).limit(1);
  if (!firstStage) return { error: "No pipeline stage is set up yet. Ask an administrator.", values: echo(form) };

  const [{ name: learnerName } = { name: learner.name }] = await db.select({ name: learners.name }).from(learners).where(eq(learners.id, learnerId)).limit(1);
  const title = enquiry.batchName ? `${enquiry.programName} · ${enquiry.batchName}` : (enquiry.programName ?? `${learnerName} - Enquiry`);

  const [lead] = await db
    .insert(leads)
    .values({
      learnerId, stageId: firstStage.id, sourceId: enquiry.sourceId, typeId: enquiry.typeId ?? firstType?.id ?? null,
      programId: enquiry.programId, batchId: enquiry.batchId, title,
      courseFee: money(enquiry.courseFee), discountType: enquiry.discountType, discountValue: money(enquiry.discountValue), finalFee: money(enquiry.finalFee),
      expectedCloseDate: enquiry.expectedCloseDate, ownerId, remarks: enquiry.remarks,
    })
    .returning({ id: leads.id });

  await logSystemActivity(lead!.id, session.user.id, "Enquiry created");
  if (learnerName.trim().toLowerCase() !== learner.name.trim().toLowerCase()) {
    await logSystemActivity(lead!.id, session.user.id, "Linked to an existing learner", `The phone or email matched ${learnerName}. The name entered was "${learner.name}".`);
  }
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  redirect(`/leads/${lead!.id}?saved=created`);
}

export async function updateLeadAction(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.can("leads.edit")) return { error: "You don't have permission to edit enquiries." };
  const current = await getLead(session, id);
  if (!current) return { error: "This enquiry no longer exists." };

  const errors: Errors = {};
  const learner = readLearner(form);
  Object.assign(errors, learnerErrors(learner));
  const enquiry = await readEnquiry(form, errors);
  if (Object.keys(errors).length) return { fieldErrors: errors, error: "Please fix the highlighted fields.", values: echo(form) };

  const collegeId = await ensureCollege(learner.college);

  // A phone / email that belongs to a different learner means this enquiry is really theirs: link to them
  // instead of copying the number onto this learner (which would leave two learners with the same phone).
  const other = await findExistingLearner(learner.phones, learner.emails, undefined, current.learnerId);
  let learnerId = current.learnerId;
  if (other) {
    const [target] = await db.select({ id: learners.id }).from(learners).where(and(eq(learners.id, other), learnerScope(session))).limit(1);
    if (!target) return { fieldErrors: { phone: "Another learner already has this phone or email." }, error: "Please fix the highlighted fields.", values: echo(form) };
    learnerId = target.id;
    await fillBlankDetails(learnerId, { collegeId, branch: learner.branch, year: learner.year, city: learner.city, qualification: learner.qualification });
    await db.update(activities).set({ learnerId }).where(eq(activities.leadId, id));
  } else {
    await db
      .update(learners)
      .set({ name: learner.name, phones: learner.phones, emails: learner.emails, ...keysFor(learner.phones, learner.emails), collegeId, branch: learner.branch, year: learner.year, city: learner.city, qualification: learner.qualification, updatedAt: new Date() })
      .where(eq(learners.id, current.learnerId));
  }

  const title = enquiry.batchName ? `${enquiry.programName} · ${enquiry.batchName}` : (enquiry.programName ?? `${learner.name} - Enquiry`);
  const ownerId = session.user.viewScope === "all" ? (optionalInt(form, "owner_id") ?? current.ownerId) : current.ownerId;

  await db
    .update(leads)
    .set({
      learnerId, sourceId: enquiry.sourceId, typeId: enquiry.typeId, programId: enquiry.programId, batchId: enquiry.batchId, title,
      courseFee: money(enquiry.courseFee), discountType: enquiry.discountType, discountValue: money(enquiry.discountValue), finalFee: money(enquiry.finalFee),
      expectedCloseDate: enquiry.expectedCloseDate, ownerId, remarks: enquiry.remarks, updatedAt: new Date(),
    })
    .where(eq(leads.id, id));

  const before = Number(current.finalFee ?? current.courseFee ?? 0);
  const after = Number(enquiry.finalFee ?? enquiry.courseFee ?? 0);
  if (learnerId !== current.learnerId) await logSystemActivity(id, session.user.id, "Linked to an existing learner", "The phone or email already belonged to another learner.");
  if (before !== after) await logSystemActivity(id, session.user.id, "Fee changed", `Final fee ${before} → ${after}`);

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/dashboard");
  redirect(`/leads/${id}?saved=updated`);
}

/** Moves an enquiry to another stage (used by the status dropdowns and the stage bar). */
export async function changeStageAction(leadId: number, stageId: number, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  if (!session.can("leads.edit")) return { ok: false, error: "You don't have permission to change the status." };
  const lead = await getLead(session, leadId);
  if (!lead) return { ok: false, error: "This enquiry no longer exists." };
  const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, stageId)).limit(1);
  if (!stage) return { ok: false, error: "Unknown status." };
  if (stage.id === lead.stageId) return { ok: true };

  await db
    .update(leads)
    .set({ stageId, closedAt: stage.kind === "open" ? null : new Date(), lostReason: stage.kind === "lost" ? (reason?.trim().slice(0, 500) || lead.lostReason) : null, updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  await logSystemActivity(leadId, session.user.id, "Status changed", `${lead.stage} → ${stage.name}${stage.kind === "lost" && reason?.trim() ? ` (${reason.trim().slice(0, 500)})` : ""}`);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteLeadAction(leadId: number) {
  const session = await requireSession();
  if (!session.can("leads.delete")) redirect("/forbidden");
  const lead = await getLead(session, leadId);
  if (lead) await db.delete(leads).where(and(eq(leads.id, leadId), leadScope(session)));
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  redirect("/leads?saved=deleted");
}

export async function addActivityAction(leadId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.can("activities.manage")) return { error: "You don't have permission to log activities." };
  const lead = await getLead(session, leadId);
  if (!lead) return { error: "This enquiry no longer exists." };

  const type = str(form, "type");
  if (!["note", "call", "meeting", "task"].includes(type)) return { error: "Choose the kind of activity.", values: echo(form) };
  const comment = optional(form, "comment");
  const lenErr = tooLong(comment, LIMITS.long, "The note") ?? tooLong(str(form, "title"), LIMITS.short, "The title");
  if (lenErr) return { error: lenErr, values: echo(form) };
  const title = str(form, "title") || (type === "note" ? "Note" : type[0]!.toUpperCase() + type.slice(1));
  if (type === "note" && !comment) return { fieldErrors: { comment: "Write the note." }, values: echo(form) };

  // The browser sends a local date-time (no zone); the team works in India Standard Time.
  const when = optional(form, "starts_at");
  const startsAt = when ? new Date(`${when}:00+05:30`) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) return { fieldErrors: { starts_at: "Enter a valid date and time." }, values: echo(form) };
  if (type !== "note" && !startsAt) return { fieldErrors: { starts_at: "Choose when it is planned." }, values: echo(form) };

  await db.insert(activities).values({
    leadId, learnerId: lead.learnerId, userId: session.user.id, type: type as "note" | "call" | "meeting" | "task",
    title, comment, startsAt, endsAt: null, done: type === "note",
  });
  await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, leadId));
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function toggleActivityAction(activityId: number, leadId: number) {
  const session = await requireSession();
  if (!session.can("activities.manage")) return;
  if (!(await getLead(session, leadId))) return;
  const [a] = await db.select().from(activities).where(and(eq(activities.id, activityId), eq(activities.leadId, leadId))).limit(1);
  if (!a || a.type === "system" || a.type === "note") return;
  await db.update(activities).set({ done: !a.done }).where(eq(activities.id, activityId));
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
}
