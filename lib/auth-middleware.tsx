'use client';

import { useAuth } from './auth-context';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUser } from './db-service';
import { Loader2 } from 'lucide-react';

/**
 * Higher-order component for protecting routes that require authentication
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        router.push('/auth/login');
      }
    }, [user, loading, router]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      );
    }

    if (!user) {
      return null;
    }

    return <Component {...props} />;
  };
}

/**
 * Higher-order component for protecting admin routes
 */
export function withAdminAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AdminAuthenticatedComponent(props: P) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
      if (!loading && !user) {
        router.push('/auth/login');
        return;
      }

      if (user) {
        checkAdminStatus();
      }
    }, [user, loading]);

    const checkAdminStatus = async () => {
      try {
        const userData = await getUser(user!.uid);
        if (userData?.role === 'admin') {
          setIsAdmin(true);
          setChecking(false);
        } else {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('[v0] Error checking admin status:', error);
        router.push('/dashboard');
      }
    };

    if (loading || checking) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      );
    }

    if (!user || !isAdmin) {
      return null;
    }

    return <Component {...props} />;
  };
}

/**
 * Component to check permission and conditionally render
 */
export interface ProtectedElementProps {
  permission?: (role: string) => boolean;
  requiredRole?: 'admin' | 'user';
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProtectedElement({
  permission,
  requiredRole,
  children,
  fallback = null,
}: ProtectedElementProps) {
  const { user, loading } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!loading && user) {
      checkUserRole();
    } else if (!loading && !user) {
      setChecking(false);
    }
  }, [user, loading]);

  const checkUserRole = async () => {
    try {
      const userData = await getUser(user!.uid);
      setUserRole(userData?.role || 'user');
      setChecking(false);
    } catch (error) {
      console.error('[v0] Error checking user role:', error);
      setChecking(false);
    }
  };

  if (checking || loading) {
    return null;
  }

  if (!user) {
    return <>{fallback}</>;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <>{fallback}</>;
  }

  if (permission && !permission(userRole || 'user')) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
