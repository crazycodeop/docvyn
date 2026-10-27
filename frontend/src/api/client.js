import axios from 'axios';

export const API_BASE_URL = import.meta.env?.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api/v1` 
  : '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('docrag_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 & token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('docrag_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token: newRefreshToken } = res.data;
          localStorage.setItem('docrag_access_token', access_token);
          if (newRefreshToken) {
            localStorage.setItem('docrag_refresh_token', newRefreshToken);
          }
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshErr) {
          // Only clear and redirect if the refresh endpoint explicitly returned 401
          if (refreshErr.response?.status === 401) {
            localStorage.removeItem('docrag_access_token');
            localStorage.removeItem('docrag_refresh_token');
            localStorage.removeItem('docrag_user');
            window.location.href = '/login';
          }
          return Promise.reject(refreshErr);
        }
      } else {
        localStorage.removeItem('docrag_access_token');
        localStorage.removeItem('docrag_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
