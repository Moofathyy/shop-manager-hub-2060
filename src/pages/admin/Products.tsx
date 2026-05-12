import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, XCircle, EyeOff, Eye, LayoutGrid, List, Package as PackageIcon, MoreHorizontal } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";

interface Product {
  id: string;
  title: string;
  price: number;
  stock: number;
  status: string;
  category_id: string | null;
  seller_id: string;
  created_at: string;
  images?: any;
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
  const [view, setView] = useState<"table" | "cards">("cards");

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
  const { paged, page, pageSize, total, setPage, setPageSize } = usePagination(filtered, view === "cards" ? 12 : 10, `${q}|${tab}|${category}|${view}`);

  const setStatus = async (ids: string[], status: string, action: string) => {
    const { error } = await supabase.from("products").update({ status: status as "pending" | "approved" | "rejected" | "unpublished" | "out_of_stock" }).in("id", ids);
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
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as "table" | "cards")}
              className="border border-neutral-6 rounded-input h-11"
            >
              <ToggleGroupItem value="cards" aria-label="Card view" className="h-11 px-3"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view" className="h-11 px-3"><List className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
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

          {view === "cards" ? (
            loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-card" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-neutral-4">No products</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {paged.map((p) => {
                  const imgs = Array.isArray(p.images) ? p.images : [];
                  const cover = imgs[0];
                  const isSelected = selected.has(p.id);
                  return (
                    <Card key={p.id} className={`overflow-hidden transition-shadow hover:shadow-md ${isSelected ? "ring-2 ring-primary" : ""}`}>
                      <div className="relative aspect-square bg-neutral-7">
                        {cover ? (
                          <img src={cover} alt={p.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-neutral-4">
                            <PackageIcon className="h-10 w-10" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggle(p.id)} className="bg-background" />
                        </div>
                        <div className="absolute top-2 right-2">{statusBadge(p.status)}</div>
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <Link to={`/admin/products/${p.id}`} className="block">
                          <div className="text-label text-neutral-1 line-clamp-2 hover:text-primary min-h-[2.5rem]">{p.title}</div>
                        </Link>
                        <div className="flex items-center justify-between text-caption text-neutral-2">
                          <span className="truncate">{p.store_name ?? "—"}</span>
                          <span className="text-neutral-3">·</span>
                          <span className="truncate">{p.category_name ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="text-label text-neutral-1">${Number(p.price).toFixed(2)}</div>
                          <div className={`text-caption ${p.stock > 0 ? "text-neutral-2" : "text-destructive"}`}>
                            {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                          </div>
                        </div>
                        <div className="flex gap-1 pt-1 border-t border-neutral-6 -mx-3 px-3">
                          {p.status === "pending" && (
                            <>
                              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setStatus([p.id], "approved", "approve")}>
                                <CheckCircle2 className="h-4 w-4 text-success" /> Approve
                              </Button>
                              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setStatus([p.id], "rejected", "reject")}>
                                <XCircle className="h-4 w-4 text-destructive" /> Reject
                              </Button>
                            </>
                          )}
                          {p.status === "approved" && (
                            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setStatus([p.id], "unpublished", "unpublish")}>
                              <EyeOff className="h-4 w-4" /> Unpublish
                            </Button>
                          )}
                          {p.status === "unpublished" && (
                            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setStatus([p.id], "approved", "republish")}>
                              <Eye className="h-4 w-4" /> Republish
                            </Button>
                          )}
                          {(p.status === "rejected" || p.status === "out_of_stock") && (
                            <Button variant="ghost" size="sm" className="flex-1" asChild>
                              <Link to={`/admin/products/${p.id}`}>View details</Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
          ) : (

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
                ) : paged.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} /></TableCell>
                    <TableCell className="font-medium text-neutral-1"><Link to={`/admin/products/${p.id}`} className="hover:text-primary hover:underline">{p.title}</Link></TableCell>
                    <TableCell className="text-neutral-2">{p.store_name ?? "—"}</TableCell>
                    <TableCell className="text-neutral-2">{p.category_name ?? "—"}</TableCell>
                    <TableCell className="text-right">${Number(p.price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{p.stock}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/products/${p.id}`}>
                              <Eye className="h-4 w-4" /> View details
                            </Link>
                          </DropdownMenuItem>
                          {p.status === "pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setStatus([p.id], "approved", "approve")}>
                                <CheckCircle2 className="h-4 w-4 text-success" /> Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setStatus([p.id], "rejected", "reject")} className="text-destructive focus:text-destructive">
                                <XCircle className="h-4 w-4" /> Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {p.status === "approved" && (
                            <DropdownMenuItem onClick={() => setStatus([p.id], "unpublished", "unpublish")}>
                              <EyeOff className="h-4 w-4" /> Unpublish
                            </DropdownMenuItem>
                          )}
                          {p.status === "unpublished" && (
                            <DropdownMenuItem onClick={() => setStatus([p.id], "approved", "republish")}>
                              <Eye className="h-4 w-4" /> Republish
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
          <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
