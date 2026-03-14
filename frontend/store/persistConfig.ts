/**
 * RTK Query Persistence Configuration
 * 
 * Defines which endpoints should be persisted to:
 * - localStorage: Long-term data (survives browser restart)
 * - sessionStorage: Short-term data (cleared when tab closes)
 * - memory only: Sensitive/real-time data (default RTK Query behavior)
 * 
 * Cache Invalidation Strategy:
 * - Data persists until explicitly invalidated via cache tags
 * - Mutations automatically invalidate related tags
 * - Manual invalidation via dispatch(api.util.invalidateTags([...]))
 * - All cache cleared on logout
 */

export type StorageType = 'local' | 'session' | 'memory';

export interface PersistConfig {
  endpoint: string;
  storage: StorageType;
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
  'getMe': { endpoint: 'getMe', storage: 'local' },
  
  // Currency - Static data to localStorage
  'getCurrencies': { endpoint: 'getCurrencies', storage: 'local' },
  
  // Payment Methods - to localStorage
  'getPaymentMethods': { endpoint: 'getPaymentMethods', storage: 'local' },
  
  // Subscriptions - to localStorage
  'getSubscriptionPlans': { endpoint: 'getSubscriptionPlans', storage: 'local' },
  'getSubscription': { endpoint: 'getSubscription', storage: 'local' },
  
  // Payments - to sessionStorage
  'getPayments': { endpoint: 'getPayments', storage: 'session' },
  'getPayment': { endpoint: 'getPayment', storage: 'session' },
  
  // Usage - to sessionStorage
  'getUsage': { endpoint: 'getUsage', storage: 'session' },
  
  // Admin - to sessionStorage
  'getAdminDashboard': { endpoint: 'getAdminDashboard', storage: 'session' },
  'getAdminMetrics': { endpoint: 'getAdminMetrics', storage: 'session' },
  'getAdminRevenue': { endpoint: 'getAdminRevenue', storage: 'session' },
  
  // Disputes - to sessionStorage
  'getDisputes': { endpoint: 'getDisputes', storage: 'session' },
  'getMyDisputes': { endpoint: 'getMyDisputes', storage: 'session' },
  
  // Connect - to localStorage
  'getConnectedAccount': { endpoint: 'getConnectedAccount', storage: 'local' },
  'getPlatformBalance': { endpoint: 'getPlatformBalance', storage: 'session' },
};

/**
 * Get storage type for an endpoint
 */
export function getStorageType(endpointName: string): StorageType {
  return PERSIST_CONFIG[endpointName]?.storage ?? 'memory';
}

/**
 * Check if endpoint should be persisted
 */
export function shouldPersist(endpointName: string): boolean {
  return PERSIST_CONFIG[endpointName]?.storage !== 'memory';
}
