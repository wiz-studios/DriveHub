// Audit Logging Service
// Tracks all critical operations for security and compliance

import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';

export type AuditAction =
  | 'booking_created'
  | 'booking_cancelled'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'rental_started'
  | 'rental_returned'
  | 'rental_approved'
  | 'rental_disputed'
  | 'damage_charge_applied'
  | 'refund_issued'
  | 'user_role_updated'
  | 'admin_access_granted'
  | 'admin_access_revoked'
  | 'vehicle_status_updated'
  | 'vehicle_created'
  | 'vehicle_deactivated'
  | 'inspection_completed'
  | 'gps_data_accessed'
  | 'settings_updated';

export interface AuditLog {
  id: string;
  action: AuditAction;
  userId: string;
  adminId?: string; // If performed by admin
  resourceType: 'booking' | 'rental' | 'payment' | 'user' | 'vehicle' | 'system';
  resourceId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  timestamp: number;
}

// Log an action
export async function logAudit(
  action: AuditAction,
  userId: string,
  resourceType: AuditLog['resourceType'],
  resourceId: string,
  options?: {
    adminId?: string;
    changes?: Record<string, any>;
    metadata?: Record<string, any>;
    status?: 'success' | 'failure';
    errorMessage?: string;
  }
): Promise<string> {
  try {
    const log: Omit<AuditLog, 'id'> = {
      action,
      userId,
      resourceType,
      resourceId,
      status: options?.status || 'success',
      timestamp: Date.now(),
      ...(options?.adminId && { adminId: options.adminId }),
      ...(options?.changes && { changes: options.changes }),
      ...(options?.metadata && { metadata: options.metadata }),
      ...(options?.errorMessage && { errorMessage: options.errorMessage }),
    };

    // Capture IP and user agent if in browser
    if (typeof window !== 'undefined') {
      log.userAgent = navigator.userAgent;
    }

    const docRef = await addDoc(collection(db, 'audit_logs'), log);
    return docRef.id;
  } catch (error) {
    console.error('[v0] Error logging audit:', error);
    // Don't throw - logging failure shouldn't break application
    return '';
  }
}

// Get audit logs for a resource
export async function getResourceAuditLogs(
  resourceId: string,
  resourceType?: AuditLog['resourceType']
): Promise<AuditLog[]> {
  try {
    let q = query(
      collection(db, 'audit_logs'),
      where('resourceId', '==', resourceId)
    );

    if (resourceType) {
      q = query(
        collection(db, 'audit_logs'),
        where('resourceId', '==', resourceId),
        where('resourceType', '==', resourceType)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AuditLog[];
  } catch (error) {
    console.error('[v0] Error getting audit logs:', error);
    return [];
  }
}

// Get audit logs for a user
export async function getUserAuditLogs(userId: string): Promise<AuditLog[]> {
  try {
    const q = query(
      collection(db, 'audit_logs'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AuditLog[];
    
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[v0] Error getting user audit logs:', error);
    return [];
  }
}

// Get audit logs by action
export async function getAuditLogsByAction(
  action: AuditAction,
  limitDays: number = 30
): Promise<AuditLog[]> {
  try {
    const cutoffTime = Date.now() - limitDays * 24 * 60 * 60 * 1000;

    const q = query(
      collection(db, 'audit_logs'),
      where('action', '==', action)
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AuditLog[];
    
    return logs
      .filter((log) => log.timestamp > cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[v0] Error getting audit logs by action:', error);
    return [];
  }
}

// Get failed operations
export async function getFailedOperations(
  limitDays: number = 30
): Promise<AuditLog[]> {
  try {
    const cutoffTime = Date.now() - limitDays * 24 * 60 * 60 * 1000;

    const q = query(
      collection(db, 'audit_logs'),
      where('status', '==', 'failure')
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AuditLog[];
    
    return logs
      .filter((log) => log.timestamp > cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[v0] Error getting failed operations:', error);
    return [];
  }
}

// Get admin actions
export async function getAdminActions(
  limitDays: number = 30
): Promise<AuditLog[]> {
  try {
    const cutoffTime = Date.now() - limitDays * 24 * 60 * 60 * 1000;

    const q = query(
      collection(db, 'audit_logs'),
      where('adminId', '!=', null)
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AuditLog[];
    
    return logs
      .filter((log) => log.timestamp > cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[v0] Error getting admin actions:', error);
    return [];
  }
}

// Helper: Log booking creation
export async function logBookingCreated(
  userId: string,
  bookingId: string,
  metadata: Record<string, any>
): Promise<void> {
  await logAudit('booking_created', userId, 'booking', bookingId, {
    metadata,
  });
}

// Helper: Log payment success
export async function logPaymentSuccess(
  userId: string,
  bookingId: string,
  amount: number,
  method: string
): Promise<void> {
  await logAudit('payment_succeeded', userId, 'payment', bookingId, {
    metadata: { amount, method },
  });
}

// Helper: Log rental started
export async function logRentalStarted(
  userId: string,
  rentalId: string,
  bookingId: string,
  vehicleId: string
): Promise<void> {
  await logAudit('rental_started', userId, 'rental', rentalId, {
    metadata: { bookingId, vehicleId },
  });
}

// Helper: Log rental returned
export async function logRentalReturned(
  userId: string,
  rentalId: string,
  returnOdometer: number,
  distance: number
): Promise<void> {
  await logAudit('rental_returned', userId, 'rental', rentalId, {
    metadata: { returnOdometer, distance },
  });
}

// Helper: Log damage charge applied
export async function logDamageChargeApplied(
  adminId: string,
  rentalId: string,
  damageCharge: number,
  description: string
): Promise<void> {
  await logAudit(
    'damage_charge_applied',
    adminId,
    'rental',
    rentalId,
    {
      adminId,
      metadata: { damageCharge, description },
    }
  );
}

// Helper: Log role update
export async function logRoleUpdate(
  adminId: string,
  userId: string,
  oldRole: string,
  newRole: string
): Promise<void> {
  await logAudit('user_role_updated', adminId, 'user', userId, {
    adminId,
    changes: { role: { old: oldRole, new: newRole } },
  });
}
