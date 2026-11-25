import type { FormState } from "./form-state";
import type { ImportResult } from "@/server/importer";

export type ImportState = FormState & { result?: ImportResult; connections?: { created: number; failed: { row: number; reason: string }[] } };
