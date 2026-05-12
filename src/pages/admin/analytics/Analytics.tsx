import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Dashboard from "./Dashboard";
import CustomReports from "./CustomReports";

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Analytics & Reports</h1>
        <p className="text-body text-neutral-2 mt-1">Platform-wide performance insights.</p>
      </div>
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="reports">Custom Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6"><Dashboard /></TabsContent>
        <TabsContent value="reports" className="mt-6"><CustomReports /></TabsContent>
      </Tabs>
    </div>
  );
}
