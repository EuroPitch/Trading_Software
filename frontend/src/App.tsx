// App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Error404 from "./pages/404";
import Dashboard from "./pages/Dashboard/Dashboard";
import StockMetrics from "./pages/Stocks/StockMetrics/StockMetrics";
import Standings from "./pages/Standings/Standings";
import { ProtectedRoute } from "./ProtectedRoute";
import { HomeRoute } from "./HomeRoute";
import Signup from "./pages/Auth/Signup";
import { CompetitionScoreProvider } from "./context/CompetitionScoreContext";

export default function App() {
  return (
    <CompetitionScoreProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomeRoute />} />

            {/* Dashboard and Portfolio temporarily accessible without auth for preview */}
            <Route path="dashboard" element={<Dashboard />} />

            <Route element={<ProtectedRoute />}>
              <Route path="stocks" element={<StockMetrics />} />
            </Route>

            <Route path="*" element={<Error404 />} />
          </Route>

          <Route path="/standings" element={<Standings />} />

          <Route
            path="/societies-and-whatnot-we-shall-see"
            element={<Signup />}
          />
        </Routes>
      </Router>
    </CompetitionScoreProvider>
  );
}
