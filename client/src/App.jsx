import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import SearchPage from "./pages/SearchPage";
import HistoryPage from "./pages/HistoryPage";
import SearchDetailPage from "./pages/SearchDetailPage";
import CompDetailPage from "./pages/CompDetailPage";
import BrowsePage from "./pages/BrowsePage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminClientList from "./pages/admin/AdminClientList";
import AdminClientDetail from "./pages/admin/AdminClientDetail";
import RegisterPage from "./pages/register/RegisterPage";
import RegisterSuccess from "./pages/register/RegisterSuccess";
import BookmarkletPage from "./pages/BookmarkletPage";

function App() {
  return (
    <BrowserRouter basename="/comp">
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
    </BrowserRouter>
  );
}

export default App;
