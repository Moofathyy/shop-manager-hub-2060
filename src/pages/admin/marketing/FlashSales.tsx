import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type Sale = { id: string; title: string; description: string | null; starts_at: string; ends_at: string; discount_percentage: number; status: string; product_ids: string[] };

export default function FlashSales() {
  const [rows, setRows] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", starts_at: "", ends_at: "", discount_percentage: 20 });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("flash_sales").select("*").order("starts_at", { ascending: false });
    setRows((data ?? []) as Sale[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.starts_at || !form.ends_at) return toast({ title: "Missing fields", variant: "destructive" });
    const payload = { ...form, discount_percentage: Number(form.discount_percentage) };
    const { error, data } = await supabase.from("flash_sales").insert(payload).select().single();
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("flash_sale.create", "flash_sale", data!.id, payload);
    toast({ title: "Flash sale scheduled" });
    setOpen(false); setForm({ title: "", description: "", starts_at: "", ends_at: "", discount_percentage: 20 }); load();
  };

  const remove = async (s: Sale) => {
    if (!confirm(`Delete "${s.title}"?`)) return;
    await supabase.from("flash_sales").delete().eq("id", s.id);
    await logAudit("flash_sale.delete", "flash_sale", s.id); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New flash sale</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule flash sale</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Starts</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><Label>Ends</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>
              <div><Label>Discount %</Label><Input type="number" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: Number(e.target.value) })} /></div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Schedule</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <Skeleton className="h-40" /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Discount</TableHead><TableHead>Window</TableHead><TableHead>Products</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell>{s.discount_percentage}%</TableCell>
                  <TableCell className="text-caption">{new Date(s.starts_at).toLocaleString()} → {new Date(s.ends_at).toLocaleString()}</TableCell>
                  <TableCell>{s.product_ids?.length ?? 0}</TableCell>
                  <TableCell><Badge variant={s.status === "active" ? "success" : s.status === "ended" ? "secondary" : "warning"}>{s.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-neutral-4 py-12">No flash sales</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
