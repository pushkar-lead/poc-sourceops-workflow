"use client";

import Link from "next/link";
import { Check, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/store";
import { PageHeader, Panel, Button, DataTable, StatusPill, Pill, type Col } from "@/components/ui/primitives";
import type { Tone } from "@/data/enums";
import type { ClientQuote } from "@/types";

// Color-coded urgency for a still-open quote: red as the deadline nears, amber further out.
function daysUntilExpiry(expiresAt: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(expiresAt).getTime() - new Date(today).getTime()) / msPerDay);
}

function expiryTone(days: number): Tone {
  if (days <= 2) return "bad";
  if (days <= 5) return "warn";
  return "neutral";
}

function expiryLabel(days: number, expiresAt: string): string {
  if (days < 0) return `Expired ${expiresAt}`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `${expiresAt} · ${days}d`;
}

export default function ClientQuotesPage() {
  const store = useStore();
  const quotes = Object.values(store.clientQuotes).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleAccept = async (clientQuoteId: string) => {
    await store.acceptClientQuote(clientQuoteId);
  };

  const handleDecline = (clientQuoteId: string) => {
    store.declineClientQuote(clientQuoteId);
  };

  const handleCopyLink = (quote: ClientQuote) => {
    const link = `${window.location.origin}/portal/quote/${quote.id}/${quote.token}`;
    navigator.clipboard.writeText(link);
    toast.success("Portal link copied");
  };

  const cols: Col<ClientQuote>[] = [
    { key: "piNo", header: "PI No", render: (q) => <span className="font-mono text-xs font-semibold text-primary">{q.piNo}</span> },
    { key: "clientName", header: "Client", render: (q) => <span className="text-sm font-medium">{q.clientName}</span> },
    { key: "email", header: "Email", render: (q) => <span className="text-xs text-muted-foreground">{q.clientEmail}</span> },
    { key: "lines", header: "Lines", render: (q) => <span className="text-sm">{q.lines.length}</span> },
    { key: "total", header: "Total", render: (q) => <span className="text-sm font-medium">${q.totalPrice.toFixed(2)}</span> },
    {
      key: "expiryDate",
      header: "Expires",
      render: (q) => {
        if (q.status !== "PENDING") return <span className="text-xs text-muted-foreground">{q.expiresAt}</span>;
        const days = daysUntilExpiry(q.expiresAt);
        return <Pill tone={expiryTone(days)}>{expiryLabel(days, q.expiresAt)}</Pill>;
      },
    },
    { key: "status", header: "Status", render: (q) => <StatusPill status={q.status} /> },
    {
      key: "portalLink",
      header: "",
      render: (q) =>
        q.status === "PENDING" ? (
          <button
            onClick={() => handleCopyLink(q)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Copy portal link"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-xs text-faint">-</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (q) =>
        q.status === "PENDING" ? (
          <div className="flex gap-2 text-xs">
            <Button onClick={() => handleAccept(q.id)} className="bg-ok text-white hover:bg-ok-dark">
              <Check className="h-3 w-3" /> Accept
            </Button>
            <Button variant="outline" onClick={() => handleDecline(q.id)} className="text-bad border-bad">
              <X className="h-3 w-3" /> Decline
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{q.acceptedAt ? `Accepted ${q.acceptedAt}` : "—"}</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Client Quotes" description="Outbound quotes sent to clients. Track acceptance and generate POs on acceptance." />

      <Panel title={`All Quotes (${quotes.length})`}>
        {quotes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No quotes sent yet. Complete RFQ bundles and Finance approvals first.</div>
        ) : (
          <DataTable columns={cols} rows={quotes} />
        )}
      </Panel>
    </div>
  );
}
