import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function DetailHeader({ backTo, backLabel, title, subtitle, children }: { backTo: string; backLabel: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to={backTo}><ArrowLeft className="h-4 w-4" /> {backLabel}</Link>
        </Button>
        <h1 className="text-display text-neutral-1">{title}</h1>
        {subtitle && <p className="text-body text-neutral-2 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}
