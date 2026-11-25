"use client";

import { Button } from "@/components/ui/button";

/** A button inside a server-action form that asks "Are you sure?" first. */
export function ConfirmButton({
  message,
  children,
  ...props
}: { message: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
