// App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Error404 from "./pages/404";
import Portfolio from "./pages/Portfolio/Portfolio";
import StockMetrics from "./pages/Stocks/StockMetrics";
import Standings from "./pages/Standings/Standings";
import { ProtectedRoute } from "./ProtectedRoute";
import { HomeRoute } from "./HomeRoute";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* If authed -> /portfolio, else show Login */}
          <Route index element={<HomeRoute />} />

          <Route element={<ProtectedRoute />}>
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="stocks" element={<StockMetrics />} />
          </Route>

          <Route path="*" element={<Error404 />} />
        </Route>

        <Route path="/standings" element={<Standings />} />
      </Routes>
    </Router>
  );
}