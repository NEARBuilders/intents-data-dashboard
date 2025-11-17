import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import * as ReactDOMClient from "react-dom/client";
import App from "./App";
import "./index.css";
import { queryClient } from "./utils/orpc";

const isDevelopment = process.env.NODE_ENV === "development";

const render = async () => {
  const root = document.getElementById("root");

  if (root) {
    const rootInstance = ReactDOMClient.createRoot(root);

    const appComponent = isDevelopment ? (
      // In development, wrap App with DevWrapper
      await import(/* webpackChunkName: "dev-tools" */ "./dev/DevWrapper").then(
        ({ DevWrapper }) => <DevWrapper />
      )
    ) : (
      // In production, render App directly (router handles everything)
      <App />
    );

    rootInstance.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          {appComponent}
        </QueryClientProvider>
      </React.StrictMode>
    );
  }
};

render();
