import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, CheckCircle2, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { DetailHeader } from "@/components/admin/DetailHeader";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [shopper, setShopper] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: o } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    if (!o) { setLoading(false); return; }
    setOrder(o);
    const [{ data: it }, { data: sp }, { data: sl }] = await Promise.all([
      supabase.from("order_items").select("id, qty, price, product_id").eq("order_id", id),
      supabase.from("profiles").select("id, full_name, phone").eq("id", o.shopper_id).maybeSingle(),
      supabase.from("seller_profiles").select("user_id, store_name").eq("user_id", o.seller_id).maybeSingle(),
    ]);
    const productIds = (it ?? []).map((x) => x.product_id);
    const { data: prods } = productIds.length
      ? await supabase.from("products").select("id, title").in("id", productIds)
      : { data: [] };
    const pm = new Map((prods ?? []).map((p) => [p.id, p.title]));
    setItems((it ?? []).map((x) => ({ ...x, title: pm.get(x.product_id) ?? "—" })));
    setShopper(sp); setSeller(sl);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const setStatus = async (newStatus: string) => {
    if (!id) return;
    const { error } = await supabase.from("orders").update({ status: newStatus as "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "returned" | "disputed" }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`order.${newStatus}`, "order", id);
    toast({ title: "Order updated" });
    load();
  };

  if (loading) return <Skeleton className="h-96" />;
  if (!order) return <div className="text-neutral-2">Order not found.</div>;

  const orderBadge = (s: string) => {
    const map: Record<string, "success" | "warning" | "destructive" | "secondary" | "info"> = {
      delivered: "success", confirmed: "info", shipped: "info",
      pending: "warning", cancelled: "destructive", returned: "destructive", disputed: "destructive",
    };
    return <Badge variant={map[s] ?? "secondary"}>{s}</Badge>;
  };
  const addr = order.shipping_address as { line1?: string; city?: string; country?: string; zip?: string } | null;

  return (
    <div className="space-y-6">
      <DetailHeader backTo="/admin/orders" backLabel="Orders" title={`Order ${order.id.slice(0, 8)}`} subtitle={new Date(order.created_at).toLocaleString()}>
        {["pending", "confirmed"].includes(order.status) && (
          <Button variant="primary" onClick={() => setStatus("shipped")}><Truck className="h-4 w-4" /> Mark shipped</Button>
        )}
        {order.status === "shipped" && (
          <Button variant="primary" onClick={() => setStatus("delivered")}><CheckCircle2 className="h-4 w-4" /> Mark delivered</Button>
        )}
        {!["cancelled", "delivered", "returned"].includes(order.status) && (
          <Button variant="destructive" onClick={() => setStatus("cancelled")}><XCircle className="h-4 w-4" /> Cancel</Button>
        )}
      </DetailHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Order">{orderBadge(order.status)}</Field>
            <Field label="Payment"><Badge variant="secondary">{order.payment_status}</Badge></Field>
            <Field label="Shipping"><Badge variant="secondary">{order.shipping_status}</Badge></Field>
            <Field label="Carrier">{order.carrier ?? "—"}</Field>
            <Field label="Tracking">{order.tracking_number ?? "—"}</Field>
            <Field label="Method">{order.payment_method ?? "—"}</Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Parties</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Shopper">
              {shopper ? <Link className="text-primary hover:underline" to={`/admin/shoppers/${shopper.id}`}>{shopper.full_name ?? "—"}</Link> : "—"}
            </Field>
            <Field label="Phone">{shopper?.phone ?? "—"}</Field>
            <Field label="Seller">
              {seller ? <Link className="text-primary hover:underline" to={`/admin/sellers/${seller.user_id}`}>{seller.store_name}</Link> : "—"}
            </Field>
            <Field label="Ship to">
              {addr ? `${addr.line1 ?? ""}, ${addr.city ?? ""} ${addr.zip ?? ""} ${addr.country ?? ""}`.trim() : "—"}
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Subtotal">${Number(order.subtotal).toFixed(2)}</Field>
            <Field label="Shipping">${Number(order.shipping).toFixed(2)}</Field>
            <Field label="Discount">-${Number(order.discount).toFixed(2)}</Field>
            <Field label="Total"><span className="text-h3">${Number(order.total).toFixed(2)}</span></Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow className="bg-neutral-7 hover:bg-neutral-7"><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-neutral-4 py-6">No items</TableCell></TableRow> :
                items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell><Link to={`/admin/products/${it.product_id}`} className="text-primary hover:underline">{it.title}</Link></TableCell>
                    <TableCell className="text-right">{it.qty}</TableCell>
                    <TableCell className="text-right">${Number(it.price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${(Number(it.price) * it.qty).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {order.notes && (
        <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p className="text-body text-neutral-1 whitespace-pre-wrap">{order.notes}</p></CardContent></Card>
      )}
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
