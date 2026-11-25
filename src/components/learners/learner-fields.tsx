import { MatchHint } from "@/components/learners/match-hint";
import { AreaField, FormGrid, SelectField, TextField } from "@/components/forms";

const YEARS = [1, 2, 3, 4, 5, 6].map((y) => ({ value: y, label: `${y}${y === 1 ? "st" : y === 2 ? "nd" : y === 3 ? "rd" : "th"} Year` }));

export type LearnerDefaults = Partial<{ name: string; phone: string; email: string; college: string; branch: string; year: string; city: string; qualification: string; kind: string; owner_id: string }>;

/** The learner's details, shared by "add learner" and "edit learner". */
export function LearnerFields({
  d = {},
  colleges,
  counsellors,
  editingId,
}: {
  d?: LearnerDefaults;
  colleges: { id: number; name: string }[];
  counsellors?: { id: number; name: string }[];
  editingId?: number;
}) {
  return (
    <FormGrid>
      <TextField name="name" label="Name" required defaultValue={d.name} className="md:col-span-2" />
      <TextField name="phone" label="Phone" type="tel" inputMode="tel" defaultValue={d.phone} hint="Several numbers: separate with commas" required />
      <TextField name="email" label="Email" type="email" defaultValue={d.email} />
      <MatchHint mode="learner" except={editingId} />
      <div className="md:col-span-2">
        <TextField name="college" label="School / College / Company" list="learner-college-list" defaultValue={d.college} hint="Pick a saved one, or type a new name to add it." />
        <datalist id="learner-college-list">
          {colleges.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </div>
      <SelectField name="year" label="Year" options={YEARS} defaultValue={d.year} />
      <TextField name="branch" label="Branch / Stream" defaultValue={d.branch} />
      <TextField name="city" label="City" defaultValue={d.city} />
      <TextField name="qualification" label="Qualification" defaultValue={d.qualification} />
      <SelectField name="kind" label="Type" emptyLabel={null} defaultValue={d.kind ?? "student"} options={[{ value: "student", label: "Student" }, { value: "professional", label: "Working professional" }]} />
      {counsellors && (
        <SelectField name="owner_id" label="Counsellor" defaultValue={d.owner_id} emptyLabel="Me" options={counsellors.map((u) => ({ value: u.id, label: u.name }))} />
      )}
    </FormGrid>
  );
}

export { AreaField };
