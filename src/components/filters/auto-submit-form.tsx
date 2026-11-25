"use client";

/** A GET form that applies itself when a dropdown or date changes (typing in search still needs Enter). */
export function AutoSubmitForm({ children, ...props }: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      onChange={(e) => {
        const t = e.target;
        if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && (t.type === "date"))) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
