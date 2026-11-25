/** The columns of the enquiry spreadsheet — one definition shared by the template, the importer and the exporter. */
export type ColKey =
  | "lead_id" | "name" | "phone" | "email" | "college" | "branch" | "year" | "title" | "source" | "type" | "stage" | "counsellor"
  | "course_fee" | "expected_close_date" | "program" | "batch" | "city" | "qualification" | "discount_type" | "discount_value"
  | "final_fee" | "remarks" | "lost_reason" | "created_at" | "closed_at";

export type Column = { key: ColKey; label: string; aliases: string[]; importable: boolean };

export const COLUMNS: Column[] = [
  { key: "lead_id", label: "Lead ID", aliases: ["leadid", "enquiryid"], importable: true },
  { key: "name", label: "Learner Name", aliases: ["learnername", "studentname", "name", "fullname", "student", "candidatename", "candidate"], importable: true },
  { key: "phone", label: "Phone", aliases: ["phone", "mobile", "mobileno", "mobilenumber", "phonenumber", "phoneno", "contactnumber", "contactno", "contact", "contactnumbers", "whatsapp", "whatsappnumber", "whatsappno"], importable: true },
  { key: "email", label: "Email", aliases: ["email", "emails", "emailid", "emailaddress", "mail"], importable: true },
  { key: "college", label: "School / College / Company", aliases: ["schoolcollegecompany", "school", "college", "institute", "institution", "organization", "organisation", "company", "schoolcollege"], importable: true },
  { key: "branch", label: "Branch / Stream", aliases: ["branch", "stream", "branchstream", "department", "dept"], importable: true },
  { key: "year", label: "Year of Study", aliases: ["year", "yearofstudy", "academicyear", "studyyear"], importable: true },
  { key: "title", label: "Enquiry Title", aliases: ["enquirytitle", "inquirytitle", "title", "leadtitle"], importable: true },
  { key: "source", label: "Source", aliases: ["source", "leadsource"], importable: true },
  { key: "type", label: "Lead Type", aliases: ["leadtype", "type"], importable: true },
  { key: "stage", label: "Stage", aliases: ["stage", "leadstage", "pipelinestage", "status"], importable: true },
  { key: "counsellor", label: "Counsellor", aliases: ["counsellor", "counselor", "salesowner", "assignedto", "owner"], importable: true },
  { key: "course_fee", label: "Course Fee", aliases: ["coursefee", "fee", "fees", "leadvalue", "amount"], importable: true },
  { key: "expected_close_date", label: "Expected Enrolment Date", aliases: ["expectedenrolmentdate", "expectedenrollmentdate", "expectedclosedate", "enrolmentdate", "enrollmentdate"], importable: true },
  { key: "program", label: "Program", aliases: ["program", "programme", "course", "courseinterested"], importable: true },
  { key: "batch", label: "Batch", aliases: ["batch"], importable: true },
  { key: "city", label: "City", aliases: ["city", "town", "location"], importable: true },
  { key: "qualification", label: "Qualification", aliases: ["qualification", "education"], importable: true },
  { key: "discount_type", label: "Discount Type", aliases: ["discounttype"], importable: true },
  { key: "discount_value", label: "Discount", aliases: ["discount", "discountvalue", "discountamount"], importable: true },
  { key: "final_fee", label: "Final Fee", aliases: ["finalfee", "decidedfee"], importable: false },
  { key: "remarks", label: "Remarks", aliases: ["notes", "note", "description", "remarks", "remark", "comment", "comments"], importable: true },
  { key: "lost_reason", label: "Lost Reason", aliases: ["lostreason"], importable: false },
  { key: "created_at", label: "Created At", aliases: ["createdat", "createddate", "enquirydate"], importable: false },
  { key: "closed_at", label: "Closed At", aliases: ["closedat"], importable: false },
];

/** Columns offered in the template: the importable ones except the Lead ID. */
export const TEMPLATE_KEYS: ColKey[] = ["name", "phone", "email", "college", "branch", "year", "source", "program", "batch", "counsellor", "expected_close_date", "remarks"];
export const LEARNER_TEMPLATE_KEYS: ColKey[] = ["name", "phone", "email", "college", "branch", "year", "city", "qualification"];

export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** For a row of header cells, which column each one is (or null when we don't recognise it). */
export function mapHeaders(headers: string[]): (ColKey | null)[] {
  const taken = new Set<ColKey>();
  return headers.map((h) => {
    const n = normalizeHeader(h);
    const col = COLUMNS.find((c) => c.importable && !taken.has(c.key) && (normalizeHeader(c.label) === n || c.aliases.includes(n)));
    if (col) taken.add(col.key);
    return col?.key ?? null;
  });
}

/** Spreadsheet programs run text starting with = + - @ as a formula. Defuse such cells in exports. */
export function safeCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /^[=@\t\r]|^[+-](?!\d)/.test(s) ? `'${s}` : s;
}

/** The reverse, for files we exported ourselves. */
export function unsafeCell(s: string): string {
  return /^'[=@+-]/.test(s) ? s.slice(1) : s;
}
