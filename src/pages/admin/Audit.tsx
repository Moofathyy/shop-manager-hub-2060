import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCSV } from "@/lib/csv";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";

interface Log {
  id: string; admin_id: string | null; action: string; entity_type: string;
  entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string;
  admin_name?: string;
}

export default function Audit() {
  const [rows, setRows] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: logs }, { data: profiles }] = await Promise.all([
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("id, full_name"),
      ]);
      const m = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      setRows((logs ?? []).map((l) => ({
        ...l,
        metadata: l.metadata as Record<string, unknown> | null,
        admin_name: l.admin_id ? (m.get(l.admin_id) ?? l.admin_id.slice(0, 8)) : "system",
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) =>
    !q || r.action.toLowerCase().includes(q.toLowerCase()) || r.entity_type.toLowerCase().includes(q.toLowerCase())
  );
  const { paged, page, pageSize, total, setPage, setPageSize } = usePagination(filtered, 25, q);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display text-neutral-1">Audit Log</h1>
          <p className="text-body text-neutral-2 mt-1">Last 500 admin actions.</p>
        </div>
        <Button variant="secondary" onClick={() => downloadCSV("audit_log.csv", filtered)}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-4" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action or entity…" className="pl-9 h-11" />
          </div>
          <div className="overflow-x-auto rounded-input border border-neutral-6">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-7 hover:bg-neutral-7">
                  <TableHead>Time</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-6" /></TableCell></TableRow> :
                  filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-neutral-4 py-12">No activity yet</TableCell></TableRow> :
                    paged.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-caption text-neutral-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-neutral-1">{l.admin_name}</TableCell>
                        <TableCell><Badge variant="info">{l.action}</Badge></TableCell>
                        <TableCell className="text-neutral-2">{l.entity_type}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}</TableCell>
                        <TableCell className="text-caption text-neutral-2 font-mono max-w-xs truncate">
                          {l.metadata ? JSON.stringify(l.metadata) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                }
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
