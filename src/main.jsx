// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";         // <-- Default export from App.jsx
import "./index.css";            // Tailwind / global styles

// Ensure the root element exists
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error(
    'Root element "#root" not found. Check public/index.html or index.html.'
  );
}

// React 18 root API
createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
