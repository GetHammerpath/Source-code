import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewRequest from "./pages/NewRequest";
import RequestDetails from "./pages/RequestDetails";
import AdminUsers from "./pages/AdminUsers";
import Templates from "./pages/Templates";
import VideoGenerator from "./pages/VideoGenerator";
import SoraStoryboardGenerator from "./pages/SoraStoryboardGenerator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/new-request" element={<NewRequest />} />
          <Route path="/request/:id" element={<RequestDetails />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/video-generator" element={<VideoGenerator />} />
          <Route path="/sora-storyboard-generator" element={<SoraStoryboardGenerator />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
