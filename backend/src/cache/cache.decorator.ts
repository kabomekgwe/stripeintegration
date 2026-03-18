import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'cache:key';
export const CACHE_TTL = 'cache:ttl';
export const CACHE_PREFIX = 'cache:prefix';

/**
 * Cache options for decorator
 */
export interface CacheableOptions {
  key: string | ((...args: unknown[]) => string);
  ttlSeconds?: number;
  prefix?: string;
}

/**
 * Decorator to cache method results
 * @param options - Cache options
 */
export function Cacheable(options: CacheableOptions): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    SetMetadata(CACHE_KEY, options.key)(target, propertyKey, descriptor);
    if (options.ttlSeconds) {
      SetMetadata(CACHE_TTL, options.ttlSeconds)(target, propertyKey, descriptor);
    }
    if (options.prefix) {
      SetMetadata(CACHE_PREFIX, options.prefix)(target, propertyKey, descriptor);
    }
    return descriptor;
  };
}

/**
 * Decorator to invalidate cache entries
 * @param keys - Keys to invalidate (can be patterns)
 */
export function CacheInvalidate(...keys: (string | ((...args: unknown[]) => string))[]): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    SetMetadata('cache:invalidate', keys)(target, propertyKey, descriptor);
    return descriptor;
  };
}