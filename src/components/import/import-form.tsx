"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import type { ImportState } from "@/lib/import-state";

type Opt = { id: number; name: string };

// Keep in step with src/server/spreadsheet.ts and the 4.5 MB request limit on Vercel.
const MAX_BYTES = 4 * 1024 * 1024;

/** A drop zone that shows what was chosen and refuses the obvious mistakes (wrong type, too large) before uploading. */
function FilePicker({ onValid }: { onValid: (ok: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const take = (f: File | null) => {
    setFile(f);
    let p: string | null = null;
    if (f) {
      if (!/\.(csv|xlsx|txt)$/i.test(f.name)) p = "Only .csv and .xlsx files can be imported.";
      else if (f.size === 0) p = "That file is empty.";
      else if (f.size > MAX_BYTES) p = "That file is larger than 4 MB. Split it into smaller files.";
    }
    setProblem(p);
    onValid(!!f && !p);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0] ?? null;
          if (f && input.current) {
            const dt = new DataTransfer();
            dt.items.add(f);
            input.current.files = dt.files;
          }
          take(f);
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${over ? "border-brand bg-brand-tint" : problem ? "border-danger" : "border-border"}`}
      >
        <input ref={input} id="file" name="file" type="file" accept=".csv,.xlsx,.txt" className="sr-only" aria-describedby="file-status" onChange={(e) => take(e.target.files?.[0] ?? null)} />
        <label htmlFor="file" className="cursor-pointer rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90">
          {file ? "Choose a different file" : "Choose a file"}
        </label>
        <p className="text-xs text-muted-foreground">or drop it here</p>
        <p id="file-status" aria-live="polite" className={`text-sm ${problem ? "font-medium text-danger" : ""}`}>
          {problem ?? (file ? `${file.name} · ${file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1048576).toFixed(1)} MB`}` : "No file chosen")}
        </p>
      </div>
    </div>
  );
}

function Failures({ failed }: { failed: { row: number; reason: string }[] }) {
  if (failed.length === 0) return null;
  return (
    <details className="mt-3 rounded-lg border border-border p-3 text-sm" open={failed.length <= 8}>
      <summary className="cursor-pointer font-semibold">{failed.length} row{failed.length === 1 ? "" : "s"} could not be imported</summary>
      <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-muted-foreground">
        {failed.slice(0, 100).map((f) => (
          <li key={f.row}>
            Row {f.row}: {f.reason}
          </li>
        ))}
        {failed.length > 100 && <li>…and {failed.length - 100} more.</li>}
      </ul>
    </details>
  );
}

export function ImportForm({
  action,
  mode,
  sources,
  counsellors,
  colleges,
  canAssign,
}: {
  action: (state: ImportState, form: FormData) => Promise<ImportState>;
  mode: "leads" | "learners" | "connections";
  sources: Opt[];
  counsellors: Opt[];
  colleges: Opt[];
  canAssign: boolean;
}) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(action, {});
  const [hasFile, setHasFile] = useState(false);
  const learners = mode === "learners";
  const r = state.result;

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardTitle className="mb-1">1. Get the template</CardTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          {mode === "connections"
            ? "Columns: Name, Designation, Phone, Email, School / College, Notes."
            : "Your own file works too: columns are matched by their titles (Name, Phone, Email, College, Branch, Year…), in any order."}
        </p>
        <div className="flex gap-2">
          <a href={`/api/template?for=${mode}&format=csv`} className="rounded-full border border-foreground px-4 py-2 text-sm font-semibold hover:bg-brand-tint">Download CSV template</a>
          <a href={`/api/template?for=${mode}&format=xlsx`} className="rounded-full border border-foreground px-4 py-2 text-sm font-semibold hover:bg-brand-tint">Excel template</a>
        </div>
      </Card>

      <form action={formAction} className="space-y-4">
        {learners && <input type="hidden" name="learners_only" value="1" />}
        <Card>
          <CardTitle className="mb-3">2. Upload your file</CardTitle>
          <p className="mb-2 text-sm text-muted-foreground">CSV or Excel, up to 4 MB and 10,000 rows.</p>
          <FilePicker onValid={setHasFile} />
        </Card>

        {mode !== "connections" && (
          <Card>
            <CardTitle className="mb-1">3. Same for every row <span className="text-xs font-normal text-muted-foreground">(optional)</span></CardTitle>
            <p className="mb-3 text-sm text-muted-foreground">
              Got a list that is all one college, branch or year? Choose it here and that column is skipped in the file: every row gets this value instead.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="College" htmlFor="all_college">
                <Input id="all_college" name="all_college" list="import-colleges" placeholder="Use the file's column" autoComplete="off" />
                <datalist id="import-colleges">{colleges.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </Field>
              <Field label="Branch / Stream" htmlFor="all_branch">
                <Input id="all_branch" name="all_branch" placeholder="Use the file's column" autoComplete="off" />
              </Field>
              <Field label="Year" htmlFor="all_year">
                <Select id="all_year" name="all_year" defaultValue="">
                  <option value="">Use the file&apos;s column</option>
                  {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{y}{y === 1 ? "st" : y === 2 ? "nd" : y === 3 ? "rd" : "th"} Year</option>)}
                </Select>
              </Field>
            </div>
          </Card>
        )}

        {mode === "leads" && (
          <Card>
            <CardTitle className="mb-3">4. Who gets them?</CardTitle>
            <div className="grid gap-4 md:grid-cols-2">
              {canAssign && (
                <Field label="Assign to" htmlFor="assign" hint="A “Counsellor” column in the file overrides this.">
                  <Select id="assign" name="assign" defaultValue="me">
                    <option value="me">Me</option>
                    <option value="round_robin">Share equally between counsellors</option>
                    {counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
              )}
              <Field label="Source when the file has none" htmlFor="default_source_id">
                <Select id="default_source_id" name="default_source_id" defaultValue="">
                  <option value="">None</option>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            </div>
          </Card>
        )}

        {learners && canAssign && (
          <Card>
            <CardTitle className="mb-3">4. Who looks after them?</CardTitle>
            <Field label="Assign to" htmlFor="assign">
              <Select id="assign" name="assign" defaultValue="me">
                <option value="me">Me</option>
                <option value="round_robin">Share equally between counsellors</option>
                {counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </Card>
        )}

        {state.error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
        <div className="sticky bottom-[var(--footer-h)] z-10 -mx-3 flex items-center gap-3 border-t border-border bg-background px-3 py-3 md:-mx-5 md:px-5">
          <Button type="submit" disabled={pending || !hasFile} aria-busy={pending}>{pending ? "Importing… please wait" : "Import"}</Button>
          {!hasFile && <span className="text-xs text-muted-foreground">Choose a file to continue.</span>}
        </div>
      </form>

      {r && (
        <Card aria-live="polite">
          <CardTitle className="mb-2">Import finished</CardTitle>
          <p className="text-sm">
            {r.rows} row{r.rows === 1 ? "" : "s"} read: <strong>{r.learnersCreated}</strong> new learner{r.learnersCreated === 1 ? "" : "s"}, <strong>{r.learnersUpdated}</strong> existing learner{r.learnersUpdated === 1 ? "" : "s"} updated
            {!learners && <>, <strong>{r.leadsCreated}</strong> enquir{r.leadsCreated === 1 ? "y" : "ies"} created{r.leadsUpdated > 0 && <>, <strong>{r.leadsUpdated}</strong> updated</>}</>}, <strong>{r.failed.length}</strong> failed.
          </p>
          {r.unknownColumns.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Columns not recognised, so skipped: {r.unknownColumns.join(", ")}.</p>}
          <Failures failed={r.failed} />
          <p className="mt-3 text-sm">
            <Link href={learners ? "/learners" : "/leads"} className="font-semibold text-brand underline">See the {learners ? "learners" : "enquiries"}</Link>
          </p>
        </Card>
      )}
      {state.connections && (
        <Card aria-live="polite">
          <CardTitle className="mb-2">Import finished</CardTitle>
          <p className="text-sm"><strong>{state.connections.created}</strong> connection{state.connections.created === 1 ? "" : "s"} added, <strong>{state.connections.failed.length}</strong> failed.</p>
          <Failures failed={state.connections.failed} />
          <p className="mt-3 text-sm"><Link href="/connections" className="font-semibold text-brand underline">See the connections</Link></p>
        </Card>
      )}
    </div>
  );
}
