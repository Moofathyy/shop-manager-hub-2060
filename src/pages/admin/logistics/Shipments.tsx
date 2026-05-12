import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, AlertTriangle, CheckCircle2, Clock, RotateCcw, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type Status = "pending" | "in_transit" | "delivered" | "delayed" | "failed" | "returned";

interface Shipment {
  id: string; order_id: string | null; carrier_id: string | null; zone_id: string | null;
  tracking_number: string | null; status: Status; estimated_delivery: string | null;
  delivered_at: string | null; failure_reason: string | null; cost: number; created_at: string;
}

const STATUS_STYLE: Record<Status, "secondary" | "warning" | "success" | "destructive"> = {
  pending: "secondary", in_transit: "warning", delayed: "warning",
  delivered: "success", failed: "destructive", returned: "destructive",
};

export default function Shipments() {
  const [rows, setRows] = useState<Shipment[]>([]);
  const [carriers, setCarriers] = useState<{ id: string; name: string }[]>([]);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<Status | "all">("all");
  const [carrier, setCarrier] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [drawer, setDrawer] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: c }, { data: z }] = await Promise.all([
      supabase.from("shipments").select("*").order("created_at", { ascending: false }),
      supabase.from("shipping_carriers").select("id, name"),
      supabase.from("delivery_zones").select("id, name"),
    ]);
    setRows((s ?? []) as Shipment[]);
    setCarriers(c ?? []);
    setZones(z ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openDrawer = async (s: Shipment) => {
    setDrawer(s);
    const { data } = await supabase.from("shipment_events").select("*").eq("shipment_id", s.id).order("created_at", { ascending: true });
    setEvents(data ?? []);
  };

  const filtered = useMemo(() => rows.filter((r) =>
    (status === "all" || r.status === status) &&
    (carrier === "all" || r.carrier_id === carrier) &&
    (!search || (r.tracking_number ?? "").toLowerCase().includes(search.toLowerCase()))
  ), [rows, status, carrier, search]);

  const counts = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return {
      inTransit: rows.filter((r) => r.status === "in_transit").length,
      delayed: rows.filter((r) => r.status === "delayed").length,
      deliveredToday: rows.filter((r) => r.status === "delivered" && r.delivered_at?.startsWith(today)).length,
      failed: rows.filter((r) => r.status === "failed").length,
    };
  }, [rows]);

  const carrierName = (id: string | null) => id ? carriers.find((c) => c.id === id)?.name ?? "—" : "—";
  const zoneName = (id: string | null) => id ? zones.find((z) => z.id === id)?.name ?? "—" : "—";

  const reDeliver = async (s: Shipment) => {
    await supabase.from("shipments").update({ status: "pending", failure_reason: null }).eq("id", s.id);
    await supabase.from("shipment_events").insert({ shipment_id: s.id, status: "pending", location: "Local hub", note: "Re-delivery scheduled" });
    await logAudit("shipment.redeliver", "shipment", s.id);
    toast({ title: "Re-delivery scheduled" });
    setDrawer(null); load();
  };

  const returnToSeller = async (s: Shipment) => {
    await supabase.from("shipments").update({ status: "returned" }).eq("id", s.id);
    await supabase.from("shipment_events").insert({ shipment_id: s.id, status: "returned", location: "Local hub", note: "Returned to seller" });
    await logAudit("shipment.return_to_seller", "shipment", s.id);
    toast({ title: "Shipment returned to seller" });
    setDrawer(null); load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Truck, label: "In transit", value: counts.inTransit, color: "text-warning" },
          { icon: Clock, label: "Delayed", value: counts.delayed, color: "text-warning" },
          { icon: CheckCircle2, label: "Delivered today", value: counts.deliveredToday, color: "text-success" },
          { icon: AlertTriangle, label: "Failed", value: counts.failed, color: "text-destructive-foreground" },
        ].map((k) => (
          <Card key={k.label}><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-input bg-neutral-7 flex items-center justify-center"><k.icon className={`h-5 w-5 ${k.color}`} /></div>
            <div><div className="text-h2 font-bold">{k.value}</div><div className="text-caption text-neutral-3">{k.label}</div></div>
          </CardContent></Card>
        ))}
      </div>

      <Card><CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search tracking #" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["pending","in_transit","delivered","delayed","failed","returned"] as Status[]).map((s) =>
                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={carrier} onValueChange={setCarrier}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Carrier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All carriers</SelectItem>
              {carriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? <Skeleton className="h-60" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tracking</TableHead><TableHead>Order</TableHead><TableHead>Carrier</TableHead>
              <TableHead>Zone</TableHead><TableHead>Status</TableHead><TableHead>ETA</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => openDrawer(s)}>
                  <TableCell className="font-mono text-caption">{s.tracking_number ?? "—"}</TableCell>
                  <TableCell>{s.order_id ? <Link to={`/admin/orders/${s.order_id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>View order</Link> : <span className="text-neutral-4">—</span>}</TableCell>
                  <TableCell>{carrierName(s.carrier_id)}</TableCell>
                  <TableCell>{zoneName(s.zone_id)}</TableCell>
                  <TableCell><Badge variant={STATUS_STYLE[s.status]}>{s.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-caption">{s.estimated_delivery ? format(new Date(s.estimated_delivery), "PP") : "—"}</TableCell>
                  <TableCell className="text-right">${Number(s.cost).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-neutral-4 py-8">No shipments</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader><SheetTitle>Shipment {drawer?.tracking_number}</SheetTitle></SheetHeader>
          {drawer && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-caption">
                <div><span className="text-neutral-3">Status</span><div><Badge variant={STATUS_STYLE[drawer.status]}>{drawer.status.replace("_", " ")}</Badge></div></div>
                <div><span className="text-neutral-3">Carrier</span><div className="text-neutral-1">{carrierName(drawer.carrier_id)}</div></div>
                <div><span className="text-neutral-3">Zone</span><div className="text-neutral-1">{zoneName(drawer.zone_id)}</div></div>
                <div><span className="text-neutral-3">Cost</span><div className="text-neutral-1">${Number(drawer.cost).toFixed(2)}</div></div>
                <div><span className="text-neutral-3">ETA</span><div className="text-neutral-1">{drawer.estimated_delivery ? format(new Date(drawer.estimated_delivery), "PPp") : "—"}</div></div>
                <div><span className="text-neutral-3">Delivered</span><div className="text-neutral-1">{drawer.delivered_at ? format(new Date(drawer.delivered_at), "PPp") : "—"}</div></div>
              </div>
              {drawer.failure_reason && <div className="p-3 rounded-input bg-destructive/10 text-destructive-foreground text-caption"><AlertTriangle className="h-4 w-4 inline mr-1" /> {drawer.failure_reason}</div>}

              <div>
                <h4 className="text-body font-semibold mb-2">Tracking timeline</h4>
                <ol className="relative border-l border-neutral-6 ml-2 space-y-3">
                  {events.map((e) => (
                    <li key={e.id} className="ml-4">
                      <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary mt-1.5" />
                      <div className="text-body capitalize">{e.status.replace("_", " ")}</div>
                      <div className="text-caption text-neutral-3">{e.location} {e.note && `· ${e.note}`}</div>
                      <div className="text-caption text-neutral-4">{format(new Date(e.created_at), "PPp")}</div>
                    </li>
                  ))}
                  {events.length === 0 && <li className="ml-4 text-neutral-4 text-caption">No events recorded</li>}
                </ol>
              </div>

              {(drawer.status === "failed" || drawer.status === "delayed") && (
                <div className="flex gap-2 pt-2 border-t border-neutral-6">
                  <Button onClick={() => reDeliver(drawer)} className="flex-1"><RotateCcw className="h-4 w-4" /> Re-deliver</Button>
                  <Button variant="outline" onClick={() => returnToSeller(drawer)} className="flex-1"><Undo2 className="h-4 w-4" /> Return to seller</Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
