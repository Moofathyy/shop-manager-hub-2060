import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Download, AlertTriangle, ShieldCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { downloadCSV } from "@/lib/csv";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type Txn = { id: string; user_id: string | null; order_id: string | null; type: string; amount: number; currency: string; status: string; provider: string | null; flagged: boolean; flag_reason: string | null; created_at: string };
type Payout = { id: string; seller_id: string; amount: number; status: string; scheduled_for: string | null; processed_at: string | null; hold_reason: string | null; created_at: string; store_name?: string };
type Refund = { id: string; order_id: string; amount: number; reason: string; status: string; notes: string | null; created_at: string };

const txnBadge = (t: string) => {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary" | "info"> = {
    payment: "info", payout: "success", refund: "warning", chargeback: "destructive",
  };
  return <Badge variant={map[t] ?? "secondary"}>{t}</Badge>;
};
const statusBadge = (s: string) => {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    succeeded: "success", paid: "success", processed: "success", approved: "success",
    pending: "warning", processing: "warning", on_hold: "warning",
    failed: "destructive", rejected: "destructive", cancelled: "destructive",
  };
  return <Badge variant={map[s] ?? "secondary"}>{s.replace("_", " ")}</Badge>;
};

export default function Finance() {
  const [tab, setTab] = useState("transactions");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Payments & Finance</h1>
        <p className="text-body text-neutral-2 mt-1">Transactions, payouts, refunds, and fraud monitoring.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-neutral-7">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="fraud">Fraud</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions" className="mt-4"><TransactionsTab /></TabsContent>
        <TabsContent value="payouts" className="mt-4"><PayoutsTab /></TabsContent>
        <TabsContent value="refunds" className="mt-4"><RefundsTab /></TabsContent>
        <TabsContent value="fraud" className="mt-4"><FraudTab /></TabsContent>
        <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function TransactionsTab() {
  const [rows, setRows] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500).then(({ data }) => {
      setRows((data ?? []) as Txn[]); setLoading(false);
    });
  }, []);

  const filtered = rows.filter((r) => (type === "all" || r.type === type) && (!q || r.id.includes(q) || (r.provider ?? "").includes(q)));

  return (
    <Card><CardContent className="p-4">
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-4" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by ID or provider…" className="pl-9 h-11" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[180px] h-11 rounded-input"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="payment">Payment</SelectItem>
            <SelectItem value="payout">Payout</SelectItem>
            <SelectItem value="refund">Refund</SelectItem>
            <SelectItem value="chargeback">Chargeback</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={() => downloadCSV("transactions.csv", filtered)}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>
      <div className="overflow-x-auto rounded-input border border-neutral-6">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-7 hover:bg-neutral-7">
              <TableHead>ID</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Provider</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-6" /></TableCell></TableRow> :
              filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-neutral-4 py-12">No transactions</TableCell></TableRow> :
                filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-caption">{t.id.slice(0, 8)}</TableCell>
                    <TableCell>{txnBadge(t.type)}</TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell className="text-right font-medium">{t.currency} {Number(t.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-neutral-2">{t.provider ?? "—"}</TableCell>
                    <TableCell className="text-neutral-2">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </CardContent></Card>
  );
}

function PayoutsTab() {
  const [rows, setRows] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("payouts").select("*").order("created_at", { ascending: false }),
      supabase.from("seller_profiles").select("user_id, store_name"),
    ]);
    const m = new Map((s ?? []).map((x) => [x.user_id, x.store_name]));
    setRows(((p ?? []) as Payout[]).map((x) => ({ ...x, store_name: m.get(x.seller_id) })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: "paid" | "on_hold" | "processing" | "pending", reason?: string) => {
    const update: Partial<{ status: typeof status; processed_at: string; hold_reason: string | null }> = { status };
    if (status === "paid") update.processed_at = new Date().toISOString();
    if (status === "on_hold") update.hold_reason = reason ?? null;
    const { error } = await supabase.from("payouts").update(update).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`payout.${status}`, "payout", id);
    toast({ title: "Payout updated" });
    load();
  };

  return (
    <Card><CardContent className="p-4">
      <div className="overflow-x-auto rounded-input border border-neutral-6">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-7 hover:bg-neutral-7">
              <TableHead>Seller</TableHead><TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead><TableHead>Scheduled</TableHead><TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-6" /></TableCell></TableRow> :
              rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-neutral-4 py-12">No payouts in the queue</TableCell></TableRow> :
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.store_name ?? p.seller_id.slice(0,8)}</TableCell>
                    <TableCell className="text-right">${Number(p.amount).toFixed(2)}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-neutral-2">{p.scheduled_for ?? "—"}</TableCell>
                    <TableCell className="text-neutral-2">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.status !== "paid" && p.status !== "on_hold" && (
                          <Button size="sm" variant="primary" onClick={() => setStatus(p.id, "paid")}>Mark paid</Button>
                        )}
                        {p.status !== "on_hold" && p.status !== "paid" && (
                          <Button size="sm" variant="secondary" onClick={() => setStatus(p.id, "on_hold", "Hold pending review")}>Hold</Button>
                        )}
                        {p.status === "on_hold" && (
                          <Button size="sm" variant="ghost" onClick={() => setStatus(p.id, "pending")}>Release</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </CardContent></Card>
  );
}

function RefundsTab() {
  const [rows, setRows] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("refunds").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Refund[]); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: "approved" | "rejected" | "processed", notes?: string) => {
    const u = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("refunds").update({
      status, notes: notes ?? null, decided_by: u?.id ?? null, decided_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`refund.${status}`, "refund", id);
    toast({ title: "Refund updated" });
    load();
  };

  return (
    <Card><CardContent className="p-4">
      <div className="overflow-x-auto rounded-input border border-neutral-6">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-7 hover:bg-neutral-7">
              <TableHead>Order</TableHead><TableHead className="text-right">Amount</TableHead>
              <TableHead>Reason</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-6" /></TableCell></TableRow> :
              rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-neutral-4 py-12">No refund requests</TableCell></TableRow> :
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-caption">{r.order_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-right">${Number(r.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-neutral-2 max-w-xs truncate">{r.reason}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="primary" onClick={() => decide(r.id, "approved")}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                        </div>
                      )}
                      {r.status === "approved" && (
                        <Button size="sm" variant="secondary" onClick={() => decide(r.id, "processed")}>Mark processed</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </CardContent></Card>
  );
}

function FraudTab() {
  const [rows, setRows] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("transactions").select("*").eq("flagged", true).order("created_at", { ascending: false });
    setRows((data ?? []) as Txn[]); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resolve = async (id: string) => {
    const { error } = await supabase.from("transactions").update({ flagged: false }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("fraud.resolve", "transaction", id);
    toast({ title: "Marked resolved" });
    load();
  };

  return (
    <Card><CardContent className="p-4">
      {loading ? <Skeleton className="h-32" /> : rows.length === 0 ? (
        <div className="py-16 text-center">
          <ShieldCheck className="h-10 w-10 text-success mx-auto mb-3" />
          <p className="text-h3 text-neutral-1">No flagged transactions</p>
          <p className="text-caption text-neutral-2 mt-1">Suspicious activity will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <div key={t.id} className="flex items-start justify-between p-4 rounded-input border border-warning bg-warning-bg/30">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-warning-text mt-0.5" />
                <div>
                  <div className="flex gap-2 items-center">
                    <span className="font-mono text-caption">{t.id.slice(0, 12)}</span>
                    {txnBadge(t.type)}
                    <span className="text-h3">${Number(t.amount).toFixed(2)}</span>
                  </div>
                  <p className="text-caption text-neutral-2 mt-1">{t.flag_reason ?? "Flagged by fraud rules"}</p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => resolve(t.id)}>Mark resolved</Button>
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  );
}

function ReportsTab() {
  const [data, setData] = useState<{ revenue: number; refunds: number; commission: number; orders: number } | null>(null);
  useEffect(() => {
    (async () => {
      const [{ data: txn }, { data: orders }] = await Promise.all([
        supabase.from("transactions").select("type, amount, status"),
        supabase.from("orders").select("total"),
      ]);
      const revenue = (orders ?? []).reduce((s, o) => s + Number(o.total), 0);
      const refunds = (txn ?? []).filter((t) => t.type === "refund" && t.status === "succeeded").reduce((s, t) => s + Number(t.amount), 0);
      const commission = revenue * 0.10;
      setData({ revenue, refunds, commission, orders: (orders ?? []).length });
    })();
  }, []);
  if (!data) return <Skeleton className="h-40" />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[
        { l: "Total revenue", v: `$${data.revenue.toFixed(2)}` },
        { l: "Total orders", v: data.orders },
        { l: "Refunds processed", v: `$${data.refunds.toFixed(2)}` },
        { l: "Platform commission (10%)", v: `$${data.commission.toFixed(2)}` },
      ].map((k, i) => (
        <Card key={i}><CardContent className="p-4">
          <div className="text-caption text-neutral-2">{k.l}</div>
          <div className="text-h1 text-neutral-1 mt-1">{k.v}</div>
        </CardContent></Card>
      ))}
    </div>
  );
}
