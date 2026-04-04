import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./context/AuthContext";
import { POSProvider } from "./context/POSContext";
import { BackendLayout } from "./components/layout/BackendLayout";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import NotFound from "@/pages/not-found";

// Pages
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Dashboard from "./pages/backend/Dashboard";
import Orders from "./pages/backend/Orders";
import Products from "./pages/backend/Products";
import Categories from "./pages/backend/Categories";
import PaymentMethods from "./pages/backend/PaymentMethods";
import Payments from "./pages/backend/Payments";
import Floors from "./pages/backend/Floors";
import FloorDetails from "./pages/backend/FloorDetails";
import Customers from "./pages/backend/Customers";
import PosConfig from "./pages/backend/PosConfig";
import Waiters from "./pages/backend/Waiters";
import QRCodes from "./pages/backend/QRCodes";
import Kitchen from "./pages/kitchen/Kitchen";
import CustomerDisplay from "./pages/customer/CustomerDisplay";
import SelfOrder from "./pages/customer/SelfOrder";
import TableBooking from "./pages/customer/TableBooking";
import POS from "./pages/pos/POS";
import WaiterPortal from "./pages/waiter/WaiterPortal";
import WaiterPOS from "./pages/waiter/WaiterPOS";
import Landing from "./pages/Landing";

const queryClient = new QueryClient();

function BackendRoute({ component: Component }: { component: React.ComponentType<any> }) {
  return (
    <ProtectedRoute>
      <BackendLayout>
        <Component />
      </BackendLayout>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/kitchen" component={Kitchen} />
      <Route path="/customer-display">
        <POSProvider>
          <CustomerDisplay />
        </POSProvider>
      </Route>
      <Route path="/table/:token" component={TableBooking} />
      <Route path="/self-order/:token" component={SelfOrder} />

      {/* POS Terminal */}
      <Route path="/pos">
        <ProtectedRoute>
          <POSProvider>
            <POS />
          </POSProvider>
        </ProtectedRoute>
      </Route>

      {/* Waiter Portal */}
      <Route path="/waiter">
        <ProtectedRoute>
          <WaiterPortal />
        </ProtectedRoute>
      </Route>
      <Route path="/waiter/pos">
        <ProtectedRoute>
          <POSProvider>
            <WaiterPOS />
          </POSProvider>
        </ProtectedRoute>
      </Route>

      {/* Backend Routes - flat (no nested Switch) to avoid wouter prefix-stripping */}
      <Route path="/backend">
        <Redirect to="/backend/pos-config" />
      </Route>
      <Route path="/backend/reporting">
        <BackendRoute component={Dashboard} />
      </Route>
      <Route path="/backend/orders">
        <BackendRoute component={Orders} />
      </Route>
      <Route path="/backend/products">
        <BackendRoute component={Products} />
      </Route>
      <Route path="/backend/categories">
        <BackendRoute component={Categories} />
      </Route>
      <Route path="/backend/payments">
        <BackendRoute component={Payments} />
      </Route>
      <Route path="/backend/payment-methods">
        <BackendRoute component={PaymentMethods} />
      </Route>
      {/* floors/:id MUST come before /floors to avoid prefix match */}
      <Route path="/backend/floors/:id">
        <BackendRoute component={FloorDetails} />
      </Route>
      <Route path="/backend/floors">
        <BackendRoute component={Floors} />
      </Route>
      <Route path="/backend/customers">
        <BackendRoute component={Customers} />
      </Route>
      <Route path="/backend/waiters">
        <BackendRoute component={Waiters} />
      </Route>
      <Route path="/backend/qr-codes">
        <BackendRoute component={QRCodes} />
      </Route>
      <Route path="/backend/pos-config">
        <BackendRoute component={PosConfig} />
      </Route>

      <Route path="/" component={Landing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
