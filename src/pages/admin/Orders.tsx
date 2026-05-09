import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Download, XCircle, Truck, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCSV } from "@/lib/csv";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";

interface Order {
  id: string; status: string; total: number; created_at: string;
  shopper_id: string; seller_id: string; payment_status: string;
  shopper_name?: string; store_name?: string;
}

const orderBadge = (s: string) => {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary" | "info"> = {
    delivered: "success", confirmed: "info", shipped: "info",
    pending: "warning", cancelled: "destructive", returned: "destructive", disputed: "destructive",
  };
  return <Badge variant={map[s] ?? "secondary"}>{s}</Badge>;
};

export default function Orders() {
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    setLoading(true);
    const [{ data: o }, { data: profiles }, { data: sellers }] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("seller_profiles").select("user_id, store_name"),
    ]);
    const pm = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const sm = new Map((sellers ?? []).map((s) => [s.user_id, s.store_name]));
    setRows((o ?? []).map((x) => ({ ...x, shopper_name: pm.get(x.shopper_id) ?? "—", store_name: sm.get(x.seller_id) ?? "—" })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (q && !(r.id.includes(q) || (r.shopper_name ?? "").toLowerCase().includes(q.toLowerCase()) || (r.store_name ?? "").toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });
  const { paged, page, pageSize, total, setPage, setPageSize } = usePagination(filtered, 10, `${q}|${status}`);

  const setStatusOf = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("orders").update({ status: newStatus as "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "returned" | "disputed" }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`order.${newStatus}`, "order", id);
    toast({ title: `Order updated` });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display text-neutral-1">Orders</h1>
          <p className="text-body text-neutral-2 mt-1">{filtered.length} orders</p>
        </div>
        <Button variant="secondary" onClick={() => downloadCSV("orders.csv", filtered)}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-4" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by ID, shopper, or store…" className="pl-9 h-11" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[200px] h-11 rounded-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["pending","confirmed","shipped","delivered","cancelled","returned","disputed"].map((s) =>
                  <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-input border border-neutral-6">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-7 hover:bg-neutral-7">
                  <TableHead>Order</TableHead>
                  <TableHead>Shopper</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6" /></TableCell></TableRow>
                )) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-neutral-4 py-12">No orders</TableCell></TableRow>
                ) : paged.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-caption">{o.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-neutral-1">{o.shopper_name}</TableCell>
                    <TableCell className="text-neutral-2">{o.store_name}</TableCell>
                    <TableCell className="text-right font-medium">${Number(o.total).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="secondary">{o.payment_status}</Badge></TableCell>
                    <TableCell>{orderBadge(o.status)}</TableCell>
                    <TableCell className="text-neutral-2">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {["pending", "confirmed"].includes(o.status) && (
                          <Button variant="ghost" size="sm" onClick={() => setStatusOf(o.id, "shipped")}>
                            <Truck className="h-4 w-4 text-info" />
                          </Button>
                        )}
                        {o.status === "shipped" && (
                          <Button variant="ghost" size="sm" onClick={() => setStatusOf(o.id, "delivered")}>
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </Button>
                        )}
                        {!["cancelled", "delivered", "returned"].includes(o.status) && (
                          <Button variant="ghost" size="sm" onClick={() => setStatusOf(o.id, "cancelled")}>
                            <XCircle className="h-4 w-4 text-destructive-foreground" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
