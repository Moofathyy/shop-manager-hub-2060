import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

interface Zone { id: string; name: string; countries: string[]; regions: string[]; active: boolean; }
interface Rate { id: string; zone_id: string; carrier_id: string | null; rate_type: "flat" | "weight" | "free"; flat_amount: number | null; weight_brackets: any[]; seller_tier: string | null; active: boolean; }
interface Carrier { id: string; name: string; }

export default function Zones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState({ name: "", countries: "", regions: "" });

  const [rateOpen, setRateOpen] = useState(false);
  const [rateForm, setRateForm] = useState<{
    carrier_id: string; rate_type: "flat" | "weight" | "free"; flat_amount: string;
    brackets: { maxKg: string; price: string }[]; seller_tier: string;
  }>({ carrier_id: "", rate_type: "flat", flat_amount: "", brackets: [{ maxKg: "1", price: "5" }], seller_tier: "any" });

  const load = async () => {
    setLoading(true);
    const [{ data: z }, { data: r }, { data: c }] = await Promise.all([
      supabase.from("delivery_zones").select("*").order("name"),
      supabase.from("shipping_rates").select("*"),
      supabase.from("shipping_carriers").select("id, name").order("name"),
    ]);
    setZones((z ?? []) as Zone[]);
    setRates((r ?? []) as Rate[]);
    setCarriers((c ?? []) as Carrier[]);
    if (!selected && z && z.length > 0) setSelected(z[0].id);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createZone = async () => {
    if (!zoneForm.name.trim()) return;
    const payload = {
      name: zoneForm.name.trim(),
      countries: zoneForm.countries.split(",").map((s) => s.trim()).filter(Boolean),
      regions: zoneForm.regions.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const { error } = await supabase.from("delivery_zones").insert(payload);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("zone.create", "zone", null, payload);
    toast({ title: "Zone created" });
    setZoneOpen(false); setZoneForm({ name: "", countries: "", regions: "" }); load();
  };

  const removeZone = async (id: string) => {
    if (!confirm("Delete this zone? Rates linked to it will also be removed.")) return;
    await supabase.from("shipping_rates").delete().eq("zone_id", id);
    await supabase.from("delivery_zones").delete().eq("id", id);
    await logAudit("zone.delete", "zone", id);
    if (selected === id) setSelected(null);
    load();
  };

  const createRate = async () => {
    if (!selected) return;
    const payload: any = {
      zone_id: selected,
      carrier_id: rateForm.carrier_id || null,
      rate_type: rateForm.rate_type,
      flat_amount: rateForm.rate_type === "flat" ? parseFloat(rateForm.flat_amount) || 0 : null,
      weight_brackets: rateForm.rate_type === "weight"
        ? rateForm.brackets.map((b) => ({ maxKg: parseFloat(b.maxKg) || 0, price: parseFloat(b.price) || 0 }))
        : [],
      seller_tier: rateForm.seller_tier === "any" ? null : rateForm.seller_tier,
    };
    const { error } = await supabase.from("shipping_rates").insert(payload);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("rate.create", "rate", null, payload);
    toast({ title: "Rate added" });
    setRateOpen(false);
    setRateForm({ carrier_id: "", rate_type: "flat", flat_amount: "", brackets: [{ maxKg: "1", price: "5" }], seller_tier: "any" });
    load();
  };

  const removeRate = async (id: string) => {
    await supabase.from("shipping_rates").delete().eq("id", id);
    await logAudit("rate.delete", "rate", id);
    load();
  };

  const addBracket = () => setRateForm((f) => ({ ...f, brackets: [...f.brackets, { maxKg: "", price: "" }] }));
  const updateBracket = (i: number, key: "maxKg" | "price", v: string) =>
    setRateForm((f) => ({ ...f, brackets: f.brackets.map((b, idx) => (idx === i ? { ...b, [key]: v } : b)) }));
  const removeBracket = (i: number) =>
    setRateForm((f) => ({ ...f, brackets: f.brackets.filter((_, idx) => idx !== i) }));

  const zoneRates = rates.filter((r) => r.zone_id === selected);
  const carrierName = (id: string | null) => id ? carriers.find((c) => c.id === id)?.name ?? "—" : "Any";

  if (loading) return <Skeleton className="h-80" />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Zones list */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-h3">Zones</h3>
            <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New zone</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} /></div>
                  <div><Label>Countries (ISO codes, comma-separated)</Label><Input value={zoneForm.countries} onChange={(e) => setZoneForm({ ...zoneForm, countries: e.target.value })} placeholder="US, CA, MX" /></div>
                  <div><Label>Regions</Label><Input value={zoneForm.regions} onChange={(e) => setZoneForm({ ...zoneForm, regions: e.target.value })} placeholder="NA, EU" /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setZoneOpen(false)}>Cancel</Button><Button onClick={createZone}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-1">
            {zones.map((z) => (
              <button
                key={z.id}
                onClick={() => setSelected(z.id)}
                className={`w-full text-left p-3 rounded-input transition-colors flex items-start gap-2 ${selected === z.id ? "bg-primary-bg" : "hover:bg-neutral-7"}`}
              >
                <MapPin className={`h-4 w-4 mt-0.5 ${selected === z.id ? "text-primary" : "text-neutral-3"}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-body ${selected === z.id ? "font-semibold text-primary" : "text-neutral-1"}`}>{z.name}</div>
                  <div className="text-caption text-neutral-4 truncate">{z.countries.join(", ")}</div>
                </div>
                <Trash2 className="h-4 w-4 text-neutral-4 hover:text-destructive-foreground" onClick={(e) => { e.stopPropagation(); removeZone(z.id); }} />
              </button>
            ))}
            {zones.length === 0 && <div className="text-center text-neutral-4 py-6 text-caption">No zones</div>}
          </div>
        </CardContent>
      </Card>

      {/* Rates for selected zone */}
      <Card className="lg:col-span-2">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-h3">Rates {selected && <span className="text-neutral-4 text-body font-normal">· {zones.find((z) => z.id === selected)?.name}</span>}</h3>
            {selected && (
              <Dialog open={rateOpen} onOpenChange={setRateOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add rate</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New shipping rate</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Carrier</Label>
                      <Select value={rateForm.carrier_id || "any"} onValueChange={(v) => setRateForm({ ...rateForm, carrier_id: v === "any" ? "" : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any carrier</SelectItem>
                          {carriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Rate type</Label>
                      <RadioGroup value={rateForm.rate_type} onValueChange={(v) => setRateForm({ ...rateForm, rate_type: v as any })} className="flex gap-4 mt-2">
                        {[{ v: "flat", l: "Flat" }, { v: "weight", l: "Weight-based" }, { v: "free", l: "Free" }].map((o) => (
                          <div key={o.v} className="flex items-center gap-2"><RadioGroupItem value={o.v} id={`rt-${o.v}`} /><Label htmlFor={`rt-${o.v}`}>{o.l}</Label></div>
                        ))}
                      </RadioGroup>
                    </div>
                    {rateForm.rate_type === "flat" && (
                      <div><Label>Flat amount ($)</Label><Input type="number" step="0.01" value={rateForm.flat_amount} onChange={(e) => setRateForm({ ...rateForm, flat_amount: e.target.value })} /></div>
                    )}
                    {rateForm.rate_type === "weight" && (
                      <div className="space-y-2">
                        <Label>Weight brackets (≤ maxKg → price)</Label>
                        {rateForm.brackets.map((b, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <Input type="number" placeholder="max kg" value={b.maxKg} onChange={(e) => updateBracket(i, "maxKg", e.target.value)} />
                            <Input type="number" step="0.01" placeholder="price" value={b.price} onChange={(e) => updateBracket(i, "price", e.target.value)} />
                            <Button variant="ghost" size="sm" onClick={() => removeBracket(i)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addBracket}><Plus className="h-4 w-4" /> Add bracket</Button>
                      </div>
                    )}
                    <div><Label>Seller tier override</Label>
                      <Select value={rateForm.seller_tier} onValueChange={(v) => setRateForm({ ...rateForm, seller_tier: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any (default)</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setRateOpen(false)}>Cancel</Button><Button onClick={createRate}>Add rate</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {!selected ? <div className="text-center text-neutral-4 py-8">Select a zone</div> :
            zoneRates.length === 0 ? <div className="text-center text-neutral-4 py-8 text-caption">No rates for this zone</div> :
            <div className="space-y-2">
              {zoneRates.map((r) => (
                <div key={r.id} className="p-3 rounded-input border border-neutral-6 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={r.rate_type === "free" ? "success" : r.rate_type === "flat" ? "secondary" : "warning"}>{r.rate_type}</Badge>
                      <span className="text-body font-medium">{carrierName(r.carrier_id)}</span>
                      {r.seller_tier && <Badge variant="outline">{r.seller_tier} tier</Badge>}
                    </div>
                    <div className="text-caption text-neutral-3 mt-1">
                      {r.rate_type === "flat" && `$${Number(r.flat_amount).toFixed(2)} per shipment`}
                      {r.rate_type === "free" && "Free shipping"}
                      {r.rate_type === "weight" && (r.weight_brackets ?? []).map((b: any) => `≤${b.maxKg}kg: $${b.price}`).join(" · ")}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeRate(r.id)}><Trash2 className="h-4 w-4 text-destructive-foreground" /></Button>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
