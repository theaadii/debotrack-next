import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No R2 incremental cache yet: every signed-in page is dynamic (it reads the session cookie),
// so there is nothing meaningful to revalidate at runtime. Add the R2 binding + override later
// if ISR/revalidatePath behaviour ever needs it.
export default defineCloudflareConfig({});
