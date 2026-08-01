"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useStore } from "@/store/store";
import { allOpenRfqs } from "@/store/selectors";
import { PageHeader, Panel, Button, DataTable, StatusPill, Pill, type Col } from "@/components/ui/primitives";
import type { RfqBundle } from "@/types";

// All invites responded (QUOTED or DECLINED — none still PENDING/SENT/VIEWED) → ok.
// None have responded yet → neutral. Anything in between → warn (needs a nudge/follow-up).
const responseTone = (bundle: RfqBundle) => {
  const total = bundle.invites.length;
  if (total === 0) return "neutral";
  const responded = bundle.invites.filter((i) => i.status === "QUOTED" || i.status === "DECLINED").length;
  if (responded === total) return "ok";
  if (responded === 0) return "neutral";
  return "warn";
};

// Deadline urgency: today-or-past → bad, within 3 days → warn, otherwise neutral.
// `deadline` is a plain "YYYY-MM-DD" string (from a <input type="date">), matching the
// format of toISOString().slice(0, 10), so both sides parse to UTC midnight consistently.
const deadlineTone = (deadline: string) => {
  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = Math.round((new Date(deadline).getTime() - new Date(today).getTime()) / 86_400_000);
  if (daysLeft <= 0) return "bad";
  if (daysLeft <= 3) return "warn";
  return "neutral";
};

export default function RfqBundlesPage() {
  const store = useStore();
  const bundles = Object.values(store.rfqBundles).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const openBundles = bundles.filter((b) => ["DRAFT", "FLOATED", "RECEIVING_QUOTES", "QUOTES_IN", "DECISION_PENDING"].includes(b.status));

  const cols: Col<RfqBundle>[] = [
    { key: "id", header: "Bundle ID", render: (b) => <Link href={`/fulfilment/rfq-bundles/${b.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{b.id.slice(0, 12)}</Link> },
    { key: "lines", header: "Lines", render: (b) => <span className="text-sm font-medium">{b.lines.length}</span> },
    { key: "suppliers", header: "Suppliers", render: (b) => <span className="text-sm">{b.invites.length}</span> },
    { key: "responses", header: "Responses", render: (b) => <Pill tone={responseTone(b)}>{b.invites.filter((i) => i.status === "QUOTED").length}/{b.invites.length} quoted</Pill> },
    { key: "deadline", header: "Deadline", render: (b) => <Pill tone={deadlineTone(b.deadline)}>{b.deadline}</Pill> },
    { key: "status", header: "Status", render: (b) => <StatusPill status={b.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFQ Bundles"
        description="Aggregated RFQs floated to suppliers for quote collection and negotiation."
        actions={<Link href="/fulfilment/rfq-bundles/new"><Button><Plus className="h-4 w-4" /> New Bundle</Button></Link>}
      />

      <Panel title={`Open Bundles (${openBundles.length})`}>
        {bundles.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No RFQ bundles yet. Create one to get started.</div>
        ) : (
          <DataTable columns={cols} rows={bundles} />
        )}
      </Panel>
    </div>
  );
}
