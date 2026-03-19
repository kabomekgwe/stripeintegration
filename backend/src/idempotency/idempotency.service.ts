import {
  Injectable,
  OnModuleInit,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';

export interface IdempotencyRecord {
  status: 'processing' | 'completed' | 'failed' | 'hash_mismatch';
  requestHash: string;
  response?: {
    statusCode: number;
    body: unknown;
    headers?: Record<string, string>;
  };
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export interface IdempotencyOptions {
  ttlSeconds?: number;
  prefix?: string;
  failOpen?: boolean;
  storeResponse?: boolean;
}

const DEFAULT_OPTIONS: Required<IdempotencyOptions> = {
  ttlSeconds: 86400,
  prefix: 'idem',
  failOpen: false,
  storeResponse: true,
};

@Injectable()
export class IdempotencyService implements OnModuleInit {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly options: Required<IdempotencyOptions>;
  private failureCount = 0;
  private circuitOpen = false;
  private readonly failureThreshold = 5;
  private readonly resetTimeoutMs = 30000;

  constructor(
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Optional() options?: IdempotencyOptions,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  onModuleInit() {
    this.logger.log(
      `IdempotencyService initialized with TTL=${this.options.ttlSeconds}s, prefix=${this.options.prefix}`,
    );
  }

  private getKey(idempotencyKey: string, userId?: string): string {
    const parts = [this.options.prefix];
    if (userId) parts.push(userId);
    parts.push(idempotencyKey);
    return parts.join(':');
  }

  hashPayload(payload: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  async acquireLock(
    idempotencyKey: string,
    requestHash: string,
    userId?: string,
  ): Promise<{ acquired: boolean; existing?: IdempotencyRecord }> {
    const key = this.getKey(idempotencyKey, userId);
    const now = Date.now();

    const record: IdempotencyRecord = {
      status: 'processing',
      requestHash,
      createdAt: now,
    };

    const result = await this.redis.set(
      key,
      JSON.stringify(record),
      'EX',
      this.options.ttlSeconds,
      'NX',
    );

    if (result === 'OK') {
      return { acquired: true };
    }

    const existing = await this.getRecord(key);
    if (!existing) {
      return { acquired: true };
    }

    if (existing.requestHash !== requestHash) {
      return {
        acquired: false,
        existing: { ...existing, status: 'hash_mismatch' },
      };
    }

    return { acquired: false, existing };
  }

  async getRecord(key: string): Promise<IdempotencyRecord | null> {
    const stored = await this.redis.get(key);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as IdempotencyRecord;
    } catch {
      await this.redis.del(key);
      return null;
    }
  }

  async markCompleted(
    idempotencyKey: string,
    response: {
      statusCode: number;
      body: unknown;
      headers?: Record<string, string>;
    },
    userId?: string,
  ): Promise<void> {
    const key = this.getKey(idempotencyKey, userId);

    const record: IdempotencyRecord = {
      status: 'completed',
      requestHash: '',
      response: this.options.storeResponse ? response : undefined,
      createdAt: Date.now(),
      completedAt: Date.now(),
    };

    await this.redis.set(key, JSON.stringify(record), 'EX', this.options.ttlSeconds);
  }

  async markFailed(
    idempotencyKey: string,
    error: string,
    userId?: string,
  ): Promise<void> {
    const key = this.getKey(idempotencyKey, userId);

    const record: IdempotencyRecord = {
      status: 'failed',
      requestHash: '',
      error,
      createdAt: Date.now(),
      completedAt: Date.now(),
    };

    await this.redis.set(key, JSON.stringify(record), 'EX', this.options.ttlSeconds);
  }

  async releaseLock(idempotencyKey: string, userId?: string): Promise<void> {
    const key = this.getKey(idempotencyKey, userId);
    await this.redis.del(key);
  }

  async getCachedResponse(
    idempotencyKey: string,
    userId?: string,
  ): Promise<IdempotencyRecord | null> {
    const key = this.getKey(idempotencyKey, userId);
    return this.getRecord(key);
  }


  isCircuitOpen(): boolean {
    return this.circuitOpen;
  }
}

export function validateIdempotencyKey(key: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(key);
}
