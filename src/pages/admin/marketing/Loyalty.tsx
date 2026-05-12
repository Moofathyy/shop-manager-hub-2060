import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type Cfg = { points_per_dollar: number; redemption_rate: number; expiry_months: number };
type Pts = { user_id: string; balance: number; lifetime_earned: number };

export default function Loyalty() {
  const [cfg, setCfg] = useState<Cfg>({ points_per_dollar: 1, redemption_rate: 0.01, expiry_months: 12 });
  const [pts, setPts] = useState<Pts[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [adj, setAdj] = useState<{ user_id: string; name: string } | null>(null);
  const [adjForm, setAdjForm] = useState({ delta: 0, reason: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: p }, { data: profs }] = await Promise.all([
      supabase.from("loyalty_config").select("*").maybeSingle(),
      supabase.from("loyalty_points").select("*").order("balance", { ascending: false }).limit(50),
      supabase.from("profiles").select("id, full_name"),
    ]);
    if (c) setCfg(c);
    setPts((p ?? []) as Pts[]);
    setNames(new Map((profs ?? []).map((x) => [x.id, x.full_name ?? "—"])));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { error } = await supabase.from("loyalty_config").upsert({ id: 1, ...cfg, updated_at: new Date().toISOString() });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("loyalty.config", "loyalty_config", null, cfg as never);
    toast({ title: "Settings saved" });
  };

  const apply = async () => {
    if (!adj || !adjForm.reason) return toast({ title: "Reason required", variant: "destructive" });
    const current = pts.find((p) => p.user_id === adj.user_id);
    const newBal = (current?.balance ?? 0) + adjForm.delta;
    const newLifetime = (current?.lifetime_earned ?? 0) + Math.max(adjForm.delta, 0);
    await supabase.from("loyalty_points").upsert({ user_id: adj.user_id, balance: newBal, lifetime_earned: newLifetime, updated_at: new Date().toISOString() });
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("loyalty_adjustments").insert({ user_id: adj.user_id, admin_id: user?.id, delta: adjForm.delta, reason: adjForm.reason });
    await logAudit("loyalty.adjust", "loyalty_points", adj.user_id, { delta: adjForm.delta, reason: adjForm.reason });
    toast({ title: "Adjusted" });
    setAdj(null); setAdjForm({ delta: 0, reason: "" }); load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1"><CardContent className="p-6 space-y-3">
        <h3 className="text-h3">Program settings</h3>
        <div><Label>Points per $1 spent</Label><Input type="number" value={cfg.points_per_dollar} onChange={(e) => setCfg({ ...cfg, points_per_dollar: Number(e.target.value) })} /></div>
        <div><Label>Redemption rate ($/point)</Label><Input type="number" step="0.01" value={cfg.redemption_rate} onChange={(e) => setCfg({ ...cfg, redemption_rate: Number(e.target.value) })} /></div>
        <div><Label>Points expiry (months)</Label><Input type="number" value={cfg.expiry_months} onChange={(e) => setCfg({ ...cfg, expiry_months: Number(e.target.value) })} /></div>
        <Button onClick={save} className="w-full">Save</Button>
      </CardContent></Card>

      <div className="lg:col-span-2">
        <h3 className="text-h3 mb-3">Top loyalty users</h3>
        {loading ? <Skeleton className="h-40" /> : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Balance</TableHead><TableHead>Lifetime</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {pts.map((p) => (
                  <TableRow key={p.user_id}>
                    <TableCell className="font-medium">{names.get(p.user_id) ?? p.user_id.slice(0, 8)}</TableCell>
                    <TableCell>{p.balance.toLocaleString()}</TableCell>
                    <TableCell>{p.lifetime_earned.toLocaleString()}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setAdj({ user_id: p.user_id, name: names.get(p.user_id) ?? "user" })}>Adjust</Button></TableCell>
                  </TableRow>
                ))}
                {pts.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-neutral-4 py-12">No data</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>

      <Dialog open={!!adj} onOpenChange={(o) => !o && setAdj(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust points — {adj?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Delta (use negative to deduct)</Label><Input type="number" value={adjForm.delta} onChange={(e) => setAdjForm({ ...adjForm, delta: Number(e.target.value) })} /></div>
            <div><Label>Reason</Label><Textarea value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setAdj(null)}>Cancel</Button><Button onClick={apply}>Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
