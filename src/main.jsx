// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import "./index.css";
import App from "./App";
import Login from "./Login";
import Register from "./Register";
import RecruiterDashboard from "./RecruiterDashboard";

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main resume analyzer */}
        <Route path="/" element={<App />} />
        <Route path="/analyzer" element={<App />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Hiring manager / admin dashboard */}
        <Route path="/recruiter-dashboard" element={<RecruiterDashboard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
