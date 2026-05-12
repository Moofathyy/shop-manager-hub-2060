import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type Slot = { id: string; slot_type: "product" | "seller" | "category"; entity_id: string; position: number; active: boolean };

const labels: Record<string, string> = { product: "Featured Products", seller: "Featured Sellers", category: "Category Highlights" };

export default function FeaturedSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [opts, setOpts] = useState<Record<string, { id: string; label: string }[]>>({ product: [], seller: [], category: [] });
  const [picker, setPicker] = useState<Record<string, string>>({ product: "", seller: "", category: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: products }, { data: sellers }, { data: cats }] = await Promise.all([
      supabase.from("featured_slots").select("*").order("position"),
      supabase.from("products").select("id, title").limit(100),
      supabase.from("seller_profiles").select("user_id, store_name").limit(100),
      supabase.from("categories").select("id, name").limit(100),
    ]);
    setSlots((s ?? []) as Slot[]);
    setOpts({
      product: (products ?? []).map((p) => ({ id: p.id, label: p.title })),
      seller: (sellers ?? []).map((p) => ({ id: p.user_id, label: p.store_name })),
      category: (cats ?? []).map((p) => ({ id: p.id, label: p.name })),
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async (type: "product" | "seller" | "category") => {
    const id = picker[type]; if (!id) return toast({ title: "Pick an item", variant: "destructive" });
    const same = slots.filter((s) => s.slot_type === type);
    const position = (same[same.length - 1]?.position ?? 0) + 1;
    const payload = { slot_type: type, entity_id: id, position };
    const { error, data } = await supabase.from("featured_slots").insert(payload).select().single();
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("featured.add", "featured_slot", data!.id, payload);
    setPicker({ ...picker, [type]: "" }); load();
  };

  const remove = async (s: Slot) => {
    await supabase.from("featured_slots").delete().eq("id", s.id);
    await logAudit("featured.remove", "featured_slot", s.id); load();
  };

  const move = async (s: Slot, dir: -1 | 1) => {
    const list = slots.filter((x) => x.slot_type === s.slot_type);
    const idx = list.findIndex((x) => x.id === s.id); const swap = list[idx + dir]; if (!swap) return;
    await Promise.all([
      supabase.from("featured_slots").update({ position: swap.position }).eq("id", s.id),
      supabase.from("featured_slots").update({ position: s.position }).eq("id", swap.id),
    ]); load();
  };

  const labelFor = (s: Slot) => opts[s.slot_type].find((o) => o.id === s.entity_id)?.label ?? s.entity_id.slice(0, 8);

  return (
    <Tabs defaultValue="product">
      <TabsList className="bg-neutral-7">
        <TabsTrigger value="product">Products</TabsTrigger>
        <TabsTrigger value="seller">Sellers</TabsTrigger>
        <TabsTrigger value="category">Categories</TabsTrigger>
      </TabsList>
      {(["product", "seller", "category"] as const).map((type) => {
        const list = slots.filter((s) => s.slot_type === type);
        return (
          <TabsContent key={type} value={type} className="mt-4 space-y-4">
            <Card><CardContent className="p-4 flex gap-3 items-end">
              <div className="flex-1">
                <Select value={picker[type]} onValueChange={(v) => setPicker({ ...picker, [type]: v })}>
                  <SelectTrigger><SelectValue placeholder={`Pick a ${type}…`} /></SelectTrigger>
                  <SelectContent>{opts[type].filter((o) => !list.some((s) => s.entity_id === o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={() => add(type)}><Plus className="h-4 w-4" /> Add to {labels[type]}</Button>
            </CardContent></Card>
            {loading ? <Skeleton className="h-40" /> : (
              <div className="space-y-2">
                {list.map((s, i) => (
                  <Card key={s.id}><CardContent className="p-3 flex items-center gap-3">
                    <div className="text-caption text-neutral-4 w-8">#{i + 1}</div>
                    <div className="flex-1 font-medium">{labelFor(s)}</div>
                    <Button size="sm" variant="ghost" onClick={() => move(s, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => move(s, 1)} disabled={i === list.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </CardContent></Card>
                ))}
                {list.length === 0 && <Card><CardContent className="py-10 text-center text-neutral-4">No {labels[type].toLowerCase()} yet</CardContent></Card>}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
