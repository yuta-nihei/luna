import React from "react";
import ReactDOM from "react-dom/client";
import { AppShell } from "@/ui/AppShell";
import "@fontsource-variable/roboto-mono"; // code font (wght axis)
import "@fontsource-variable/roboto-mono/wght-italic.css"; // italic (comments)
import "@/themes/tokens.css";
import "@/ui/app.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
