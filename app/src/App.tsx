import { Routes, Route } from "react-router";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Listings from "./pages/Listings";
import ListingDetail from "./pages/ListingDetail";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import NewListing from "./pages/NewListing";
import Import from "./pages/Import";
import Messages from "./pages/Messages";
import DealRoom from "./pages/DealRoom";
import Developers from "./pages/Developers";
import Distressed from "./pages/Distressed";
import Admin from "./pages/Admin";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/listings/new" element={<NewListing />} />
          <Route path="/listings/:id" element={<ListingDetail />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/import" element={<Import />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:id" element={<Messages />} />
          <Route path="/deals/:id" element={<DealRoom />} />
          <Route path="/developers" element={<Developers />} />
          <Route path="/distressed" element={<Distressed />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
      <Toaster />
    </>
  );
}
