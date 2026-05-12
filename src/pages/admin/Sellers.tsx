import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Ban, ShieldOff, ShieldCheck, CheckCircle2, XCircle, MoreHorizontal, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCSV } from "@/lib/csv";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";

interface Seller {
  user_id: string;
  store_name: string;
  business_name: string | null;
  approval_status: string;
  kyc_status: string;
  total_revenue: number;
  payout_balance: number;
  rating: number | null;
  created_at: string;
  status?: string;
  full_name?: string | null;
  product_count?: number;
}

const approvalBadge = (s: string) => {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    approved: "success", pending: "warning", rejected: "destructive", needs_info: "secondary",
  };
  return <Badge variant={map[s] ?? "secondary"}>{s.replace("_", " ")}</Badge>;
};

export default function Sellers() {
  const [rows, setRows] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "pending" | "approved">("all");

  const load = async () => {
    setLoading(true);
    const [{ data: sellers }, { data: profiles }, { data: products }] = await Promise.all([
      supabase.from("seller_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, status"),
      supabase.from("products").select("seller_id"),
    ]);
    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const counts = new Map<string, number>();
    (products ?? []).forEach((p) => counts.set(p.seller_id, (counts.get(p.seller_id) ?? 0) + 1));
    setRows((sellers ?? []).map((s) => ({
      ...s,
      full_name: profMap.get(s.user_id)?.full_name ?? null,
      status: profMap.get(s.user_id)?.status,
      product_count: counts.get(s.user_id) ?? 0,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (tab !== "all" && r.approval_status !== tab) return false;
    if (q && !r.store_name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const { paged, page, pageSize, total, setPage, setPageSize } = usePagination(filtered, 10, `${q}|${tab}`);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    const { error } = await supabase.from("seller_profiles").update({ approval_status: decision }).eq("user_id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`seller.${decision}`, "seller", id);
    toast({ title: `Seller ${decision}` });
    load();
  };

  const setUserStatus = async (id: string, newStatus: "active" | "suspended" | "banned") => {
    const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`seller.${newStatus}`, "seller", id);
    toast({ title: "Updated" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display text-neutral-1">Sellers</h1>
          <p className="text-body text-neutral-2 mt-1">{filtered.length} sellers</p>
        </div>
        <Button variant="secondary" onClick={() => downloadCSV("sellers.csv", filtered)}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="bg-neutral-7">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-4" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by store name…" className="pl-9 h-11" />
          </div>
          <div className="overflow-x-auto rounded-input border border-neutral-6">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-7 hover:bg-neutral-7">
                  <TableHead>Store</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6" /></TableCell></TableRow>
                )) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-neutral-4 py-12">No sellers</TableCell></TableRow>
                ) : paged.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-medium text-neutral-1"><Link to={`/admin/sellers/${s.user_id}`} className="hover:text-primary hover:underline">{s.store_name}</Link></TableCell>
                    <TableCell className="text-neutral-2">{s.business_name ?? "—"}</TableCell>
                    <TableCell className="text-right">{s.product_count}</TableCell>
                    <TableCell className="text-right">${Number(s.total_revenue).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${Number(s.payout_balance).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="secondary">{s.kyc_status.replace("_", " ")}</Badge></TableCell>
                    <TableCell>{approvalBadge(s.approval_status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {s.approval_status === "pending" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => decide(s.user_id, "approved")}>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => decide(s.user_id, "rejected")}>
                              <XCircle className="h-4 w-4 text-destructive-foreground" />
                            </Button>
                          </>
                        )}
                        {s.status === "active" ? (
                          <Button variant="ghost" size="sm" onClick={() => setUserStatus(s.user_id, "suspended")}>
                            <ShieldOff className="h-4 w-4" />
                          </Button>
                        ) : s.status === "suspended" ? (
                          <Button variant="ghost" size="sm" onClick={() => setUserStatus(s.user_id, "active")}>
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => setUserStatus(s.user_id, "banned")}>
                          <Ban className="h-4 w-4 text-destructive-foreground" />
                        </Button>
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
