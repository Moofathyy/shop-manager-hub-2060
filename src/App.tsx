import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminRoute } from "@/components/AdminRoute";
import { Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AdminLayout from "./layouts/AdminLayout";
import Overview from "./pages/admin/Overview";
import Shoppers from "./pages/admin/Shoppers";
import Sellers from "./pages/admin/Sellers";
import Merchants from "./pages/admin/Merchants";
import MerchantDetail from "./pages/admin/MerchantDetail";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import Orders from "./pages/admin/Orders";
import Audit from "./pages/admin/Audit";
import Finance from "./pages/admin/Finance";
import Reviews from "./pages/admin/Reviews";
import Support from "./pages/admin/Support";
import ProductDetail from "./pages/admin/ProductDetail";
import SellerDetail from "./pages/admin/SellerDetail";
import ShopperDetail from "./pages/admin/ShopperDetail";
import OrderDetail from "./pages/admin/OrderDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<Overview />} />
              <Route path="shoppers" element={<Shoppers />} />
              <Route path="shoppers/:id" element={<ShopperDetail />} />
              <Route path="sellers" element={<Sellers />} />
              <Route path="sellers/:id" element={<SellerDetail />} />
              <Route path="merchants" element={<Merchants />} />
              <Route path="merchants/:id" element={<MerchantDetail />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:id" element={<ProductDetail />} />
              <Route path="categories" element={<Categories />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="finance" element={<Finance />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="support" element={<Support />} />
              <Route path="audit" element={<Audit />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
