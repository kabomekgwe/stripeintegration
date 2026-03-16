import { vi } from 'vitest';
import { PrismaService } from '../../src/database/prisma.service';

export type MockPrismaService = {
  [K in keyof PrismaService]: K extends '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use' | '$queryRaw' | '$executeRaw' | '$queryRawUnsafe' | '$executeRawUnsafe' | '$runCommandRaw' | '$metrics' | '$interactiveTransactions' | '$replica' | '$connecting' | '$disconnecting' | '$connected' | '$engine' | '$useAccelerate' | '$usePulse' | '$useFdw' | '$useReplica' | '$useMaster' | '$useReadReplica' | '$useWriteReplica' | '$useReadWriteReplica' | '$useReadOnlyReplica' | '$useReadWriteSplitting' | '$useConnectionPooling' | '$useQueryCache' | '$useResultCache' | '$useMiddleware' | '$useClientExtensions' | '$useFluentApi' | '$useJsonProtocol' | '$useAccelerateWithExtension' | '$usePulseWithExtension' | '$useFdwWithExtension' | '$useReplicaWithExtension' | '$useMasterWithExtension' | '$useReadReplicaWithExtension' | '$useWriteReplicaWithExtension' | '$useReadOnlyReplicaWithExtension' | '$useReadWriteSplittingWithExtension' | '$useConnectionPoolingWithExtension' | '$useQueryCacheWithExtension' | '$useResultCacheWithExtension' | '$useMiddlewareWithExtension' | '$useClientExtensionsWithExtension' | '$useFluentApiWithExtension' | '$useJsonProtocolWithExtension' ? vi.Mock : K extends 'user' ? MockPrismaUserDelegate : vi.Mock;
};

type MockPrismaUserDelegate = {
  create: vi.Mock;
  findUnique: vi.Mock;
  findFirst: vi.Mock;
  findMany: vi.Mock;
  update: vi.Mock;
  updateMany: vi.Mock;
  delete: vi.Mock;
  deleteMany: vi.Mock;
  count: vi.Mock;
  upsert: vi.Mock;
};

export function createMockPrismaService(): MockPrismaService {
  const mockUserDelegate: MockPrismaUserDelegate = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  };

  return {
    // Connection lifecycle
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $on: vi.fn(),

    // User operations
    user: mockUserDelegate,

    // Transaction support
    $transaction: vi.fn().mockImplementation((callback) => callback()),

    // Raw queries (optional, for advanced use cases)
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $runCommandRaw: vi.fn(),

    // Extensions and other properties
    $extends: vi.fn(),
    $use: vi.fn(),
    $metrics: vi.fn(),
    $interactiveTransactions: false,
    $replica: vi.fn(),
    $connecting: false,
    $disconnecting: false,
    $connected: true,
    $engine: {},
    $useAccelerate: vi.fn(),
    $usePulse: vi.fn(),
    $useFdw: vi.fn(),
    $useReplica: vi.fn(),
    $useMaster: vi.fn(),
    $useReadReplica: vi.fn(),
    $useWriteReplica: vi.fn(),
    $useReadOnlyReplica: vi.fn(),
    $useReadWriteSplitting: vi.fn(),
    $useConnectionPooling: vi.fn(),
    $useQueryCache: vi.fn(),
    $useResultCache: vi.fn(),
    $useMiddleware: vi.fn(),
    $useClientExtensions: vi.fn(),
    $useFluentApi: vi.fn(),
    $useJsonProtocol: vi.fn(),
    $useAccelerateWithExtension: vi.fn(),
    $usePulseWithExtension: vi.fn(),
    $useFdwWithExtension: vi.fn(),
    $useReplicaWithExtension: vi.fn(),
    $useMasterWithExtension: vi.fn(),
    $useReadReplicaWithExtension: vi.fn(),
    $useWriteReplicaWithExtension: vi.fn(),
    $useReadOnlyReplicaWithExtension: vi.fn(),
    $useReadWriteSplittingWithExtension: vi.fn(),
    $useConnectionPoolingWithExtension: vi.fn(),
    $useQueryCacheWithExtension: vi.fn(),
    $useResultCacheWithExtension: vi.fn(),
    $useMiddlewareWithExtension: vi.fn(),
    $useClientExtensionsWithExtension: vi.fn(),
    $useFluentApiWithExtension: vi.fn(),
    $useJsonProtocolWithExtension: vi.fn(),
  } as unknown as MockPrismaService;
}

// Pre-created mock for simple imports
export const mockPrismaService = createMockPrismaService();
