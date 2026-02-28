import axios from "axios";
import { useAuthStore } from "../stores/authStore";

export const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AUTH_ENDPOINTS = ["/auth/login", "/auth/register"];

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const requestUrl = err.config?.url ?? "";
    const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) =>
      requestUrl.startsWith(ep)
    );
    if (err.response?.status === 401 && !isAuthEndpoint) {
      useAuthStore.getState().clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);
