import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, ShieldOff, ShieldCheck, Ban } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { DetailHeader } from "@/components/admin/DetailHeader";

export default function SellerDetail() {
  const { id } = useParams<{ id: string }>();
  const [seller, setSeller] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: s }, { data: pr }, { data: p }, { data: o }] = await Promise.all([
      supabase.from("seller_profiles").select("*").eq("user_id", id).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("products").select("id, title, status, price, stock, sales_count").eq("seller_id", id).order("created_at", { ascending: false }).limit(10),
      supabase.from("orders").select("id, total, status, created_at").eq("seller_id", id).order("created_at", { ascending: false }).limit(10),
    ]);
    setSeller(s); setProfile(pr); setProducts(p ?? []); setOrders(o ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const decide = async (status: "approved" | "rejected") => {
    if (!id) return;
    const { error } = await supabase.from("seller_profiles").update({ approval_status: status }).eq("user_id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`seller.${status}`, "seller", id);
    toast({ title: `Seller ${status}` });
    load();
  };
  const setUserStatus = async (newStatus: "active" | "suspended" | "banned") => {
    if (!id) return;
    const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`seller.${newStatus}`, "seller", id);
    toast({ title: "Updated" });
    load();
  };

  if (loading) return <Skeleton className="h-96" />;
  if (!seller) return <div className="text-neutral-2">Seller not found.</div>;

  const apprVariant: "success" | "destructive" | "warning" = (seller.approval_status === "approved" ? "success" : seller.approval_status === "rejected" ? "destructive" : "warning");

  return (
    <div className="space-y-6">
      <DetailHeader backTo="/admin/sellers" backLabel="Sellers" title={seller.store_name} subtitle={seller.business_name ?? undefined}>
        {seller.approval_status === "pending" && (
          <>
            <Button variant="primary" onClick={() => decide("approved")}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
            <Button variant="destructive" onClick={() => decide("rejected")}><XCircle className="h-4 w-4" /> Reject</Button>
          </>
        )}
        {profile?.status === "active" && (
          <Button variant="secondary" onClick={() => setUserStatus("suspended")}><ShieldOff className="h-4 w-4" /> Suspend</Button>
        )}
        {profile?.status === "suspended" && (
          <Button variant="primary" onClick={() => setUserStatus("active")}><ShieldCheck className="h-4 w-4" /> Reactivate</Button>
        )}
        {profile?.status !== "banned" && (
          <Button variant="destructive" onClick={() => setUserStatus("banned")}><Ban className="h-4 w-4" /> Ban</Button>
        )}
      </DetailHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Store</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Approval"><Badge variant={apprVariant}>{seller.approval_status?.replace("_", " ")}</Badge></Field>
            <Field label="KYC"><Badge variant="secondary">{seller.kyc_status?.replace("_", " ")}</Badge></Field>
            <Field label="Account status"><Badge variant={profile?.status === "active" ? "success" : profile?.status === "suspended" ? "warning" : "destructive"}>{profile?.status ?? "—"}</Badge></Field>
            <Field label="Commission">{Number(seller.commission_rate).toFixed(2)}%</Field>
            <Field label="Tax ID">{seller.tax_id ?? "—"}</Field>
            <Field label="Address">{seller.address ?? "—"}</Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Owner</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Name">{profile?.full_name ?? "—"}</Field>
            <Field label="Phone">{profile?.phone ?? "—"}</Field>
            <Field label="Country">{profile?.country ?? "—"}</Field>
            <Field label="Joined">{profile ? new Date(profile.created_at).toLocaleDateString() : "—"}</Field>
            <Field label="Last login">{profile?.last_login ? new Date(profile.last_login).toLocaleString() : "—"}</Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Financials</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Total revenue">${Number(seller.total_revenue).toFixed(2)}</Field>
            <Field label="Payout balance">${Number(seller.payout_balance).toFixed(2)}</Field>
            <Field label="Rating">{seller.rating ?? "—"}</Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent products</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow className="bg-neutral-7 hover:bg-neutral-7"><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Sales</TableHead></TableRow></TableHeader>
            <TableBody>
              {products.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-neutral-4 py-6">No products</TableCell></TableRow> :
                products.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer">
                    <TableCell><Link to={`/admin/products/${p.id}`} className="text-primary hover:underline">{p.title}</Link></TableCell>
                    <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                    <TableCell className="text-right">${Number(p.price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{p.stock}</TableCell>
                    <TableCell className="text-right">{p.sales_count}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow className="bg-neutral-7 hover:bg-neutral-7"><TableHead>Order</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {orders.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-neutral-4 py-6">No orders</TableCell></TableRow> :
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
