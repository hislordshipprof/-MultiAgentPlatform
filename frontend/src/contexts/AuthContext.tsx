import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, LoginRequest, LoginResponse } from '../types/api';
import { authApi, handleApiError } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = authApi.getCurrentUser();
    if (storedUser && authApi.getToken()) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      const response: LoginResponse = await authApi.login(credentials);
      setUser(response.user);
      
      // Navigate based on role
      if (response.user.role === 'driver') {
        navigate('/dashboard/admin/routes');
      } else if (['admin', 'manager', 'dispatcher'].includes(response.user.role)) {
        navigate('/dashboard/admin/overview');
      } else {
        navigate('/dashboard/customer');
      }
    } catch (error) {
      const apiError = handleApiError(error);
      throw new Error(apiError.message || 'Login failed');
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    navigate('/');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
