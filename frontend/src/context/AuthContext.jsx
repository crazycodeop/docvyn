import React, { createContext, useState, useEffect, useContext } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('docrag_access_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('docrag_access_token');
      const storedUser = localStorage.getItem('docrag_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {}
      }
      if (storedToken) {
        try {
          const profile = await authApi.getMe();
          setUser(profile);
          localStorage.setItem('docrag_user', JSON.stringify(profile));
          setToken(storedToken);
        } catch (err) {
          console.error('Session restoration failed:', err);
          // ONLY clear session if server explicitly returned 401 (unauthorized / invalid token)
          // If server is temporarily restarting (502/503/Network Error), do NOT log out the user!
          if (err.response?.status === 401) {
            localStorage.removeItem('docrag_access_token');
            localStorage.removeItem('docrag_refresh_token');
            localStorage.removeItem('docrag_user');
            setUser(null);
            setToken(null);
          } else {
            // Keep existing token so user stays logged in across temporary server restarts
            setToken(storedToken);
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('docrag_access_token', data.access_token);
    localStorage.setItem('docrag_refresh_token', data.refresh_token);
    if (data.user) {
      localStorage.setItem('docrag_user', JSON.stringify(data.user));
    }
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const register = async (email, password, fullName) => {
    const data = await authApi.register(email, password, fullName);
    localStorage.setItem('docrag_access_token', data.access_token);
    localStorage.setItem('docrag_refresh_token', data.refresh_token);
    if (data.user) {
      localStorage.setItem('docrag_user', JSON.stringify(data.user));
    }
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const googleLogin = async (idToken) => {
    const data = await authApi.googleLogin(idToken);
    localStorage.setItem('docrag_access_token', data.access_token);
    localStorage.setItem('docrag_refresh_token', data.refresh_token);
    if (data.user) {
      localStorage.setItem('docrag_user', JSON.stringify(data.user));
    }
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('docrag_refresh_token');
    await authApi.logout(refreshToken);
    setToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
    } catch (err) {
      console.error('Profile refresh error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        googleLogin,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
