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
      if (storedToken) {
        try {
          const profile = await authApi.getMe();
          setUser(profile);
          setToken(storedToken);
        } catch (err) {
          console.error('Session restoration failed:', err);
          localStorage.removeItem('docrag_access_token');
          localStorage.removeItem('docrag_refresh_token');
          setUser(null);
          setToken(null);
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
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const register = async (email, password, fullName) => {
    const data = await authApi.register(email, password, fullName);
    localStorage.setItem('docrag_access_token', data.access_token);
    localStorage.setItem('docrag_refresh_token', data.refresh_token);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const googleLogin = async (idToken) => {
    const data = await authApi.googleLogin(idToken);
    localStorage.setItem('docrag_access_token', data.access_token);
    localStorage.setItem('docrag_refresh_token', data.refresh_token);
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
