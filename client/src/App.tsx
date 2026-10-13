import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Foundation from "./pages/Foundation";
import { GovernanceAuditQrVerification } from "./pages/GovernanceAuditQrVerification";
import { StockOpnameHistory } from "./components/StockOpnameHistory";
import OwnerLogin from "./pages/OwnerLogin";
import { Route, Switch } from "wouter";

function Router() {
  return <Switch>
    <Route path="/" component={() => <Foundation page="dashboard" />} />
    <Route path="/products" component={() => <Foundation page="products" />} />
    <Route path="/inventory" component={() => <Foundation page="inventory" />} />
    <Route path="/inventory/opname-history" component={StockOpnameHistory} />
    <Route path="/settings" component={() => <Foundation page="settings" />} />
    <Route path="/pos" component={() => <Foundation page="pos" />} />
    <Route path="/sales" component={() => <Foundation page="sales" />} />
    <Route path="/alerts" component={() => <Foundation page="alerts" />} />
    <Route path="/insights" component={() => <Foundation page="insights" />} />
    <Route path="/reports" component={() => <Foundation page="reports" />} />
    <Route path="/users" component={() => <Foundation page="users" />} />
    <Route path="/shift-check" component={() => <Foundation page="shift" />} />
    <Route path="/login" component={OwnerLogin} />
    <Route path="/verify" component={GovernanceAuditQrVerification} />
    <Route component={() => <Foundation page="dashboard" />} />
  </Switch>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Router /><Toaster richColors position="top-right" /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
