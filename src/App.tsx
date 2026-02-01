import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthWrapper from "@/components/layout/AuthWrapper";
import Navbar from "@/components/layout/Navbar";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import NewRequest from "./pages/NewRequest";
import RequestDetails from "./pages/RequestDetails";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminCredits from "./pages/admin/AdminCredits";
import AdminProviders from "./pages/admin/AdminProviders";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminRenders from "./pages/admin/AdminRenders";
import AdminAudit from "./pages/admin/AdminAudit";
import Templates from "./pages/Templates";
import VideoGenerator from "./pages/VideoGenerator";
import AvatarWorkspace from "./pages/AvatarWorkspace";
import CreateAvatar from "./pages/CreateAvatar";
import SoraStoryboardGenerator from "./pages/SoraStoryboardGenerator";
import Sora2LatestGenerator from "./pages/Sora2LatestGenerator";
import RunwayExtendGenerator from "./pages/RunwayExtendGenerator";
import BulkVideoGenerator from "./pages/BulkVideoGenerator";
import BulkWizard from "./pages/BulkWizard";
import BatchDetails from "./pages/BatchDetails";
import SmartBulkGenerator from "./pages/SmartBulkGenerator";
import LongFormGenerator from "./pages/LongFormGenerator";
import Pricing from "./pages/Pricing";
import Checkout from "./pages/Checkout";
import Billing from "./pages/Billing";
import ApiKeys from "./pages/ApiKeys";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import CheckoutCancel from "./pages/CheckoutCancel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <div className="min-h-screen bg-white font-sans text-slate-900">
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Navbar />
            <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/signup" element={<Auth />} />
          <Route 
            path="/dashboard" 
            element={
              <AuthWrapper>
                <Dashboard />
              </AuthWrapper>
            } 
          />
          <Route
            path="/avatar/:id"
            element={
              <AuthWrapper>
                <AvatarWorkspace />
              </AuthWrapper>
            }
          />
          <Route
            path="/create-avatar"
            element={
              <AuthWrapper>
                <CreateAvatar />
              </AuthWrapper>
            }
          />
          <Route 
            path="/new-request" 
            element={
              <AuthWrapper>
                <NewRequest />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/request/:id" 
            element={
              <AuthWrapper>
                <RequestDetails />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/templates" 
            element={
              <AuthWrapper>
                <Templates />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/video-generator" 
            element={
              <AuthWrapper>
                <VideoGenerator />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/sora-storyboard-generator" 
            element={
              <AuthWrapper>
                <SoraStoryboardGenerator />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/sora2-latest" 
            element={
              <AuthWrapper>
                <Sora2LatestGenerator />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/runway-extend" 
            element={
              <AuthWrapper>
                <RunwayExtendGenerator />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/bulk" 
            element={
              <AuthWrapper>
                <BulkWizard />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/bulk-video" 
            element={
              <AuthWrapper>
                <BulkVideoGenerator />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/batch/:id" 
            element={
              <AuthWrapper>
                <BatchDetails />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/smart-bulk" 
            element={
              <AuthWrapper>
                <SmartBulkGenerator />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/long-form" 
            element={
              <AuthWrapper>
                <LongFormGenerator />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <AuthWrapper>
                <AdminOverview />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/admin/users" 
            element={
              <AuthWrapper>
                <AdminUsers />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/admin/users/:id" 
            element={
              <AuthWrapper>
                <AdminUserDetail />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/admin/credits" 
            element={
              <AuthWrapper>
                <AdminCredits />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/admin/providers" 
            element={
              <AuthWrapper>
                <AdminProviders />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/admin/billing" 
            element={
              <AuthWrapper>
                <AdminBilling />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/admin/renders" 
            element={
              <AuthWrapper>
                <AdminRenders />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/admin/audit" 
            element={
              <AuthWrapper>
                <AdminAudit />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/pricing" 
            element={
              <AuthWrapper requireAuth={false}>
                <Pricing />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/checkout" 
            element={
              <AuthWrapper>
                <Checkout />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/checkout/success" 
            element={
              <AuthWrapper>
                <CheckoutSuccess />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/checkout/cancel" 
            element={
              <AuthWrapper>
                <CheckoutCancel />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/api-keys" 
            element={
              <AuthWrapper>
                <ApiKeys />
              </AuthWrapper>
            } 
          />
          <Route 
            path="/account/billing" 
            element={
              <AuthWrapper>
                <Billing />
              </AuthWrapper>
            } 
          />
          <Route 
            path="*" 
            element={
              <AuthWrapper requireAuth={false}>
                <NotFound />
              </AuthWrapper>
            } 
          />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </div>
);

export default App;
