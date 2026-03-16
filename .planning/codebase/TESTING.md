# Testing Patterns

**Analysis Date:** 2026-03-16

## Test Framework

### Backend (NestJS)

**Runner:** Jest (v30.0.0) with ts-jest
**Configuration:** Inline in `package.json`

```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

**Run Commands:**
```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:cov      # With coverage
npm run test:e2e      # E2E tests
```

### Frontend (Next.js)

**Current State:** No test framework configured
**Recommendation:** Add Vitest + React Testing Library + MSW

---

## Test File Organization

### Backend Structure

```
backend/
├── src/
│   ├── payments/
│   │   ├── payments.service.ts
│   │   ├── payments.controller.ts
│   │   └── payments.module.ts
│   │   # No co-located tests
│   ├── app.controller.ts
│   └── app.controller.spec.ts  # Test alongside source
├── test/
│   ├── app.e2e-spec.ts         # E2E tests
│   └── jest-e2e.json           # E2E config
```

**Pattern:** Tests are co-located with source files using `.spec.ts` suffix

### Frontend Structure (Recommended)

```
frontend/
├── app/
│   ├── payments/
│   │   ├── page.tsx
│   │   └── page.test.tsx       # Co-located tests
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx
├── store/
│   ├── api/
│   │   └── paymentsApi.ts
│   └── __tests__/               # Or co-located
│       └── paymentsApi.test.ts
```

---

## Unit Test Patterns

### Backend Service Tests (NestJS)

```typescript
// app.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
```

### Service with Dependencies Pattern

```typescript
// Example pattern for testing services with dependencies
describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: jest.Mocked<PrismaService>;
  let stripeService: jest.Mocked<StripeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: {
            paymentRecord: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: StripeService,
          useValue: {
            createPaymentIntent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PaymentsService);
    prisma = module.get(PrismaService);
    stripeService = module.get(StripeService);
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent successfully', async () => {
      // Arrange
      const mockStripeResult = {
        id: 'pi_123',
        client_secret: 'secret_123',
      };
      stripeService.createPaymentIntent.mockResolvedValue(mockStripeResult);

      // Act
      const result = await service.createPaymentIntent({
        userId: 'user_123',
        amount: 1000,
        currency: 'usd',
      });

      // Assert
      expect(result.clientSecret).toBe('secret_123');
      expect(stripeService.createPaymentIntent).toHaveBeenCalled();
    });

    it('should throw NotFoundException when payment method not found', async () => {
      // Arrange
      prisma.paymentRecord.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createPaymentIntent({
          userId: 'user_123',
          amount: 1000,
          currency: 'usd',
          paymentMethodId: 'invalid',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```

---

## E2E Test Patterns

### Backend E2E (Supertest)

```typescript
// test/app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
```

### E2E Pattern for Auth-Protected Routes

```typescript
describe('Payments (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    authToken = loginResponse.body.accessToken;
  });

  it('should get payments when authenticated', () => {
    return request(app.getHttpServer())
      .get('/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.payments).toBeDefined();
        expect(Array.isArray(res.body.payments)).toBe(true);
      });
  });

  it('should return 401 when not authenticated', () => {
    return request(app.getHttpServer())
      .get('/payments')
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## Mocking Patterns

### Backend Mocking

**Mock External Services:**
```typescript
// Mock Stripe service
const mockStripeService = {
  createPaymentIntent: jest.fn(),
  retrievePaymentIntent: jest.fn(),
  createRefund: jest.fn(),
};

// Mock Redis
const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  checkIdempotency: jest.fn(),
  setIdempotency: jest.fn(),
};

// Mock Mail service (don't send real emails in tests)
const mockMailService = {
  sendPaymentReceipt: jest.fn(),
  sendPaymentFailed: jest.fn(),
  sendWelcome: jest.fn(),
};
```

**Mock Prisma:**
```typescript
const mockPrismaService = {
  paymentRecord: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refund: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaService)),
};
```

### Reset Mocks Between Tests

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});

// Or in jest config:
{
  "jest": {
    "clearMocks": true  // Automatically clear mocks between tests
  }
}
```

---

## Coverage

### Current Configuration

```json
{
  "jest": {
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage"
  }
}
```

**No explicit thresholds set** - recommend adding:

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 70,
        "lines": 70,
        "statements": 70
      },
      "./src/services/": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

---

## Test Types

### Unit Tests (Backend)

**Scope:** Individual services, controllers, guards
**Location:** Co-located with source (`.spec.ts`)
**Example:**
```typescript
describe('PaymentsService', () => {
  describe('createPaymentIntent', () => {
    it('should validate currency before creating');
    it('should check idempotency cache');
    it('should calculate tax when enabled');
    it('should throw if payment method not found');
  });

  describe('confirmPayment', () => {
    it('should update status from Stripe response');
    it('should send receipt email on success');
    it('should send failure email on error');
  });
});
```

### Integration Tests (Backend)

**Scope:** Controller + Service + Database
**Location:** `test/` directory or `.integration-spec.ts`
**Example:**
```typescript
describe('Payments Integration', () => {
  it('should create payment and store in database');
  it('should process refund and update payment status');
  it('should handle Stripe webhook and update payment');
});
```

### E2E Tests (Backend)

**Scope:** Full HTTP request/response cycle
**Location:** `test/*.e2e-spec.ts`
**Pattern:**
```typescript
describe('Payments Flow (e2e)', () => {
  it('POST /payments/intent -> creates payment intent');
  it('POST /payments/:id/confirm -> confirms payment');
  it('GET /payments -> returns user payments');
  it('POST /payments/:id/refund -> creates refund');
});
```

---

## Frontend Testing (Recommended Setup)

### Recommended Stack

```bash
# Install testing dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw
```

### Component Test Pattern

```typescript
// components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('should render with default variant', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('should be disabled when loading', () => {
    render(<Button disabled>Loading</Button>);
    expect(screen.getByText('Loading')).toBeDisabled();
  });
});
```

### RTK Query Test Pattern

```typescript
// store/api/paymentsApi.test.ts
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { useGetPaymentsQuery } from './paymentsApi';

const server = setupServer(
  rest.get('/api/payments', (req, res, ctx) => {
    return res(ctx.json({ payments: [] }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('paymentsApi', () => {
  it('should fetch payments', async () => {
    const { result } = renderHook(() => useGetPaymentsQuery(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.payments).toEqual([]);
  });
});
```

---

## Test Data

### Factories (Recommended)

```typescript
// test/factories/user.factory.ts
export const createUser = (overrides: Partial<User> = {}): User => ({
  id: `usr_${randomUUID()}`,
  email: `user-${randomUUID()}@example.com`,
  name: 'Test User',
  role: 'USER',
  preferredCurrency: 'usd',
  country: 'US',
  ...overrides,
});

// test/factories/payment.factory.ts
export const createPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: `pay_${randomUUID()}`,
  stripePaymentIntentId: `pi_${randomUUID()}`,
  amount: 1000,
  currency: 'usd',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
  ...overrides,
});
```

### Fixtures

```typescript
// test/fixtures/payments.ts
export const mockPaymentIntent = {
  id: 'pi_123',
  client_secret: 'secret_123',
  status: 'requires_confirmation',
};

export const mockStripeRefund = {
  id: 're_123',
  amount: 1000,
  status: 'succeeded',
};
```

---

## Common Test Patterns

### Async Testing

```typescript
// Backend
it('should create payment', async () => {
  const result = await service.createPaymentIntent(params);
  expect(result.clientSecret).toBeDefined();
});

// Frontend
it('should display loading state', async () => {
  render(<PaymentsPage />);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
});
```

### Error Testing

```typescript
// Backend
it('should throw NotFoundException when payment not found', async () => {
  prisma.paymentRecord.findFirst.mockResolvedValue(null);

  await expect(service.findById('invalid', 'user_123'))
    .rejects
    .toThrow(NotFoundException);
});

// Frontend
it('should display error message', async () => {
  server.use(
    rest.get('/api/payments', (req, res, ctx) => {
      return res(ctx.status(500), ctx.json({ message: 'Server error' }));
    })
  );

  render(<PaymentsPage />);
  await waitFor(() => expect(screen.getByText('Failed to load')).toBeInTheDocument());
});
```

---

## Testing Checklist

### Before Committing

- [ ] All unit tests pass
- [ ] New code has corresponding tests
- [ ] Tests are deterministic (no flakiness)
- [ ] Mocks are properly reset between tests
- [ ] No `console.log` in tests
- [ ] Test descriptions are clear and descriptive

### Coverage Targets (Recommended)

| Component Type | Target Coverage |
|----------------|-----------------|
| Services (Backend) | 80% |
| Controllers (Backend) | 70% |
| DTOs/Validation | 90% |
| Utilities | 70% |
| Components (Frontend) | 70% |
| API Slices (Frontend) | 60% |

---

## Current Test Status

**Backend:**
- Framework: Jest configured and working
- Coverage: Basic setup, no thresholds enforced
- Test files: Minimal (only `app.controller.spec.ts` and `app.e2e-spec.ts`)
- Gap: Most services and controllers lack tests

**Frontend:**
- Framework: Not configured
- Recommendation: Add Vitest + React Testing Library + MSW
- Priority: Test API slices and critical components first

---

*Testing analysis: 2026-03-16*
