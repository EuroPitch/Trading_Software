import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Error404 from "./pages/404";
import Portfolio from "./pages/Portfolio/Portfolio";
import StockMetrics from "./pages/Stocks/StockMetrics";
import Standings from "./pages/Standings/Standings";
import Login from "./pages/Auth/Login";

function App() {
  return (
    <Router>
      <Routes>
        {/* Layout wrapper for all normal pages */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Portfolio />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/stocks" element={<StockMetrics />} />
          <Route path="/login" element={<Login />} />

          {/* 👇 Catch-all 404 lives INSIDE the Layout */}
          <Route path="*" element={<Error404 />} />
        </Route>
        <Route path="/standings" element={<Standings />} />
      </Routes>
    </Router>
  );
}

export default App;
