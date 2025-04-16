"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getUserSession, clearUserSession, UserSession, ensureAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";

type AuthContextType = {
  user: UserSession | null;
  loading: boolean;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load user from localStorage on initial mount
  useEffect(() => {
    const loadUser = () => {
      // Ensure auth token exists
      ensureAuth();
      const session = getUserSession();
      setUser(session);
      setLoading(false);
    };

    loadUser();
  }, []);

  // Redirect to login if accessing protected routes
  useEffect(() => {
    if (!loading) {
      // Protected routes that require authentication
      const protectedRoutes = ['/dashboard', '/essays', '/profile'];
      const authRoutes = ['/auth/signin', '/auth/signup'];
      
      const isProtectedRoute = protectedRoutes.some(route => 
        pathname.startsWith(route)
      );
      
      const isAuthRoute = authRoutes.some(route => 
        pathname.startsWith(route)
      );

      if (isProtectedRoute && !user) {
        router.push('/auth/signin');
      } else if (isAuthRoute && user) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const signOut = () => {
    clearUserSession();
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
} 