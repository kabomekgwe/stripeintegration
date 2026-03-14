import type { Middleware, MiddlewareAPI, AnyAction } from '@reduxjs/toolkit';
import type { RootState } from './index';
import { PERSIST_CONFIG, getStorageType, getTTL, shouldPersist } from './persistConfig';

const RTK_QUERY_CACHE_KEY = 'rtk-query-cache-v1';
const RTK_QUERY_SESSION_KEY = 'rtk-query-session-v1';

interface CachedEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

interface RTKQueryFulfilledAction extends AnyAction {
  type: string;
  meta?: {
    arg?: {
      endpointName?: string;
      queryCacheKey?: string;
    };
  };
  payload?: unknown;
}

function isRTKQueryFulfilledAction(action: unknown): action is RTKQueryFulfilledAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    typeof (action as AnyAction).type === 'string' &&
    (action as AnyAction).type.endsWith('/fulfilled')
  );
}

/**
 * RTK Query Persistence Middleware
 * 
 * Automatically persists RTK Query cache to localStorage and sessionStorage
 * based on the configuration in persistConfig.ts
 */
export const rtkQueryPersistenceMiddleware: Middleware =
  (api: MiddlewareAPI) => (next) => (action) => {
    const result = next(action);

    // Only process RTK Query fulfilled actions
    if (isRTKQueryFulfilledAction(action)) {
      const endpointName = action.meta?.arg?.endpointName;
      const queryCacheKey = action.meta?.arg?.queryCacheKey;
      
      if (endpointName && shouldPersist(endpointName)) {
        const storageType = getStorageType(endpointName);
        const ttl = getTTL(endpointName);
        const cacheKey = `${endpointName}-${queryCacheKey || 'default'}`;
        
        const entry: CachedEntry = {
          data: action.payload,
          timestamp: Date.now(),
          ttl,
        };

        try {
          if (storageType === 'local') {
            const existing = JSON.parse(
              localStorage.getItem(RTK_QUERY_CACHE_KEY) || '{}'
            );
            localStorage.setItem(
              RTK_QUERY_CACHE_KEY,
              JSON.stringify({ ...existing, [cacheKey]: entry })
            );
          } else if (storageType === 'session') {
            const existing = JSON.parse(
              sessionStorage.getItem(RTK_QUERY_SESSION_KEY) || '{}'
            );
            sessionStorage.setItem(
              RTK_QUERY_SESSION_KEY,
              JSON.stringify({ ...existing, [cacheKey]: entry })
            );
          }
        } catch (error) {
          console.warn('Failed to persist RTK Query cache:', error);
        }
      }
    }

    // Clear cache on logout
    if (typeof action === 'object' && action !== null && 'type' in action && (action as AnyAction).type === 'auth/logout') {
      try {
        localStorage.removeItem(RTK_QUERY_CACHE_KEY);
        sessionStorage.removeItem(RTK_QUERY_SESSION_KEY);
      } catch (error) {
        console.warn('Failed to clear RTK Query cache:', error);
      }
    }

    return result;
  };

/**
 * Rehydrate RTK Query cache from storage
 * 
 * Call this function when initializing the app to restore cached data
 */
export function rehydrateRtkQueryCache(): Record<string, unknown> {
  const rehydrated: Record<string, unknown> = {};

  try {
    // Rehydrate from localStorage
    const localCache = JSON.parse(
      localStorage.getItem(RTK_QUERY_CACHE_KEY) || '{}'
    );
    
    for (const [key, entry] of Object.entries(localCache)) {
      const cached = entry as CachedEntry;
      if (Date.now() - cached.timestamp < cached.ttl) {
        rehydrated[key] = cached.data;
      }
    }

    // Rehydrate from sessionStorage
    const sessionCache = JSON.parse(
      sessionStorage.getItem(RTK_QUERY_SESSION_KEY) || '{}'
    );
    
    for (const [key, entry] of Object.entries(sessionCache)) {
      const cached = entry as CachedEntry;
      if (Date.now() - cached.timestamp < cached.ttl) {
        rehydrated[key] = cached.data;
      }
    }
  } catch (error) {
    console.warn('Failed to rehydrate RTK Query cache:', error);
  }

  return rehydrated;
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  try {
    // Clear expired localStorage entries
    const localCache = JSON.parse(
      localStorage.getItem(RTK_QUERY_CACHE_KEY) || '{}'
    );
    const now = Date.now();
    
    for (const [key, entry] of Object.entries(localCache)) {
      const cached = entry as CachedEntry;
      if (now - cached.timestamp > cached.ttl) {
        delete localCache[key];
      }
    }
    
    localStorage.setItem(RTK_QUERY_CACHE_KEY, JSON.stringify(localCache));

    // Clear expired sessionStorage entries
    const sessionCache = JSON.parse(
      sessionStorage.getItem(RTK_QUERY_SESSION_KEY) || '{}'
    );
    
    for (const [key, entry] of Object.entries(sessionCache)) {
      const cached = entry as CachedEntry;
      if (now - cached.timestamp > cached.ttl) {
        delete sessionCache[key];
      }
    }
    
    sessionStorage.setItem(RTK_QUERY_SESSION_KEY, JSON.stringify(sessionCache));
  } catch (error) {
    console.warn('Failed to clear expired cache:', error);
  }
}

/**
 * Get cache size info for debugging
 */
export function getCacheSizeInfo(): {
  localStorage: number;
  sessionStorage: number;
} {
  try {
    const localCache = localStorage.getItem(RTK_QUERY_CACHE_KEY) || '{}';
    const sessionCache = sessionStorage.getItem(RTK_QUERY_SESSION_KEY) || '{}';
    
    return {
      localStorage: new Blob([localCache]).size,
      sessionStorage: new Blob([sessionCache]).size,
    };
  } catch {
    return { localStorage: 0, sessionStorage: 0 };
  }
}
