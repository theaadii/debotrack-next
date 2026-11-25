/** "MET's Institute, Adaon" and "mets institute adaon" are the same college: compare names without case, apostrophes or punctuation. */
export function collegeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The same normalisation, done inside Postgres for a column. */
export const collegeKeySql = (column: string) => `trim(regexp_replace(regexp_replace(lower(${column}), '[''’\`]', '', 'g'), '[^a-z0-9]+', ' ', 'g'))`;
