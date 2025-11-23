import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Error404 from "./pages/404.jsx";
import Portfolio from "./pages/Portfolio/Portfolio.jsx";
import StockMetrics from "./pages/Stocks/StockMetrics.jsx";
import Standings from "./pages/Standings/Standings.jsx";
import Login from "./pages/Auth/Login.jsx";
import Signup from "./pages/Auth/Signup.jsx";

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
          <Route path="/signup" element={<Signup />} />

          {/* 👇 Catch-all 404 lives INSIDE the Layout */}
          <Route path="*" element={<Error404 />} />
        </Route>
        <Route path="/standings" element={<Standings />} />
      </Routes>
    </Router>
  );
}

export default App;
