import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";

interface Category { id: string; name: string; slug: string; parent_id: string | null; sort_order: number; }

export default function Categories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { error } = await supabase.from("categories").insert({ name: name.trim(), slug, sort_order: rows.length });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("category.create", "category", null, { name });
    toast({ title: "Category created" });
    setName("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("category.delete", "category", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Categories</h1>
        <p className="text-body text-neutral-2 mt-1">Manage your product taxonomy.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <form onSubmit={add} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" className="max-w-md" />
            <Button type="submit"><Plus className="h-4 w-4" /> Add</Button>
          </form>
          <div className="overflow-x-auto rounded-input border border-neutral-6">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-7 hover:bg-neutral-7">
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-6" /></TableCell></TableRow> :
                  rows.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-neutral-4 py-8">No categories</TableCell></TableRow> :
                    paged.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-neutral-2">{c.slug}</TableCell>
                        <TableCell className="text-right">{c.sort_order}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                }
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
