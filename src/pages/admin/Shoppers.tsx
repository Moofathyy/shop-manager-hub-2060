import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Ban, ShieldOff, ShieldCheck } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { downloadCSV } from "@/lib/csv";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type Status = "active" | "suspended" | "banned";

interface Shopper {
  id: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  status: Status;
  created_at: string;
  last_login: string | null;
  total_orders: number;
  total_spent: number;
}

const statusBadge = (s: Status) => {
  const map = { active: "success", suspended: "warning", banned: "destructive" } as const;
  return <Badge variant={map[s]}>{s}</Badge>;
};

export default function Shoppers() {
  const [rows, setRows] = useState<Shopper[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    // shoppers = profiles whose only role is shopper (no admin / no seller_profile)
    const [{ data: profiles }, { data: roles }, { data: sellers }, { data: orders }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("seller_profiles").select("user_id"),
      supabase.from("orders").select("shopper_id, total"),
    ]);
    const sellerIds = new Set((sellers ?? []).map((s) => s.user_id));
    const adminIds = new Set((roles ?? []).filter((r) => r.role !== "shopper" && r.role !== "seller").map((r) => r.user_id));
    const ordersByShopper = new Map<string, { count: number; total: number }>();
    (orders ?? []).forEach((o) => {
      const cur = ordersByShopper.get(o.shopper_id) ?? { count: 0, total: 0 };
      cur.count += 1; cur.total += Number(o.total);
      ordersByShopper.set(o.shopper_id, cur);
    });
    const list: Shopper[] = (profiles ?? [])
      .filter((p) => !sellerIds.has(p.id) && !adminIds.has(p.id))
      .map((p) => {
        const stats = ordersByShopper.get(p.id) ?? { count: 0, total: 0 };
        return { ...p, status: p.status as Status, total_orders: stats.count, total_spent: stats.total };
      });
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (q && !((r.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || (r.phone ?? "").includes(q))) return false;
    return true;
  });

  const updateStatus = async (id: string, newStatus: Status, action: string) => {
    const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(action, "shopper", id, { newStatus });
    toast({ title: "Updated", description: `Shopper ${action}` });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display text-neutral-1">Shoppers</h1>
          <p className="text-body text-neutral-2 mt-1">{filtered.length} shoppers</p>
        </div>
        <Button variant="secondary" onClick={() => downloadCSV("shoppers.csv", filtered)}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-4" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone…" className="pl-9 h-11" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px] h-11 rounded-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-input border border-neutral-6">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-7 hover:bg-neutral-7">
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6" /></TableCell></TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-neutral-4 py-12">No shoppers yet</TableCell></TableRow>
                ) : filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-neutral-1">{s.full_name ?? "—"}</TableCell>
                    <TableCell className="text-neutral-2">{s.phone ?? "—"}</TableCell>
                    <TableCell className="text-neutral-2">{s.country ?? "—"}</TableCell>
                    <TableCell className="text-right">{s.total_orders}</TableCell>
                    <TableCell className="text-right">${s.total_spent.toFixed(2)}</TableCell>
                    <TableCell className="text-neutral-2">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {s.status !== "active" && (
                          <Button variant="ghost" size="sm" onClick={() => updateStatus(s.id, "active", "shopper.reactivate")}>
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        )}
                        {s.status === "active" && (
                          <ConfirmAction
                            label={<ShieldOff className="h-4 w-4" />} title="Suspend shopper?"
                            description="They will not be able to place orders until reactivated."
                            onConfirm={() => updateStatus(s.id, "suspended", "shopper.suspend")}
                          />
                        )}
                        {s.status !== "banned" && (
                          <ConfirmAction
                            label={<Ban className="h-4 w-4 text-destructive-foreground" />} title="Ban shopper?"
                            description="This permanently blocks the account."
                            destructive onConfirm={() => updateStatus(s.id, "banned", "shopper.ban")}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfirmAction({ label, title, description, onConfirm, destructive }: { label: React.ReactNode; title: string; description: string; onConfirm: () => void; destructive?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm">{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={destructive ? "bg-destructive text-destructive-foreground" : ""}>
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
