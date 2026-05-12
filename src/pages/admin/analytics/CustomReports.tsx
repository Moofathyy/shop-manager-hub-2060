import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, Download, Play, Clock, Trash2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { runCustomReport } from "@/lib/analytics";
import { toCSV, downloadCSV } from "@/lib/csvExport";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";

const METRICS = [
  { key: "gmv", label: "GMV" },
  { key: "orders", label: "Orders" },
  { key: "aov", label: "AOV" },
  { key: "refund_amount", label: "Refund amount" },
  { key: "refund_count", label: "Refund count" },
];

const DIMS = [
  { key: "seller", label: "Seller" },
  { key: "category", label: "Category" },
  { key: "country", label: "Country" },
  { key: "product", label: "Product" },
  { key: "day", label: "Day" },
];

export default function CustomReports() {
  const [from, setFrom] = useState<Date>(subDays(new Date(), 30));
  const [to, setTo] = useState<Date>(new Date());
  const [dimension, setDimension] = useState<"seller" | "category" | "country" | "product" | "day">("seller");
  const [metrics, setMetrics] = useState<string[]>(["gmv", "orders", "aov"]);
  const [results, setResults] = useState<Record<string, any>[]>([]);
  const [running, setRunning] = useState(false);

  const [scheduled, setScheduled] = useState<any[]>([]);
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedName, setSchedName] = useState("");
  const [schedFreq, setSchedFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [schedEmail, setSchedEmail] = useState("");

  const loadScheduled = async () => {
    const { data } = await supabase.from("scheduled_reports").select("*").order("created_at", { ascending: false });
    setScheduled(data ?? []);
  };
  useEffect(() => { loadScheduled(); }, []);

  const toggleMetric = (m: string) => {
    setMetrics((cur) => cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]);
  };

  const run = async () => {
    if (metrics.length === 0) return toast({ title: "Pick at least one metric", variant: "destructive" });
    setRunning(true);
    try {
      const rows = await runCustomReport(from, to, dimension, metrics);
      setResults(rows);
      toast({ title: `Report ready · ${rows.length} rows` });
    } finally { setRunning(false); }
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    const csv = toCSV(results);
    downloadCSV(`report-${format(new Date(), "yyyy-MM-dd")}.csv`, csv);
  };

  const saveSchedule = async () => {
    if (!schedName.trim() || !schedEmail.trim()) return toast({ title: "Name and email required", variant: "destructive" });
    const { error } = await supabase.from("scheduled_reports").insert({
      name: schedName.trim(),
      frequency: schedFreq,
      recipient_email: schedEmail.trim(),
      config: { dimension, metrics, from: from.toISOString(), to: to.toISOString() },
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("report.schedule", "scheduled_report", null, { name: schedName, frequency: schedFreq });
    toast({ title: "Schedule saved" });
    setSchedOpen(false); setSchedName(""); setSchedEmail(""); loadScheduled();
  };

  const deleteSchedule = async (id: string) => {
    const { error } = await supabase.from("scheduled_reports").delete().eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAudit("report.unschedule", "scheduled_report", id);
    loadScheduled();
  };

  const columns = results.length > 0 ? Object.keys(results[0]) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="text-h3">Report builder</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(from, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={from} onSelect={(d) => d && setFrom(d)} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(to, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={to} onSelect={(d) => d && setTo(d)} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Group by</Label>
              <Select value={dimension} onValueChange={(v) => setDimension(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIMS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={run} disabled={running} className="flex-1">
                <Play className="h-4 w-4" /> {running ? "Running…" : "Run report"}
              </Button>
            </div>
          </div>

          <div>
            <Label>Metrics</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {METRICS.map((m) => {
                const on = metrics.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMetric(m.key)}
                    className={`px-3 py-1.5 rounded-input text-caption transition-colors border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-neutral-2 border-neutral-6 hover:bg-neutral-7"}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {results.length > 0 && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4" /> Export CSV</Button>
              <Dialog open={schedOpen} onOpenChange={setSchedOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Clock className="h-4 w-4" /> Schedule</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Schedule recurring report</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Name</Label><Input value={schedName} onChange={(e) => setSchedName(e.target.value)} placeholder="Weekly sales by seller" /></div>
                    <div><Label>Recipient email</Label><Input type="email" value={schedEmail} onChange={(e) => setSchedEmail(e.target.value)} /></div>
                    <div>
                      <Label>Frequency</Label>
                      <Select value={schedFreq} onValueChange={(v) => setSchedFreq(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSchedOpen(false)}>Cancel</Button>
                    <Button onClick={saveSchedule}>Save schedule</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {running ? (
        <Skeleton className="h-60" />
      ) : results.length > 0 ? (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => <TableHead key={c} className="capitalize">{c.replace(/_/g, " ")}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, i) => (
                <TableRow key={i}>
                  {columns.map((c) => <TableCell key={c}>{typeof r[c] === "number" ? r[c].toLocaleString() : String(r[c] ?? "")}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      ) : null}

      {/* Scheduled list */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="text-h3">Scheduled reports</h3>
          {scheduled.length === 0 ? (
            <div className="text-neutral-4 text-caption py-6 text-center">No scheduled reports yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Frequency</TableHead><TableHead>Recipient</TableHead><TableHead>Created</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {scheduled.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="secondary">{s.frequency}</Badge></TableCell>
                    <TableCell className="text-neutral-2">{s.recipient_email}</TableCell>
                    <TableCell className="text-caption text-neutral-4">{format(new Date(s.created_at), "PP")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => deleteSchedule(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
