import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Star, Flag, Eye, EyeOff } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";

interface Review {
  id: string; reviewer_id: string; target_type: string; target_id: string;
  rating: number; content: string | null; status: string; created_at: string;
  reviewer_name?: string;
}
interface Dispute {
  id: string; order_id: string; shopper_id: string; seller_id: string; reason: string;
  status: string; resolution: string | null; created_at: string;
  shopper_name?: string; seller_name?: string;
}

const reviewBadge = (s: string) => {
  const map: Record<string, "success" | "warning" | "destructive"> = {
    published: "success", flagged: "warning", removed: "destructive",
  };
  return <Badge variant={map[s] ?? "warning"}>{s}</Badge>;
};

const stars = (n: number) => (
  <div className="flex">
    {[1,2,3,4,5].map((i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? "fill-warning text-warning" : "text-neutral-6"}`} />
    ))}
  </div>
);

export default function Reviews() {
  const [tab, setTab] = useState("reviews");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Reviews & Trust</h1>
        <p className="text-body text-neutral-2 mt-1">Moderate reviews and resolve disputes.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-neutral-7">
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
        </TabsList>
        <TabsContent value="reviews" className="mt-4"><ReviewsTab /></TabsContent>
        <TabsContent value="disputes" className="mt-4"><DisputesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ReviewsTab() {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [rating, setRating] = useState("all");

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: profiles }] = await Promise.all([
      supabase.from("reviews").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const m = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    setRows((r ?? []).map((x) => ({ ...x, reviewer_name: m.get(x.reviewer_id) ?? "Anonymous" })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatusOf = async (id: string, status: "published" | "flagged" | "removed") => {
    const { error } = await supabase.from("reviews").update({ status }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`review.${status}`, "review", id);
    toast({ title: "Review updated" });
    load();
  };

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (rating !== "all" && r.rating !== Number(rating)) return false;
    if (q && !(r.content ?? "").toLowerCase().includes(q.toLowerCase()) && !(r.reviewer_name ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const { paged, page, pageSize, total, setPage, setPageSize } = usePagination(filtered, 25, `${q}|${status}|${rating}`);

  return (
    <Card><CardContent className="p-4">
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-4" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 h-11" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] h-11 rounded-input"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={rating} onValueChange={setRating}>
          <SelectTrigger className="w-[140px] h-11 rounded-input"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any rating</SelectItem>
            {[5,4,3,2,1].map((n) => <SelectItem key={n} value={String(n)}>{n} stars</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-input border border-neutral-6">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-7 hover:bg-neutral-7">
              <TableHead>Reviewer</TableHead><TableHead>Rating</TableHead>
              <TableHead>Target</TableHead><TableHead>Content</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-6" /></TableCell></TableRow> :
              filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-neutral-4 py-12">No reviews</TableCell></TableRow> :
                paged.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.reviewer_name}</TableCell>
                    <TableCell>{stars(r.rating)}</TableCell>
                    <TableCell><Badge variant="secondary">{r.target_type}</Badge></TableCell>
                    <TableCell className="text-neutral-2 max-w-md truncate">{r.content ?? "—"}</TableCell>
                    <TableCell>{reviewBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status !== "published" && (
                          <Button size="sm" variant="ghost" onClick={() => setStatusOf(r.id, "published")}><Eye className="h-4 w-4 text-success" /></Button>
                        )}
                        {r.status !== "flagged" && (
                          <Button size="sm" variant="ghost" onClick={() => setStatusOf(r.id, "flagged")}><Flag className="h-4 w-4 text-warning-text" /></Button>
                        )}
                        {r.status !== "removed" && (
                          <Button size="sm" variant="ghost" onClick={() => setStatusOf(r.id, "removed")}><EyeOff className="h-4 w-4 text-destructive-foreground" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </CardContent></Card>
  );
}

function DisputesTab() {
  const [rows, setRows] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: profiles }, { data: sellers }] = await Promise.all([
      supabase.from("disputes").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("seller_profiles").select("user_id, store_name"),
    ]);
    const pm = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const sm = new Map((sellers ?? []).map((s) => [s.user_id, s.store_name]));
    setRows((d ?? []).map((x) => ({ ...x, shopper_name: pm.get(x.shopper_id) ?? "—", seller_name: sm.get(x.seller_id) ?? "—" })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resolve = async (id: string, decision: "resolved_shopper" | "resolved_seller" | "resolved_split") => {
    const u = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("disputes").update({
      status: decision, resolution: decision.replace("resolved_", ""),
      resolved_by: u?.id ?? null, resolved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`dispute.${decision}`, "dispute", id);
    toast({ title: "Dispute resolved" });
    load();
  };

  return (
    <Card><CardContent className="p-4 space-y-3">
      {loading ? <Skeleton className="h-32" /> : rows.length === 0 ? (
        <div className="py-16 text-center text-neutral-4">No active disputes</div>
      ) : rows.map((d) => (
        <div key={d.id} className="p-4 rounded-input border border-neutral-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={d.status === "open" ? "warning" : "success"}>{d.status.replace("_", " ")}</Badge>
                <span className="text-caption text-neutral-2">Order {d.order_id.slice(0, 8)}</span>
              </div>
              <p className="text-body text-neutral-1 mt-2">{d.reason}</p>
              <p className="text-caption text-neutral-2 mt-1">
                Shopper: {d.shopper_name} · Seller: {d.seller_name}
              </p>
            </div>
            {d.status === "open" || d.status === "in_review" ? (
              <div className="flex gap-1">
                <Button size="sm" variant="primary" onClick={() => resolve(d.id, "resolved_shopper")}>Side: shopper</Button>
                <Button size="sm" variant="secondary" onClick={() => resolve(d.id, "resolved_seller")}>Side: seller</Button>
                <Button size="sm" variant="ghost" onClick={() => resolve(d.id, "resolved_split")}>Split</Button>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </CardContent></Card>
  );
}
