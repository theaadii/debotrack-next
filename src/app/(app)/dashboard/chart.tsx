"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { day: string; enquiries: number; enrolled: number };

export function EnquiryChart({ data }: { data: Point[] }) {
  const empty = data.every((d) => d.enquiries === 0 && d.enrolled === 0);
  if (empty) return <p className="py-16 text-center text-sm text-muted-foreground">No enquiries or enrolments in this period.</p>;
  return (
    <div className="h-64 w-full" role="img" aria-label="Enquiries and enrolments per day">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="enquiries" name="Enquiries" fill="var(--foreground)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="enrolled" name="Enrolled" fill="var(--brand)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
