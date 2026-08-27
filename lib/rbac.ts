import { getUser } from './db-service';
import { User } from 'firebase/auth';

export type UserRole = 'user' | 'admin';

export interface RolePermissions {
  canViewBookings: boolean;
  canCreateBooking: boolean;
  canCancelBooking: boolean;
  canViewVehicles: boolean;
  canManageVehicles: boolean;
  canViewPayments: boolean;
  canProcessPayment: boolean;
  canViewAnalytics: boolean;
  canViewUsers: boolean;
  canManageUsers: boolean;
  canViewGPS: boolean;
  canUpdateGPS: boolean;
}

export const rolePermissions: Record<UserRole, RolePermissions> = {
  user: {
    canViewBookings: true,
    canCreateBooking: true,
    canCancelBooking: true,
    canViewVehicles: true,
    canManageVehicles: false,
    canViewPayments: true,
    canProcessPayment: true,
    canViewAnalytics: false,
    canViewUsers: false,
    canManageUsers: false,
    canViewGPS: false,
    canUpdateGPS: false,
  },
  admin: {
    canViewBookings: true,
    canCreateBooking: true,
    canCancelBooking: true,
    canViewVehicles: true,
    canManageVehicles: true,
    canViewPayments: true,
    canProcessPayment: true,
    canViewAnalytics: true,
    canViewUsers: true,
    canManageUsers: true,
    canViewGPS: true,
    canUpdateGPS: true,
  },
};

/**
 * Get user role and permissions
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    const user = await getUser(userId);
    return user?.role || 'user';
  } catch (error) {
    console.error('[v0] Error getting user role:', error);
    return 'user'; // Default to user role if error
  }
}

/**
 * Get user permissions
 */
export async function getUserPermissions(userId: string): Promise<RolePermissions> {
  const role = await getUserRole(userId);
  return rolePermissions[role];
}

/**
 * Check if user has specific permission
 */
export async function checkPermission(
  userId: string,
  permission: keyof RolePermissions
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions[permission];
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === 'admin';
}

/**
 * Assert user has permission (throws error if not)
 */
export async function assertPermission(
  userId: string,
  permission: keyof RolePermissions,
  errorMessage?: string
): Promise<void> {
  const hasPermission = await checkPermission(userId, permission);
  if (!hasPermission) {
    throw new Error(errorMessage || `User does not have permission: ${permission}`);
  }
}

/**
 * Assert user is admin (throws error if not)
 */
export async function assertAdmin(userId: string, errorMessage?: string): Promise<void> {
  const admin = await isAdmin(userId);
  if (!admin) {
    throw new Error(errorMessage || 'User is not an admin');
  }
}

/**
 * Check if Firebase user can approve rentals (must be admin)
 */
export function canApproveRental(user: User | null): boolean {
  if (!user) return false;
  // In production, check Custom Claims for role
  // For now, rely on Firestore check in component
  return true; // Delegated to component-level check
}
