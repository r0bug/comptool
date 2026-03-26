import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Layout from "./components/Layout";

// Core pages — loaded eagerly (most visited)
import SearchPage from "./pages/SearchPage";
import BrowsePage from "./pages/BrowsePage";

// Lazy-loaded pages — only fetched when navigated to
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const SearchDetailPage = lazy(() => import("./pages/SearchDetailPage"));
const CompDetailPage = lazy(() => import("./pages/CompDetailPage"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminClientList = lazy(() => import("./pages/admin/AdminClientList"));
const AdminClientDetail = lazy(() => import("./pages/admin/AdminClientDetail"));
const RegisterPage = lazy(() => import("./pages/register/RegisterPage"));
const RegisterSuccess = lazy(() => import("./pages/register/RegisterSuccess"));
const BookmarkletPage = lazy(() => import("./pages/BookmarkletPage"));

function Loading() {
  return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Loading...</div>;
}

function App() {
  return (
    <BrowserRouter basename="/comp">
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Main app */}
          <Route element={<Layout />}>
            <Route index element={<SearchPage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="search/:id" element={<SearchDetailPage />} />
            <Route path="comp/:id" element={<CompDetailPage />} />
          </Route>

          {/* Admin panel */}
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="clients" element={<AdminClientList />} />
            <Route path="clients/:id" element={<AdminClientDetail />} />
          </Route>

          {/* Registration portal */}
          <Route path="register" element={<RegisterPage />} />
          <Route path="register/success" element={<RegisterSuccess />} />
          <Route path="bookmarklet" element={<BookmarkletPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
