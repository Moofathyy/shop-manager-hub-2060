import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type Cfg = { referrer_reward: number; referee_reward: number; expiry_days: number; max_per_user: number };
type Ref = { id: string; referrer_id: string; referee_id: string; status: string; reward_paid: number; created_at: string };

export default function Referral() {
  const [cfg, setCfg] = useState<Cfg>({ referrer_reward: 10, referee_reward: 5, expiry_days: 30, max_per_user: 50 });
  const [refs, setRefs] = useState<Ref[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: r }, { data: profs }] = await Promise.all([
      supabase.from("referral_config").select("*").maybeSingle(),
      supabase.from("referrals").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);
    if (c) setCfg(c);
    setRefs((r ?? []) as Ref[]);
    setNames(new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "—"])));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { error } = await supabase.from("referral_config").upsert({ id: 1, ...cfg, updated_at: new Date().toISOString() });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("referral.config", "referral_config", null, cfg as never);
    toast({ title: "Settings saved" });
  };

  const totals = {
    total: refs.length,
    completed: refs.filter((r) => r.status === "completed").length,
    paid: refs.reduce((s, r) => s + Number(r.reward_paid), 0),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1"><CardContent className="p-6 space-y-3">
        <h3 className="text-h3">Program settings</h3>
        <div><Label>Referrer reward ($)</Label><Input type="number" value={cfg.referrer_reward} onChange={(e) => setCfg({ ...cfg, referrer_reward: Number(e.target.value) })} /></div>
        <div><Label>Referee reward ($)</Label><Input type="number" value={cfg.referee_reward} onChange={(e) => setCfg({ ...cfg, referee_reward: Number(e.target.value) })} /></div>
        <div><Label>Expiry (days)</Label><Input type="number" value={cfg.expiry_days} onChange={(e) => setCfg({ ...cfg, expiry_days: Number(e.target.value) })} /></div>
        <div><Label>Max rewards per user</Label><Input type="number" value={cfg.max_per_user} onChange={(e) => setCfg({ ...cfg, max_per_user: Number(e.target.value) })} /></div>
        <Button onClick={save} className="w-full">Save</Button>
      </CardContent></Card>

      <div className="lg:col-span-2 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><div className="text-caption text-neutral-4">Total referrals</div><div className="text-h2">{totals.total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-caption text-neutral-4">Completed</div><div className="text-h2 text-success">{totals.completed}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-caption text-neutral-4">Paid out</div><div className="text-h2">${totals.paid.toFixed(2)}</div></CardContent></Card>
        </div>
        {loading ? <Skeleton className="h-40" /> : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Referrer</TableHead><TableHead>Referee</TableHead><TableHead>Status</TableHead><TableHead>Reward</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {refs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{names.get(r.referrer_id) ?? "—"}</TableCell>
                    <TableCell>{names.get(r.referee_id) ?? "—"}</TableCell>
                    <TableCell><Badge variant={r.status === "completed" ? "success" : r.status === "expired" ? "secondary" : "warning"}>{r.status}</Badge></TableCell>
                    <TableCell>${Number(r.reward_paid).toFixed(2)}</TableCell>
                    <TableCell className="text-caption">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {refs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-neutral-4 py-12">No referrals</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
