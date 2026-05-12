import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, FileText, PackageCheck, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type Status = "requested" | "approved" | "rejected" | "label_issued" | "in_transit" | "received" | "refunded";

interface ReturnReq {
  id: string; order_id: string; shopper_id: string; seller_id: string;
  reason: string; status: Status; return_tracking_number: string | null;
  label_url: string | null; refund_amount: number | null;
  decided_at: string | null; received_at: string | null; created_at: string;
}

const STYLE: Record<Status, "secondary" | "warning" | "success" | "destructive"> = {
  requested: "warning", approved: "secondary", rejected: "destructive",
  label_issued: "secondary", in_transit: "warning", received: "success", refunded: "success",
};

export default function Returns() {
  const [rows, setRows] = useState<ReturnReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [active, setActive] = useState<ReturnReq | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("return_requests").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as ReturnReq[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: Partial<ReturnReq>, action: string) => {
    const { error } = await supabase.from("return_requests").update(patch as any).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`return.${action}`, "return_request", id, patch);
    return true;
  };

  const approve = async (r: ReturnReq) => {
    if (await update(r.id, { status: "approved", decided_at: new Date().toISOString() } as any, "approve")) {
      toast({ title: "Return approved" }); refresh();
    }
  };
  const reject = async (r: ReturnReq) => {
    if (await update(r.id, { status: "rejected", decided_at: new Date().toISOString() } as any, "reject")) {
      toast({ title: "Return rejected" }); refresh();
    }
  };
  const issueLabel = async (r: ReturnReq) => {
    const tracking = "RTN" + Math.random().toString(36).slice(2, 10).toUpperCase();
    if (await update(r.id, { status: "label_issued", return_tracking_number: tracking, label_url: "#" } as any, "issue_label")) {
      toast({ title: "Return label issued", description: tracking }); refresh();
    }
  };
  const markReceived = async (r: ReturnReq) => {
    if (await update(r.id, { status: "received", received_at: new Date().toISOString() } as any, "received")) {
      toast({ title: "Marked as received" }); refresh();
    }
  };
  const issueRefund = async (r: ReturnReq) => {
    const amount = r.refund_amount ?? 0;
    const { error } = await supabase.from("refunds").insert({
      order_id: r.order_id,
      amount,
      reason: r.reason,
      status: "approved" as any,
      decided_at: new Date().toISOString(),
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    if (await update(r.id, { status: "refunded" } as any, "refund")) {
      toast({ title: "Refund issued", description: `$${amount.toFixed(2)}` }); refresh();
    }
  };

  const refresh = () => { setActive(null); load(); };

  const filtered = rows.filter((r) => filter === "all" || r.status === filter);

  return (
    <Card><CardContent className="p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-h3">Return requests</h3>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(["requested","approved","rejected","label_issued","in_transit","received","refunded"] as Status[])
              .map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? <Skeleton className="h-60" /> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Order</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead>
            <TableHead>Tracking</TableHead><TableHead>Refund</TableHead><TableHead>Created</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setActive(r)}>
                <TableCell><Link to={`/admin/orders/${r.order_id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline font-mono text-caption">{r.order_id.slice(0, 8)}</Link></TableCell>
                <TableCell className="max-w-xs truncate">{r.reason}</TableCell>
                <TableCell><Badge variant={STYLE[r.status]}>{r.status.replace("_", " ")}</Badge></TableCell>
                <TableCell className="font-mono text-caption">{r.return_tracking_number ?? "—"}</TableCell>
                <TableCell>{r.refund_amount ? `$${Number(r.refund_amount).toFixed(2)}` : "—"}</TableCell>
                <TableCell className="text-caption text-neutral-4">{format(new Date(r.created_at), "PP")}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-neutral-4 py-8">No return requests</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader><SheetTitle>Return request</SheetTitle></SheetHeader>
          {active && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-caption">
                <div><span className="text-neutral-3">Status</span><div><Badge variant={STYLE[active.status]}>{active.status.replace("_", " ")}</Badge></div></div>
                <div><span className="text-neutral-3">Order</span><div><Link to={`/admin/orders/${active.order_id}`} className="text-primary hover:underline">View order</Link></div></div>
                <div><span className="text-neutral-3">Refund amount</span><div className="text-neutral-1">{active.refund_amount ? `$${Number(active.refund_amount).toFixed(2)}` : "—"}</div></div>
                <div><span className="text-neutral-3">Tracking</span><div className="text-neutral-1 font-mono">{active.return_tracking_number ?? "—"}</div></div>
                <div><span className="text-neutral-3">Decided</span><div className="text-neutral-1">{active.decided_at ? format(new Date(active.decided_at), "PPp") : "—"}</div></div>
                <div><span className="text-neutral-3">Received</span><div className="text-neutral-1">{active.received_at ? format(new Date(active.received_at), "PPp") : "—"}</div></div>
              </div>

              <div>
                <div className="text-caption text-neutral-3">Reason</div>
                <div className="p-3 rounded-input bg-neutral-7 text-body mt-1">{active.reason}</div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-6">
                {active.status === "requested" && (<>
                  <Button onClick={() => approve(active)}><Check className="h-4 w-4" /> Approve</Button>
                  <Button variant="outline" onClick={() => reject(active)}><X className="h-4 w-4" /> Reject</Button>
                </>)}
                {active.status === "approved" && <Button onClick={() => issueLabel(active)}><FileText className="h-4 w-4" /> Generate return label</Button>}
                {active.status === "label_issued" && <Button onClick={() => markReceived(active)}><PackageCheck className="h-4 w-4" /> Mark received</Button>}
                {active.status === "received" && <Button onClick={() => issueRefund(active)}><DollarSign className="h-4 w-4" /> Issue refund</Button>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </CardContent></Card>
  );
}
