import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type Coupon = {
  id: string; code: string; description: string | null;
  discount_type: "percentage" | "fixed"; discount_value: number;
  min_order_value: number; max_uses: number | null; used_count: number;
  expires_at: string | null; status: "active" | "paused" | "expired";
};

export default function Coupons() {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", discount_type: "percentage", discount_value: 10, min_order_value: 0, max_uses: "", expires_at: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Coupon[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => tab === "all" || r.status === tab);

  const create = async () => {
    if (!form.code) return toast({ title: "Code required", variant: "destructive" });
    const payload = {
      code: form.code.toUpperCase(),
      description: form.description || null,
      discount_type: form.discount_type as "percentage" | "fixed",
      discount_value: Number(form.discount_value),
      min_order_value: Number(form.min_order_value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
    };
    const { error, data } = await supabase.from("coupons").insert(payload).select().single();
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("coupon.create", "coupon", data!.id, payload);
    toast({ title: "Coupon created" });
    setOpen(false);
    setForm({ code: "", description: "", discount_type: "percentage", discount_value: 10, min_order_value: 0, max_uses: "", expires_at: "" });
    load();
  };

  const toggle = async (c: Coupon) => {
    const next = c.status === "active" ? "paused" : "active";
    await supabase.from("coupons").update({ status: next }).eq("id", c.id);
    await logAudit("coupon.toggle", "coupon", c.id, { from: c.status, to: next });
    load();
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    await supabase.from("coupons").delete().eq("id", c.id);
    await logAudit("coupon.delete", "coupon", c.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New coupon</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create coupon</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SUMMER25" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Value</Label><Input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Min order value</Label><Input type="number" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: Number(e.target.value) })} /></div>
                <div><Label>Max uses</Label><Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Unlimited" /></div>
              </div>
              <div><Label>Expires at</Label><Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <Skeleton className="h-40" /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead>Min order</TableHead>
              <TableHead>Used</TableHead><TableHead>Expires</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                  <TableCell>{c.discount_type === "percentage" ? `${c.discount_value}%` : `$${c.discount_value}`}</TableCell>
                  <TableCell>${c.min_order_value}</TableCell>
                  <TableCell>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</TableCell>
                  <TableCell>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell><Badge variant={c.status === "active" ? "success" : c.status === "paused" ? "warning" : "secondary"}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => toggle(c)} disabled={c.status === "expired"}>
                      {c.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-neutral-4 py-12">No coupons</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
