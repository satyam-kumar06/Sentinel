import './index.css'
import React, { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { create } from "zustand";

import App from "./App.jsx";
import "./index.css";

axios.defaults.baseURL = "http://localhost:8000";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

export const useSentinelStore = create((set) => ({
  lastAssessment: null,
  setLastAssessment: (result) => set({ lastAssessment: result }),

  weatherSnapshot: null,
  setWeatherSnapshot: (data) => set({ weatherSnapshot: data }),
}));

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);