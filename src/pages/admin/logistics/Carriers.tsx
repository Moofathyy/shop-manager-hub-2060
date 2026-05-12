import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, FlaskConical } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

interface Carrier { id: string; name: string; code: string; api_key: string | null; regions: string[]; default_for_regions: string[]; active: boolean; }
interface Zone { id: string; name: string; }
interface Rate { rate_type: "flat" | "weight" | "free"; flat_amount: number | null; weight_brackets: any[]; }

export default function Carriers() {
  const [rows, setRows] = useState<Carrier[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Carrier | null>(null);
  const [form, setForm] = useState({ name: "", code: "", api_key: "", regions: "", active: true });

  const [testOpen, setTestOpen] = useState(false);
  const [testCarrier, setTestCarrier] = useState<string>("");
  const [testZone, setTestZone] = useState<string>("");
  const [testWeight, setTestWeight] = useState("2");
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: z }] = await Promise.all([
      supabase.from("shipping_carriers").select("*").order("name"),
      supabase.from("delivery_zones").select("id, name").order("name"),
    ]);
    setRows((c ?? []) as Carrier[]);
    setZones((z ?? []) as Zone[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: "", code: "", api_key: "", regions: "", active: true }); setOpen(true); };
  const openEdit = (c: Carrier) => { setEditing(c); setForm({ name: c.name, code: c.code, api_key: c.api_key ?? "", regions: c.regions.join(", "), active: c.active }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) return toast({ title: "Name and code required", variant: "destructive" });
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toLowerCase(),
      api_key: form.api_key.trim() || null,
      regions: form.regions.split(",").map((r) => r.trim()).filter(Boolean),
      active: form.active,
    };
    const { error } = editing
      ? await supabase.from("shipping_carriers").update(payload).eq("id", editing.id)
      : await supabase.from("shipping_carriers").insert(payload);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(editing ? "carrier.update" : "carrier.create", "carrier", editing?.id ?? null, payload);
    toast({ title: editing ? "Carrier updated" : "Carrier created" });
    setOpen(false); load();
  };

  const toggle = async (c: Carrier) => {
    await supabase.from("shipping_carriers").update({ active: !c.active }).eq("id", c.id);
    await logAudit("carrier.toggle", "carrier", c.id, { active: !c.active });
    load();
  };

  const remove = async (c: Carrier) => {
    if (!confirm(`Delete carrier "${c.name}"?`)) return;
    const { error } = await supabase.from("shipping_carriers").delete().eq("id", c.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("carrier.delete", "carrier", c.id);
    load();
  };

  const runTest = async () => {
    setTestResult(null);
    const { data } = await supabase
      .from("shipping_rates")
      .select("*")
      .eq("zone_id", testZone)
      .eq("carrier_id", testCarrier)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const rate = data as Rate | null;
    if (!rate) { setTestResult("No rate configured for this carrier + zone."); return; }
    if (rate.rate_type === "free") { setTestResult("Free shipping"); return; }
    if (rate.rate_type === "flat") { setTestResult(`Flat rate: $${Number(rate.flat_amount).toFixed(2)}`); return; }
    const w = parseFloat(testWeight);
    const brackets = (rate.weight_brackets ?? []).sort((a: any, b: any) => a.maxKg - b.maxKg);
    const match = brackets.find((b: any) => w <= b.maxKg);
    setTestResult(match ? `Weight-based (${w}kg): $${Number(match.price).toFixed(2)}` : "No bracket matches this weight");
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-h3">Shipping carriers</h3>
          <div className="flex gap-2">
            <Dialog open={testOpen} onOpenChange={setTestOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><FlaskConical className="h-4 w-4" /> Test rate</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Test shipping rate</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Carrier</Label>
                    <Select value={testCarrier} onValueChange={setTestCarrier}>
                      <SelectTrigger><SelectValue placeholder="Pick carrier" /></SelectTrigger>
                      <SelectContent>{rows.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Zone</Label>
                    <Select value={testZone} onValueChange={setTestZone}>
                      <SelectTrigger><SelectValue placeholder="Pick zone" /></SelectTrigger>
                      <SelectContent>{zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Weight (kg)</Label><Input type="number" value={testWeight} onChange={(e) => setTestWeight(e.target.value)} /></div>
                  {testResult && <div className="p-3 rounded-input bg-primary-bg text-primary font-medium">{testResult}</div>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTestOpen(false)}>Close</Button>
                  <Button onClick={runTest} disabled={!testCarrier || !testZone}>Calculate</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add carrier</Button>
          </div>
        </div>

        {loading ? <Skeleton className="h-40" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Regions</TableHead>
                <TableHead>Default for</TableHead>
                <TableHead>API key</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-neutral-2">{c.code}</TableCell>
                  <TableCell>{c.regions.map((r) => <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>)}</TableCell>
                  <TableCell>{c.default_for_regions.map((r) => <Badge key={r} variant="success" className="mr-1">{r}</Badge>)}</TableCell>
                  <TableCell className="text-caption text-neutral-4 font-mono">{c.api_key ? `••••${c.api_key.slice(-4)}` : "—"}</TableCell>
                  <TableCell><Switch checked={c.active} onCheckedChange={() => toggle(c)} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive-foreground" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-neutral-4 py-8">No carriers</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit carrier" : "Add carrier"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Code (slug)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="dhl, fedex…" /></div>
              <div><Label>API key</Label><Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} /></div>
              <div><Label>Regions (comma-separated, e.g. NA, EU, ME)</Label><Input value={form.regions} onChange={(e) => setForm({ ...form, regions: e.target.value })} /></div>
              <div className="flex items-center gap-3"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Active</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Save" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
