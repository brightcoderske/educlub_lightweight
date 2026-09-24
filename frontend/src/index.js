/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "App";
import AppErrorBoundary from "components/AppErrorBoundary";
import { reloadForNewVersion } from "lib/staleBuild";

// Material Dashboard 2 React Context Provider
import { MaterialUIControllerProvider } from "context";

const container = document.getElementById("app");

if (container.dataset.seoSnapshot) {
  container.innerHTML = "";
  container.style.visibility = "";
  delete container.dataset.seoSnapshot;
}

// A page opened before a release asks for screens that no longer exist. Vite reports
// that here, before React is involved, and loading the page again is the cure.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

const root = createRoot(container);

root.render(
  <BrowserRouter>
    <AppErrorBoundary>
      <MaterialUIControllerProvider>
        <App />
      </MaterialUIControllerProvider>
    </AppErrorBoundary>
  </BrowserRouter>
);
