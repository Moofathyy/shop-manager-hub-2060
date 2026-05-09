import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldOff, ShieldCheck, Ban } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { DetailHeader } from "@/components/admin/DetailHeader";

export default function ShopperDetail() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: pr }, { data: o }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("orders").select("id, total, status, created_at").eq("shopper_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    setProfile(pr); setOrders(o ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const setStatus = async (newStatus: "active" | "suspended" | "banned", action: string) => {
    if (!id) return;
    const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(action, "shopper", id, { newStatus });
    toast({ title: "Updated" });
    load();
  };

  if (loading) return <Skeleton className="h-96" />;
  if (!profile) return <div className="text-neutral-2">Shopper not found.</div>;

  const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0);
  const statusVariant: "success" | "warning" | "destructive" = (profile.status === "active" ? "success" : profile.status === "suspended" ? "warning" : "destructive");

  return (
    <div className="space-y-6">
      <DetailHeader backTo="/admin/shoppers" backLabel="Shoppers" title={profile.full_name ?? "Unnamed shopper"} subtitle={profile.phone ?? undefined}>
        {profile.status !== "active" && (
          <Button variant="primary" onClick={() => setStatus("active", "shopper.reactivate")}><ShieldCheck className="h-4 w-4" /> Reactivate</Button>
        )}
        {profile.status === "active" && (
          <Button variant="secondary" onClick={() => setStatus("suspended", "shopper.suspend")}><ShieldOff className="h-4 w-4" /> Suspend</Button>
        )}
        {profile.status !== "banned" && (
          <Button variant="destructive" onClick={() => setStatus("banned", "shopper.ban")}><Ban className="h-4 w-4" /> Ban</Button>
        )}
      </DetailHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Status"><Badge variant={statusVariant}>{profile.status}</Badge></Field>
            <Field label="Phone">{profile.phone ?? "—"}</Field>
            <Field label="Country">{profile.country ?? "—"}</Field>
            <Field label="Joined">{new Date(profile.created_at).toLocaleDateString()}</Field>
            <Field label="Last login">{profile.last_login ? new Date(profile.last_login).toLocaleString() : "—"}</Field>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label="Orders" value={orders.length} />
            <Stat label="Total spent" value={`$${totalSpent.toFixed(2)}`} />
            <Stat label="Avg order" value={orders.length ? `$${(totalSpent / orders.length).toFixed(2)}` : "—"} />
            <Stat label="Last order" value={orders[0] ? new Date(orders[0].created_at).toLocaleDateString() : "—"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow className="bg-neutral-7 hover:bg-neutral-7"><TableHead>Order</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {orders.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-neutral-4 py-6">No orders yet</TableCell></TableRow> :
                orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell><Link to={`/admin/orders/${o.id}`} className="text-primary hover:underline font-mono text-caption">{o.id.slice(0, 8)}</Link></TableCell>
                    <TableCell><Badge variant="secondary">{o.status}</Badge></TableCell>
                    <TableCell className="text-right">${Number(o.total).toFixed(2)}</TableCell>
                    <TableCell className="text-neutral-2">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-6 pb-2 last:border-0">
      <span className="text-caption text-neutral-2">{label}</span>
      <span className="text-body text-neutral-1 text-right">{children}</span>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 rounded-input bg-neutral-7">
      <div className="text-caption text-neutral-2">{label}</div>
      <div className="text-h2 text-neutral-1 mt-1">{value}</div>
    </div>
  );
}
