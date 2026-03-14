/**
 * RTK Query Persistence Configuration
 * 
 * Defines which endpoints should be persisted to:
 * - localStorage: Long-term data (survives browser restart)
 * - sessionStorage: Short-term data (cleared when tab closes)
 * - memory only: Sensitive/real-time data (default RTK Query behavior)
 */

export type StorageType = 'local' | 'session' | 'memory';

export interface PersistConfig {
  endpoint: string;
  storage: StorageType;
  ttl?: number; // Time to live in milliseconds
}

/**
 * Persistence Rules:
 * 
 * localStorage (survives browser restart):
 * - User profile (getMe)
 * - Currencies list (static data)
 * - Payment methods (convenience)
 * - Subscription plans (static data)
 * 
 * sessionStorage (cleared when tab closes):
 * - Payments list
 * - Usage records
 * - Current subscription
 * - Admin dashboard data
 * 
 * memory only (sensitive/real-time):
 * - Auth tokens/cookies (handled by httpOnly cookies)
 * - Billing preview (frequently changes)
 * - Currency conversion (real-time rates)
 * - Promo code validation (should be fresh)
 */
export const PERSIST_CONFIG: Record<string, PersistConfig> = {
  // Auth - User profile to localStorage
  'getMe': { endpoint: 'getMe', storage: 'local', ttl: 1000 * 60 * 60 * 24 }, // 24 hours
  
  // Currency - Static data to localStorage
  'getCurrencies': { endpoint: 'getCurrencies', storage: 'local', ttl: 1000 * 60 * 60 * 24 }, // 24 hours
  
  // Payment Methods - to localStorage
  'getPaymentMethods': { endpoint: 'getPaymentMethods', storage: 'local', ttl: 1000 * 60 * 60 }, // 1 hour
  
  // Subscriptions - to localStorage
  'getSubscriptionPlans': { endpoint: 'getSubscriptionPlans', storage: 'local', ttl: 1000 * 60 * 60 * 24 }, // 24 hours
  'getSubscription': { endpoint: 'getSubscription', storage: 'local', ttl: 1000 * 60 * 5 }, // 5 minutes
  
  // Payments - to sessionStorage
  'getPayments': { endpoint: 'getPayments', storage: 'session', ttl: 1000 * 60 * 5 }, // 5 minutes
  'getPayment': { endpoint: 'getPayment', storage: 'session', ttl: 1000 * 60 * 5 }, // 5 minutes
  
  // Usage - to sessionStorage
  'getUsage': { endpoint: 'getUsage', storage: 'session', ttl: 1000 * 60 * 2 }, // 2 minutes
  
  // Admin - to sessionStorage
  'getAdminDashboard': { endpoint: 'getAdminDashboard', storage: 'session', ttl: 1000 * 60 * 2 }, // 2 minutes
  'getAdminMetrics': { endpoint: 'getAdminMetrics', storage: 'session', ttl: 1000 * 60 * 2 },
  'getAdminRevenue': { endpoint: 'getAdminRevenue', storage: 'session', ttl: 1000 * 60 * 2 },
  
  // Disputes - to sessionStorage
  'getDisputes': { endpoint: 'getDisputes', storage: 'session', ttl: 1000 * 60 * 5 },
  'getMyDisputes': { endpoint: 'getMyDisputes', storage: 'session', ttl: 1000 * 60 * 5 },
  
  // Connect - to localStorage
  'getConnectedAccount': { endpoint: 'getConnectedAccount', storage: 'local', ttl: 1000 * 60 * 5 }, // 5 minutes
  'getPlatformBalance': { endpoint: 'getPlatformBalance', storage: 'session', ttl: 1000 * 60 * 2 }, // 2 minutes
};

/**
 * Get storage type for an endpoint
 */
export function getStorageType(endpointName: string): StorageType {
  return PERSIST_CONFIG[endpointName]?.storage ?? 'memory';
}

/**
 * Get TTL for an endpoint
 */
export function getTTL(endpointName: string): number {
  return PERSIST_CONFIG[endpointName]?.ttl ?? 0;
}

/**
 * Check if endpoint should be persisted
 */
export function shouldPersist(endpointName: string): boolean {
  return PERSIST_CONFIG[endpointName]?.storage !== 'memory';
}
