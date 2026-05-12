import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Coupons from "./Coupons";
import FlashSales from "./FlashSales";
import Banners from "./Banners";
import Notifications from "./Notifications";
import FeaturedSlots from "./FeaturedSlots";
import Referral from "./Referral";
import Loyalty from "./Loyalty";

export default function Marketing() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Marketing & Promotions</h1>
        <p className="text-body text-neutral-2 mt-1">Coupons, sales, banners, notifications, referrals and loyalty.</p>
      </div>
      <Tabs defaultValue="coupons">
        <TabsList className="bg-neutral-7 flex-wrap h-auto">
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="sales">Flash Sales</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="featured">Featured Slots</TabsTrigger>
          <TabsTrigger value="referral">Referral</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
        </TabsList>
        <TabsContent value="coupons" className="mt-6"><Coupons /></TabsContent>
        <TabsContent value="sales" className="mt-6"><FlashSales /></TabsContent>
        <TabsContent value="banners" className="mt-6"><Banners /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><Notifications /></TabsContent>
        <TabsContent value="featured" className="mt-6"><FeaturedSlots /></TabsContent>
        <TabsContent value="referral" className="mt-6"><Referral /></TabsContent>
        <TabsContent value="loyalty" className="mt-6"><Loyalty /></TabsContent>
      </Tabs>
    </div>
  );
}
