import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, XCircle, EyeOff, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  id: string;
  title: string;
  price: number;
  stock: number;
  status: string;
  category_id: string | null;
  seller_id: string;
  created_at: string;
  store_name?: string;
  category_name?: string;
}

const statusBadge = (s: string) => {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    approved: "success", pending: "warning", rejected: "destructive", unpublished: "secondary", out_of_stock: "secondary",
  };
  return <Badge variant={map[s] ?? "secondary"}>{s.replace("_", " ")}</Badge>;
};

export default function Products() {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [category, setCategory] = useState("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: s }, { data: c }] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("seller_profiles").select("user_id, store_name"),
      supabase.from("categories").select("id, name").order("sort_order"),
    ]);
    const sm = new Map((s ?? []).map((x) => [x.user_id, x.store_name]));
    const cm = new Map((c ?? []).map((x) => [x.id, x.name]));
    setCategories(c ?? []);
    setRows((p ?? []).map((x) => ({ ...x, store_name: sm.get(x.seller_id), category_name: x.category_id ? cm.get(x.category_id) : "—" })));
    setLoading(false);
    setSelected(new Set());
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (tab !== "all" && r.status !== tab) return false;
    if (category !== "all" && r.category_id !== category) return false;
    if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const setStatus = async (ids: string[], status: string, action: string) => {
    const { error } = await supabase.from("products").update({ status }).in("id", ids);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await Promise.all(ids.map((id) => logAudit(`product.${action}`, "product", id)));
    toast({ title: `${ids.length} product(s) ${action}` });
    load();
  };

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Products</h1>
        <p className="text-body text-neutral-2 mt-1">{filtered.length} products</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-neutral-7">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending approval</TabsTrigger>
          <TabsTrigger value="approved">Live</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="unpublished">Unpublished</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-4" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="pl-9 h-11" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[200px] h-11 rounded-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selected.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-caption text-neutral-2">{selected.size} selected</span>
                <Button size="sm" variant="primary" onClick={() => setStatus([...selected], "approved", "approve")}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setStatus([...selected], "rejected", "reject")}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-input border border-neutral-6">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-7 hover:bg-neutral-7">
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6" /></TableCell></TableRow>
                )) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-neutral-4 py-12">No products</TableCell></TableRow>
                ) : filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} /></TableCell>
                    <TableCell className="font-medium text-neutral-1">{p.title}</TableCell>
                    <TableCell className="text-neutral-2">{p.store_name ?? "—"}</TableCell>
                    <TableCell className="text-neutral-2">{p.category_name ?? "—"}</TableCell>
                    <TableCell className="text-right">${Number(p.price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{p.stock}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.status === "pending" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setStatus([p.id], "approved", "approve")}>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setStatus([p.id], "rejected", "reject")}>
                              <XCircle className="h-4 w-4 text-destructive-foreground" />
                            </Button>
                          </>
                        )}
                        {p.status === "approved" && (
                          <Button variant="ghost" size="sm" onClick={() => setStatus([p.id], "unpublished", "unpublish")}>
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        )}
                        {p.status === "unpublished" && (
                          <Button variant="ghost" size="sm" onClick={() => setStatus([p.id], "approved", "republish")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
