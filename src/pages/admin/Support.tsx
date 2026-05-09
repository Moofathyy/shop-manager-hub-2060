import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Send, Clock, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";

interface Ticket {
  id: string; user_id: string; subject: string; type: string;
  status: string; priority: string; assigned_to: string | null;
  related_order_id: string | null; sla_due_at: string | null;
  created_at: string; updated_at: string;
  user_name?: string;
}
interface Message {
  id: string; ticket_id: string; author_id: string; body: string;
  is_internal: boolean; created_at: string;
}

const priorityBadge = (p: string) => {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    low: "secondary", medium: "info" as never, high: "warning", urgent: "destructive",
  };
  return <Badge variant={map[p] ?? "secondary"}>{p}</Badge>;
};
const statusBadge = (s: string) => {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary" | "info"> = {
    open: "warning", in_progress: "info", waiting: "secondary", resolved: "success", closed: "secondary",
  };
  return <Badge variant={map[s] ?? "secondary"}>{s.replace("_", " ")}</Badge>;
};

export default function Support() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("all");
  const [open, setOpen] = useState<Ticket | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: profiles }] = await Promise.all([
      supabase.from("tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const m = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    setRows((t ?? []).map((x) => ({ ...x, user_name: m.get(x.user_id) ?? "—" })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (priority !== "all" && r.priority !== priority) return false;
    if (q && !r.subject.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const { paged, page, pageSize, total, setPage, setPageSize } = usePagination(filtered, 10, `${q}|${status}|${priority}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Support & Tickets</h1>
        <p className="text-body text-neutral-2 mt-1">{filtered.length} tickets</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-4" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject…" className="pl-9 h-11" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px] h-11 rounded-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["open","in_progress","waiting","resolved","closed"].map((s) =>
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-[140px] h-11 rounded-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any priority</SelectItem>
                {["low","medium","high","urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-input border border-neutral-6">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-7 hover:bg-neutral-7">
                  <TableHead>Subject</TableHead><TableHead>User</TableHead>
                  <TableHead>Type</TableHead><TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead><TableHead>SLA</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={7}><Skeleton className="h-6" /></TableCell></TableRow> :
                  filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-neutral-4 py-12">No tickets</TableCell></TableRow> :
                    paged.map((t) => {
                      const sla = t.sla_due_at ? new Date(t.sla_due_at).getTime() - Date.now() : null;
                      const slaBreached = sla !== null && sla < 0;
                      return (
                        <TableRow key={t.id} className="cursor-pointer" onClick={() => setOpen(t)}>
                          <TableCell className="font-medium text-neutral-1">{t.subject}</TableCell>
                          <TableCell className="text-neutral-2">{t.user_name}</TableCell>
                          <TableCell><Badge variant="secondary">{t.type}</Badge></TableCell>
                          <TableCell>{priorityBadge(t.priority)}</TableCell>
                          <TableCell>{statusBadge(t.status)}</TableCell>
                          <TableCell>
                            {sla === null ? <span className="text-neutral-4">—</span> :
                              slaBreached ? <span className="text-destructive-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Breached</span> :
                                <span className="text-neutral-2 flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.round(sla / 3600000)}h</span>}
                          </TableCell>
                          <TableCell className="text-neutral-2">{new Date(t.updated_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </CardContent>
      </Card>

      <TicketDrawer ticket={open} onClose={() => setOpen(null)} onChange={load} />
    </div>
  );
}

function TicketDrawer({ ticket, onClose, onChange }: { ticket: Ticket | null; onClose: () => void; onChange: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const cannedReplies = useMemo(() => [
    "Thanks for reaching out — looking into this now.",
    "We've issued the refund. Please allow 5–7 business days.",
    "Could you share an order ID so we can investigate?",
  ], []);

  useEffect(() => {
    if (!ticket) return;
    supabase.from("ticket_messages").select("*").eq("ticket_id", ticket.id).order("created_at").then(({ data }) => setMessages(data ?? []));
  }, [ticket]);

  if (!ticket) return null;

  const send = async () => {
    if (!body.trim() || !user) return;
    setBusy(true);
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id, author_id: user.id, body, is_internal: internal,
    });
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setBody("");
    await logAudit("ticket.reply", "ticket", ticket.id, { internal });
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", ticket.id).order("created_at");
    setMessages(data ?? []);
  };

  const updateTicket = async (patch: Partial<{ status: string; priority: string }>) => {
    const { error } = await supabase.from("tickets").update(patch as never).eq("id", ticket.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit(`ticket.update`, "ticket", ticket.id, patch);
    toast({ title: "Ticket updated" });
    onChange();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="p-6 border-b border-neutral-6">
          <SheetTitle className="text-h2">{ticket.subject}</SheetTitle>
          <div className="flex items-center gap-2 mt-2">
            {statusBadge(ticket.status)}{priorityBadge(ticket.priority)}
            <Badge variant="secondary">{ticket.type}</Badge>
          </div>
          <div className="flex gap-2 mt-3">
            <Select value={ticket.status} onValueChange={(v) => updateTicket({ status: v })}>
              <SelectTrigger className="w-[160px] h-9 rounded-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["open","in_progress","waiting","resolved","closed"].map((s) =>
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ticket.priority} onValueChange={(v) => updateTicket({ priority: v })}>
              <SelectTrigger className="w-[140px] h-9 rounded-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["low","medium","high","urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {messages.length === 0 ? (
            <p className="text-caption text-neutral-4">No messages yet.</p>
          ) : messages.map((m) => (
            <div key={m.id} className={`p-3 rounded-input ${m.is_internal ? "bg-warning-bg/40 border border-warning" : "bg-neutral-7"}`}>
              {m.is_internal && <div className="text-micro text-warning-text font-semibold mb-1">INTERNAL NOTE</div>}
              <p className="text-body text-neutral-1 whitespace-pre-wrap">{m.body}</p>
              <p className="text-micro text-neutral-4 mt-1">{new Date(m.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-neutral-6 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {cannedReplies.map((c, i) => (
              <Button key={i} variant="ghost" size="sm" className="h-8 text-caption" onClick={() => setBody(c)}>{c.slice(0, 40)}…</Button>
            ))}
          </div>
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a reply…" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-caption text-neutral-2 cursor-pointer">
              <Checkbox checked={internal} onCheckedChange={(v) => setInternal(!!v)} /> Internal note
            </label>
            <Button onClick={send} disabled={busy || !body.trim()}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
