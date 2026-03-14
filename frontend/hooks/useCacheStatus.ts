import { useEffect, useState } from 'react';
import { getCacheSizeInfo } from '@/store/persistenceMiddleware';

/**
 * Hook to track cache status
 * 
 * Returns information about the current cache state
 */
export function useCacheStatus() {
  const [cacheInfo, setCacheInfo] = useState({
    localStorage: 0,
    sessionStorage: 0,
  });

  useEffect(() => {
    setCacheInfo(getCacheSizeInfo());
  }, []);

  return {
    ...cacheInfo,
    totalSize: cacheInfo.localStorage + cacheInfo.sessionStorage,
    isUsingPersistence: cacheInfo.localStorage > 0 || cacheInfo.sessionStorage > 0,
  };
}

/**
 * Hook to check if data is stale
 * 
 * @param timestamp - The timestamp when data was fetched
 * @param maxAge - Maximum age in milliseconds
 */
export function useIsStale(timestamp: number | undefined, maxAge: number): boolean {
  if (!timestamp) return true;
  return Date.now() - timestamp > maxAge;
}

/**
 * Format cache size for display
 */
export function formatCacheSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
