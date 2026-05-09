import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, EyeOff, Eye } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { DetailHeader } from "@/components/admin/DetailHeader";

interface Product {
  id: string; title: string; description: string | null; sku: string | null;
  price: number; stock: number; status: string; rating: number | null;
  sales_count: number; rejection_reason: string | null; images: string[];
  category_id: string | null; seller_id: string;
  created_at: string; updated_at: string;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<{ user_id: string; store_name: string } | null>(null);
  const [category, setCategory] = useState<string>("—");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (!data) { setLoading(false); return; }
    const prod = { ...data, images: Array.isArray(data.images) ? (data.images as string[]) : [] } as Product;
    setP(prod);
    if (prod.seller_id) {
      const { data: s } = await supabase.from("seller_profiles").select("user_id, store_name").eq("user_id", prod.seller_id).maybeSingle();
      setSeller(s);
    }
    if (prod.category_id) {
      const { data: c } = await supabase.from("categories").select("name").eq("id", prod.category_id).maybeSingle();
      setCategory(c?.name ?? "—");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const setStatus = async (status: string, action: string) => {
    if (!id) return;
    const { error } = await supabase.from("products").update({ status: status as "approved" | "pending" | "rejected" | "unpublished" | "out_of_stock" }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`product.${action}`, "product", id);
    toast({ title: `Product ${action}` });
    load();
  };

  if (loading) return <Skeleton className="h-96" />;
  if (!p) return <div className="text-neutral-2">Product not found.</div>;

  const statusVariant = (p.status === "approved" ? "success" : p.status === "rejected" ? "destructive" : p.status === "pending" ? "warning" : "secondary") as const;

  return (
    <div className="space-y-6">
      <DetailHeader backTo="/admin/products" backLabel="Products" title={p.title} subtitle={p.sku ? `SKU ${p.sku}` : undefined}>
        {p.status === "pending" && (
          <>
            <Button variant="primary" onClick={() => setStatus("approved", "approve")}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
            <Button variant="destructive" onClick={() => setStatus("rejected", "reject")}><XCircle className="h-4 w-4" /> Reject</Button>
          </>
        )}
        {p.status === "approved" && (
          <Button variant="secondary" onClick={() => setStatus("unpublished", "unpublish")}><EyeOff className="h-4 w-4" /> Unpublish</Button>
        )}
        {p.status === "unpublished" && (
          <Button variant="primary" onClick={() => setStatus("approved", "republish")}><Eye className="h-4 w-4" /> Republish</Button>
        )}
      </DetailHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {p.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {p.images.slice(0, 6).map((src, i) => (
                  <img key={i} src={src} alt={p.title} className="aspect-square w-full object-cover rounded-input border border-neutral-6" />
                ))}
              </div>
            )}
            <div>
              <div className="text-caption text-neutral-2 mb-1">Description</div>
              <p className="text-body text-neutral-1 whitespace-pre-wrap">{p.description ?? "No description provided."}</p>
            </div>
            {p.rejection_reason && (
              <div className="p-3 rounded-input bg-destructive/10 border border-destructive">
                <div className="text-caption font-semibold text-destructive-foreground">Rejection reason</div>
                <p className="text-body text-neutral-1 mt-1">{p.rejection_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Status"><Badge variant={statusVariant}>{p.status.replace("_", " ")}</Badge></Field>
            <Field label="Price">${Number(p.price).toFixed(2)}</Field>
            <Field label="Stock">{p.stock}</Field>
            <Field label="Sales">{p.sales_count}</Field>
            <Field label="Rating">{p.rating ?? "—"}</Field>
            <Field label="Category">{category}</Field>
            <Field label="Seller">
              {seller ? <Link className="text-primary hover:underline" to={`/admin/sellers/${seller.user_id}`}>{seller.store_name}</Link> : "—"}
            </Field>
            <Field label="Created">{new Date(p.created_at).toLocaleString()}</Field>
            <Field label="Updated">{new Date(p.updated_at).toLocaleString()}</Field>
          </CardContent>
        </Card>
      </div>
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
