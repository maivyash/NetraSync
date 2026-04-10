import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import PlayOrbDrive from "./pages/PlayOrbDrive";
import PlayFusionHoops from "./pages/PlayFusionHoops";
import PlaySkyShotPro from "./pages/PlaySkyShotPro";
import ProtectedRoute from "./components/ProtectedRoute";
import ShapeMatch from "./games/ShapeMatch";
import "./App.css";

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#00f5ff",
          colorBgContainer: "#0d1117",
          colorBgElevated: "#0d1117",
          colorText: "#e8f4ff",
          colorTextSecondary: "#8ab0c8",
          colorBorder: "rgba(0,245,255,0.2)",
          borderRadius: 8,
          fontFamily: "'Inter', sans-serif",
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/relogin" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/play/orb-drive" element={<ProtectedRoute><PlayOrbDrive /></ProtectedRoute>} />
          <Route path="/play/fusion-hoops" element={<ProtectedRoute><PlayFusionHoops /></ProtectedRoute>} />
          <Route path="/play/sky-shot-pro" element={<ProtectedRoute><PlaySkyShotPro /></ProtectedRoute>} />
          <Route path="/teen" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/play/shape-match" element={<ProtectedRoute><ShapeMatch /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;