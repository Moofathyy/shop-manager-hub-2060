import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Eye, CalendarIcon, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/audit";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface Application {
  id: string;
  seller_id: string;
  documents: Array<{ name: string; url?: string; type?: string }>;
  status: "pending" | "approved" | "rejected" | "needs_info";
  decision_reason: string | null;
  created_at: string;
  business_type: string | null;
  store_name?: string;
  applicant_name?: string;
  country?: string;
}

export default function Merchants() {
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [bizType, setBizType] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: apps }, { data: sellers }, { data: profs }] = await Promise.all([
        supabase.from("merchant_applications").select("*").order("created_at", { ascending: false }),
        supabase.from("seller_profiles").select("user_id, store_name"),
        supabase.from("profiles").select("id, full_name, country"),
      ]);
      const m = new Map((sellers ?? []).map((s) => [s.user_id, s.store_name]));
      const pm = new Map((profs ?? []).map((p) => [p.id, p]));
      setRows((apps ?? []).map((a) => ({
        ...a,
        documents: (a.documents as Application["documents"]) ?? [],
        store_name: m.get(a.seller_id) ?? undefined,
        applicant_name: pm.get(a.seller_id)?.full_name ?? "—",
        country: pm.get(a.seller_id)?.country ?? "—",
      } as Application)));
      setLoading(false);
    })();
  }, []);

  const countries = useMemo(() => Array.from(new Set(rows.map((r) => r.country).filter((c): c is string => !!c && c !== "—"))).sort(), [rows]);
  const bizTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.business_type).filter((c): c is string => !!c))).sort(), [rows]);

  const filtered = rows.filter((r) => {
    if (tab !== "all" && r.status !== tab) return false;
    if (country !== "all" && r.country !== country) return false;
    if (bizType !== "all" && r.business_type !== bizType) return false;
    if (dateRange?.from && new Date(r.created_at) < new Date(dateRange.from.setHours(0,0,0,0))) return false;
    if (dateRange?.to && new Date(r.created_at) > new Date(new Date(dateRange.to).setHours(23,59,59,999))) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(r.store_name?.toLowerCase().includes(s) || r.applicant_name?.toLowerCase().includes(s))) return false;
    }
    return true;
  });
  const filterKey = `${tab}-${country}-${bizType}-${dateRange?.from?.toISOString() ?? ""}-${dateRange?.to?.toISOString() ?? ""}-${search}`;
  const { paged, page, pageSize, total, setPage, setPageSize } = usePagination(filtered, 10, filterKey);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Merchant Approvals</h1>
        <p className="text-body text-neutral-2 mt-1">Review seller onboarding applications.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-neutral-7">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="needs_info">Needs info</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-5">
          <Input placeholder="Search applicant or store…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={bizType} onValueChange={setBizType}>
            <SelectTrigger><SelectValue placeholder="Business type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All business types</SelectItem>
              {bizTypes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "md:col-span-2 justify-start text-left font-normal h-10",
                  !dateRange?.from && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>{format(dateRange.from, "LLL d, y")} – {format(dateRange.to, "LLL d, y")}</>
                  ) : (
                    format(dateRange.from, "LLL d, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
                {dateRange?.from && (
                  <X
                    className="ml-auto h-4 w-4 opacity-60 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setDateRange(undefined); }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {loading ? <Skeleton className="h-40" /> : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-neutral-4">No applications</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((a) => {
                  const has = (t: string) => a.documents.some((d) => d.type === t || d.name?.toLowerCase().includes(t));
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.applicant_name}</TableCell>
                      <TableCell>{a.store_name ?? "—"}</TableCell>
                      <TableCell>{a.business_type ?? "—"}</TableCell>
                      <TableCell>{a.country}</TableCell>
                      <TableCell>{new Date(a.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 text-caption">
                          <DocCheck label="Reg" ok={has("registration")} />
                          <DocCheck label="ID" ok={has("id")} />
                          <DocCheck label="Bank" ok={has("bank")} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.status === "approved" ? "success" : a.status === "rejected" ? "destructive" : "warning"}>
                          {a.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost"><Link to={`/admin/merchants/${a.id}`}><Eye className="h-4 w-4" /> Review</Link></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="p-3 border-t">
              <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[5, 10, 25, 50]} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DocCheck({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? "text-success" : "text-neutral-4"}`}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {label}
    </span>
  );
}
