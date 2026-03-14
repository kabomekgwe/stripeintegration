'use client';

import { useCacheStatus, formatCacheSize } from '@/hooks/useCacheStatus';
import { clearExpiredCache } from '@/store/persistenceMiddleware';
import { useState } from 'react';

/**
 * Cache Status Panel
 * 
 * Displays current cache status and allows clearing expired cache.
 * Useful for debugging and admin dashboards.
 */
export function CacheStatusPanel() {
  const cacheInfo = useCacheStatus();
  const [cleared, setCleared] = useState(false);

  const handleClearCache = () => {
    clearExpiredCache();
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Cache Status</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Local Storage:</span>
          <span className="font-medium">{formatCacheSize(cacheInfo.localStorage)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Session Storage:</span>
          <span className="font-medium">{formatCacheSize(cacheInfo.sessionStorage)}</span>
        </div>
        
        <div className="flex justify-between items-center pt-3 border-t">
          <span className="text-gray-600">Total Cache Size:</span>
          <span className="font-medium">{formatCacheSize(cacheInfo.totalSize)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Persistence Active:</span>
          <span className={`font-medium ${cacheInfo.isUsingPersistence ? 'text-green-600' : 'text-gray-400'}`}>
            {cacheInfo.isUsingPersistence ? 'Yes' : 'No'}
          </span>
        </div>
      </div>

      <button
        onClick={handleClearCache}
        className="mt-6 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors"
      >
        {cleared ? '✓ Cache Cleared' : 'Clear Expired Cache'}
      </button>
      
      <p className="mt-4 text-xs text-gray-500">
        Cache is automatically cleared when data expires or on logout.
      </p>
    </div>
  );
}
