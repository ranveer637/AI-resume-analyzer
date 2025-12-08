// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import "./index.css";
import App from "./App";
import Login from "./Login";
import Register from "./Register";

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main resume analyzer */}
        <Route path="/" element={<App />} />
        {/* Optional alias route */}
        <Route path="/analyzer" element={<App />} />

        {/* Auth pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Fallback: any unknown route → home */}
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
