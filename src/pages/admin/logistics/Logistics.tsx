import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Carriers from "./Carriers";
import Zones from "./Zones";
import Shipments from "./Shipments";
import Returns from "./Returns";

export default function Logistics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Delivery & Logistics</h1>
        <p className="text-body text-neutral-2 mt-1">Shipping providers, zones, tracking, and returns.</p>
      </div>
      <Tabs defaultValue="shipments">
        <TabsList>
          <TabsTrigger value="shipments">Shipments</TabsTrigger>
          <TabsTrigger value="carriers">Carriers</TabsTrigger>
          <TabsTrigger value="zones">Zones & Rates</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
        </TabsList>
        <TabsContent value="shipments" className="mt-6"><Shipments /></TabsContent>
        <TabsContent value="carriers" className="mt-6"><Carriers /></TabsContent>
        <TabsContent value="zones" className="mt-6"><Zones /></TabsContent>
        <TabsContent value="returns" className="mt-6"><Returns /></TabsContent>
      </Tabs>
    </div>
  );
}
