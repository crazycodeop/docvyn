import api from './client';

export const authApi = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (email, password, fullName) => {
    const response = await api.post('/auth/register', {
      email,
      password,
      full_name: fullName,
    });
    return response.data;
  },

  googleLogin: async (token) => {
    const response = await api.post('/auth/google', { token });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateMe: async (data) => {
    const response = await api.patch('/auth/me', data);
    return response.data;
  },

  logout: async (refreshToken) => {
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refresh_token: refreshToken });
      }
    } finally {
      localStorage.removeItem('docrag_access_token');
      localStorage.removeItem('docrag_refresh_token');
      localStorage.removeItem('docrag_user');
    }
  },
};
