"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { batches, programs } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { echo, type FormState } from "@/lib/form-state";
import { dateProblem, LIMITS, tooLong } from "@/lib/validate";
import { optional, optionalInt, optionalNumber, str } from "@/lib/utils";

async function guard() {
  const s = await requireSession();
  if (!s.can("programs.manage")) redirect("/forbidden");
  return s;
}

const done = (flash: string) => {
  revalidatePath("/programs");
  revalidatePath("/leads");
  redirect(`/programs?saved=${flash}`);
};

export async function saveProgramAction(id: number | null, _prev: FormState, form: FormData): Promise<FormState> {
  await guard();
  const name = str(form, "name");
  if (!name) return { fieldErrors: { name: "Enter the program name." }, values: echo(form) };
  const lenErr = tooLong(name, LIMITS.name, "The name") ?? null;
  if (lenErr) return { fieldErrors: { name: lenErr }, values: echo(form) };
  const descErr = tooLong(optional(form, "description"), LIMITS.long, "The description");
  if (descErr) return { fieldErrors: { description: descErr }, values: echo(form) };
  const [dup] = await db.select({ id: programs.id }).from(programs).where(and(sql`lower(${programs.name}) = lower(${name})`, id ? ne(programs.id, id) : undefined)).limit(1);
  if (dup) return { fieldErrors: { name: "A program with this name already exists." }, values: echo(form) };

  const values = { name, description: optional(form, "description"), active: form.get("active") === "on" };
  if (id) await db.update(programs).set(values).where(eq(programs.id, id));
  else await db.insert(programs).values(values);
  return done(id ? "updated" : "created");
}

export async function deleteProgramAction(id: number) {
  await guard();
  await db.delete(programs).where(eq(programs.id, id));
  return done("deleted");
}

export async function saveBatchAction(id: number | null, _prev: FormState, form: FormData): Promise<FormState> {
  await guard();
  const errors: Record<string, string> = {};
  const programId = optionalInt(form, "program_id");
  const name = str(form, "name");
  const fee = optionalNumber(form, "fee");
  const seatsRaw = str(form, "seats");
  const seats = optionalInt(form, "seats");
  const start = optional(form, "start_date");
  if (!programId) errors.program_id = "Choose the program.";
  if (!name) errors.name = "Enter the batch name.";
  else if (name.length > LIMITS.name) errors.name = `The name can be at most ${LIMITS.name} characters.`;
  if (fee === null || fee < 0) errors.fee = "Enter the course fee (0 or more).";
  else if (fee > 10_000_000) errors.fee = "That fee looks too high. Check the amount.";
  if (seatsRaw && !/^\d+$/.test(seatsRaw)) errors.seats = "Seats must be a whole number.";
  else if (seats !== null && (seats < 0 || seats > 100_000)) errors.seats = "Enter a sensible number of seats.";
  if (start) {
    // Past dates are fine when editing an existing batch (it may already be running); a new batch should start today or later.
    const p = dateProblem(start, { allowPast: id !== null });
    if (p) errors.start_date = p;
  }
  if (Object.keys(errors).length) return { fieldErrors: errors, error: "Please fix the highlighted fields.", values: echo(form) };

  if (programId && !errors.name) {
    const [dup] = await db.select({ id: batches.id }).from(batches).where(and(eq(batches.programId, programId), sql`lower(${batches.name}) = lower(${name})`, id ? ne(batches.id, id) : undefined)).limit(1);
    if (dup) errors.name = "This program already has a batch with that name.";
  }
  if (Object.keys(errors).length) return { fieldErrors: errors, error: "Please fix the highlighted fields.", values: echo(form) };

  const values = { programId: programId!, name, fee: fee!.toFixed(2), seats, startDate: start, active: form.get("active") === "on" };
  if (id) await db.update(batches).set(values).where(eq(batches.id, id));
  else await db.insert(batches).values(values);
  return done(id ? "updated" : "created");
}

export async function deleteBatchAction(id: number) {
  await guard();
  await db.delete(batches).where(eq(batches.id, id));
  return done("deleted");
}
