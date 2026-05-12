import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type N = { id: string; channel: string; audience: string; subject: string | null; body: string; status: string; scheduled_for: string | null; sent_at: string | null; recipient_count: number; open_count: number; click_count: number };
type Tpl = { id: string; key: string; name: string; channel: string; subject: string | null; body: string };

export default function Notifications() {
  const [rows, setRows] = useState<N[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ channel: "email", audience: "all_shoppers", subject: "", body: "", scheduled_for: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: ns }, { data: ts }] = await Promise.all([
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("notification_templates").select("*"),
    ]);
    setRows((ns ?? []) as N[]); setTpls((ts ?? []) as Tpl[]); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const useTpl = (key: string) => {
    const t = tpls.find((x) => x.key === key); if (!t) return;
    setForm((f) => ({ ...f, channel: t.channel, subject: t.subject ?? "", body: t.body }));
  };

  const send = async (schedule: boolean) => {
    if (!form.body) return toast({ title: "Body required", variant: "destructive" });
    const status = schedule ? "scheduled" : "sent";
    const payload = {
      channel: form.channel as "push" | "email",
      audience: form.audience as "all_shoppers" | "all_sellers" | "segment",
      subject: form.subject || null,
      body: form.body,
      scheduled_for: schedule ? form.scheduled_for || null : null,
      sent_at: schedule ? null : new Date().toISOString(),
      status: status as "scheduled" | "sent",
      recipient_count: form.audience === "all_sellers" ? 8 : 20,
    };
    const { error, data } = await supabase.from("notifications").insert(payload).select().single();
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("notification." + status, "notification", data!.id, payload);
    toast({ title: schedule ? "Scheduled" : "Sent" });
    setForm({ channel: "email", audience: "all_shoppers", subject: "", body: "", scheduled_for: "" }); load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardContent className="p-6 space-y-4">
        <h3 className="text-h3">Compose</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Channel</Label>
            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="push">Push</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label>Audience</Label>
            <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_shoppers">All shoppers</SelectItem>
                <SelectItem value="all_sellers">All sellers</SelectItem>
                <SelectItem value="segment">Segment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {tpls.length > 0 && (
          <div>
            <Label>Use template</Label>
            <Select onValueChange={useTpl}>
              <SelectTrigger><SelectValue placeholder="Pick a template…" /></SelectTrigger>
              <SelectContent>{tpls.map((t) => <SelectItem key={t.id} value={t.key}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
        <div><Label>Body</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <div><Label>Schedule for (optional)</Label><Input type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} /></div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => send(true)} disabled={!form.scheduled_for}>Schedule</Button>
          <Button onClick={() => send(false)}>Send now</Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-6 space-y-3">
        <h3 className="text-h3">Templates</h3>
        {tpls.map((t) => (
          <div key={t.id} className="p-3 border border-neutral-6 rounded-input">
            <div className="font-semibold text-body">{t.name}</div>
            <div className="text-caption text-neutral-4">{t.channel} · {t.key}</div>
          </div>
        ))}
        {tpls.length === 0 && <div className="text-caption text-neutral-4">No templates</div>}
      </CardContent></Card>

      <div className="lg:col-span-3">
        <h3 className="text-h3 mb-3">History</h3>
        {loading ? <Skeleton className="h-40" /> : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Channel</TableHead><TableHead>Audience</TableHead><TableHead>Recipients</TableHead><TableHead>Open</TableHead><TableHead>Click</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.subject ?? "(no subject)"}</TableCell>
                    <TableCell>{n.channel}</TableCell>
                    <TableCell>{n.audience}</TableCell>
                    <TableCell>{n.recipient_count}</TableCell>
                    <TableCell>{n.recipient_count ? `${Math.round((n.open_count / n.recipient_count) * 100)}%` : "—"}</TableCell>
                    <TableCell>{n.recipient_count ? `${Math.round((n.click_count / n.recipient_count) * 100)}%` : "—"}</TableCell>
                    <TableCell><Badge variant={n.status === "sent" ? "success" : n.status === "scheduled" ? "warning" : "secondary"}>{n.status}</Badge></TableCell>
                    <TableCell className="text-caption">{n.sent_at ? new Date(n.sent_at).toLocaleString() : n.scheduled_for ? new Date(n.scheduled_for).toLocaleString() : "—"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-neutral-4 py-12">No notifications</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
