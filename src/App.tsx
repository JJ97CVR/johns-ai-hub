import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConversationsProvider } from "./contexts/ConversationsContext";
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy load components for better initial load performance
const Header = lazy(() => import("./components/Header"));
const Sidebar = lazy(() => import("./components/Sidebar"));
const Index = lazy(() => import("./pages/Index"));
const ChatExact = lazy(() => import("./pages/ChatExact"));
const Database = lazy(() => import("./pages/Database"));
const Personal = lazy(() => import("./pages/Personal"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminReview = lazy(() => import("./pages/AdminReview"));
const AdminMetrics = lazy(() => import("./pages/AdminMetrics"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConversationsProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
            
            {/* Chat route - dedicated full-screen chat */}
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatExact />
                </ProtectedRoute>
              }
            />
            
            {/* Other routes - with global header/sidebar */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-background">
                    <Header />
                    <div className="flex">
                      <Sidebar />
                      <main className="ml-64 flex-1 pt-[73px]">
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/database" element={<Database />} />
                          <Route path="/personal" element={<Personal />} />
                          <Route path="/admin/review" element={<AdminReview />} />
                          <Route path="/admin/metrics" element={<AdminMetrics />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ConversationsProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
