import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">You don&apos;t have access to this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">Ask an administrator to give your role the permission you need.</p>
      <Link href="/dashboard" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">
        Back to the dashboard
      </Link>
    </main>
  );
}
