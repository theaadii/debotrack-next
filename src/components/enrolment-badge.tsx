import { Badge } from "@/components/ui/card";

/** Where a learner stands: enrolled (green), enquiry in progress (highlighted), lost, or no enquiry yet. */
export function EnrolmentBadge({ enrolled, open, lost, total }: { enrolled: number; open: number; lost: number; total: number }) {
  if (enrolled > 0) return <Badge tone="brand">Enrolled</Badge>;
  if (open > 0) return <Badge tone="solid">In progress</Badge>;
  if (lost > 0) return <Badge tone="danger">Not enrolled</Badge>;
  return total === 0 ? <Badge tone="muted">No enquiry</Badge> : <Badge tone="neutral">Enquiry</Badge>;
}
