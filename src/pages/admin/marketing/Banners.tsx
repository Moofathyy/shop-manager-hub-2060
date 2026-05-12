import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Image as ImageIcon, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

type Banner = { id: string; title: string; image_desktop_url: string | null; image_mobile_url: string | null; link_url: string | null; sort_order: number; starts_at: string | null; ends_at: string | null; active: boolean };

export default function Banners() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", image_desktop_url: "", image_mobile_url: "", link_url: "", starts_at: "", ends_at: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("banners").select("*").order("sort_order");
    setRows((data ?? []) as Banner[]); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const upload = async (file: File, key: "image_desktop_url" | "image_mobile_url") => {
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("marketing-banners").upload(path, file);
    if (error) return toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    const { data: { publicUrl } } = supabase.storage.from("marketing-banners").getPublicUrl(path);
    setForm((f) => ({ ...f, [key]: publicUrl }));
  };

  const create = async () => {
    if (!form.title) return toast({ title: "Title required", variant: "destructive" });
    const sort_order = (rows[rows.length - 1]?.sort_order ?? 0) + 1;
    const payload = { ...form, sort_order, starts_at: form.starts_at || null, ends_at: form.ends_at || null };
    const { error, data } = await supabase.from("banners").insert(payload).select().single();
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("banner.create", "banner", data!.id, payload);
    toast({ title: "Banner added" });
    setOpen(false); setForm({ title: "", image_desktop_url: "", image_mobile_url: "", link_url: "", starts_at: "", ends_at: "" }); load();
  };

  const toggle = async (b: Banner) => {
    await supabase.from("banners").update({ active: !b.active }).eq("id", b.id);
    await logAudit("banner.toggle", "banner", b.id, { active: !b.active }); load();
  };

  const remove = async (b: Banner) => {
    if (!confirm(`Delete "${b.title}"?`)) return;
    await supabase.from("banners").delete().eq("id", b.id);
    await logAudit("banner.delete", "banner", b.id); load();
  };

  const move = async (b: Banner, dir: -1 | 1) => {
    const idx = rows.findIndex((r) => r.id === b.id);
    const swap = rows[idx + dir]; if (!swap) return;
    await Promise.all([
      supabase.from("banners").update({ sort_order: swap.sort_order }).eq("id", b.id),
      supabase.from("banners").update({ sort_order: b.sort_order }).eq("id", swap.id),
    ]);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New banner</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload banner</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Link URL</Label><Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="/sale/summer" /></div>
              <div>
                <Label>Desktop image</Label>
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "image_desktop_url")} />
                {form.image_desktop_url && <img src={form.image_desktop_url} alt="" className="h-20 mt-2 rounded" />}
              </div>
              <div>
                <Label>Mobile image</Label>
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "image_mobile_url")} />
                {form.image_mobile_url && <img src={form.image_mobile_url} alt="" className="h-20 mt-2 rounded" />}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Starts</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><Label>Ends</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Add banner</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <Skeleton className="h-40" /> : (
        <div className="grid gap-3">
          {rows.map((b, i) => (
            <Card key={b.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-16 w-28 rounded bg-neutral-7 flex items-center justify-center overflow-hidden">
                  {b.image_desktop_url ? <img src={b.image_desktop_url} alt={b.title} className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-neutral-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold truncate">{b.title}</div>
                    <Badge variant={b.active ? "success" : "secondary"}>{b.active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="text-caption text-neutral-4">
                    {b.starts_at && `From ${new Date(b.starts_at).toLocaleDateString()}`}
                    {b.ends_at && ` to ${new Date(b.ends_at).toLocaleDateString()}`}
                    {b.link_url && ` · ${b.link_url}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={b.active} onCheckedChange={() => toggle(b)} />
                  <Button size="sm" variant="ghost" onClick={() => move(b, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => move(b, 1)} disabled={i === rows.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(b)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && <Card><CardContent className="py-12 text-center text-neutral-4">No banners yet</CardContent></Card>}
        </div>
      )}
    </div>
  );
}
