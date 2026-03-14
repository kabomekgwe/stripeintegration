# Production-Ready Multi-Currency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the multi-currency system production-ready with Stripe Exchange Rates API, user-provided country selection, Redis caching, and comprehensive error handling.

**Architecture:** 
- Exchange rates fetched from Stripe Exchange Rates API with Redis caching
- User provides country during registration/settings (no IP geolocation)
- Country-to-currency mapping in the backend
- Background job for daily rate updates
- Comprehensive logging

**Tech Stack:** 
- Stripe Exchange Rates API (already integrated)
- Redis for caching (already configured)
- Bull queue for background jobs
- Winston for structured logging

---

## Task 1: Add Stripe Exchange Rates API Integration

**Files:**
- Create: `backend/src/currency/exchange-rate.service.ts`
- Modify: `backend/src/currency/currency.module.ts`
- Modify: `backend/src/currency/currency.service.ts`

**Step 1: Create ExchangeRateService using Stripe**

```typescript
// backend/src/currency/exchange-rate.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StripeService } from '../stripe/stripe.service';
import { RedisService } from '../redis/redis.service';

interface ExchangeRateResponse {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

@Injectable()
export class ExchangeRateService implements OnModuleInit {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly CACHE_KEY = 'exchange:rates';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly stripeService: StripeService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    this.logger.log('ExchangeRateService initialized with Stripe');
  }

  async fetchLatestRates(): Promise<ExchangeRateResponse | null> {
    try {
      // Use Stripe's Exchange Rates API
      const rates = await this.stripeService.getExchangeRates();
      
      return {
        base: 'USD',
        rates,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch exchange rates from Stripe:', error.message);
      return null;
    }
  }

  async getCachedRates(): Promise<Record<string, number> | null> {
    const cached = await this.redisService.get(this.CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  async cacheRates(rates: Record<string, number>): Promise<void> {
    await this.redisService.set(
      this.CACHE_KEY,
      JSON.stringify(rates),
      this.CACHE_TTL,
    );
  }

  async refreshRates(): Promise<boolean> {
    const rates = await this.fetchLatestRates();
    if (rates) {
      await this.cacheRates(rates.rates);
      this.logger.log('Exchange rates refreshed successfully from Stripe');
      return true;
    }
    return false;
  }
}
```

**Step 2: Add getExchangeRates method to StripeService**

```typescript
// backend/src/stripe/stripe.service.ts
// Add this method to the StripeService class

  /**
   * Get exchange rates from Stripe
   * Returns rates relative to USD
   */
  async getExchangeRates(): Promise<Record<string, number>> {
    // Stripe Exchange Rates API returns rates for all supported currencies
    const response = await this.stripe.exchangeRates.list();
    
    const rates: Record<string, number> = {};
    
    // Convert Stripe's format to our format
    for (const rate of response.data) {
      rates[rate.id.toLowerCase()] = rate.rate;
    }
    
    // Ensure USD is 1.0 (base currency)
    rates['usd'] = 1.0;
    
    return rates;
  }
```

**Step 3: Update CurrencyModule**

```typescript
// backend/src/currency/currency.module.ts
import { Module } from '@nestjs/common';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { ExchangeRateService } from './exchange-rate.service';
import { StripeModule } from '../stripe/stripe.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [StripeModule, RedisModule],
  controllers: [CurrencyController],
  providers: [CurrencyService, ExchangeRateService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
```

**Step 4: Update CurrencyService to use ExchangeRateService**

```typescript
// backend/src/currency/currency.service.ts
// Add to imports
import { ExchangeRateService } from './exchange-rate.service';

// Add to constructor
constructor(
  private readonly configService: ConfigService,
  private readonly exchangeRateService: ExchangeRateService,
) {}

// Update initializeExchangeRates method
private async initializeExchangeRates(): Promise<void> {
  // Try to get cached rates first
  const cachedRates = await this.exchangeRateService.getCachedRates();
  
  if (cachedRates) {
    this.exchangeRates.clear();
    for (const [code, rate] of Object.entries(cachedRates)) {
      this.exchangeRates.set(code.toLowerCase(), rate);
    }
    this.lastRateUpdate = new Date();
    this.logger.log('Loaded exchange rates from cache');
    return;
  }

  // Fetch fresh rates from Stripe
  const success = await this.exchangeRateService.refreshRates();
  
  if (success) {
    const freshRates = await this.exchangeRateService.getCachedRates();
    if (freshRates) {
      this.exchangeRates.clear();
      for (const [code, rate] of Object.entries(freshRates)) {
        this.exchangeRates.set(code.toLowerCase(), rate);
      }
      this.lastRateUpdate = new Date();
    }
  } else {
    // Fallback to static rates
    this.logger.warn('Using fallback exchange rates');
    this.exchangeRates.set('usd', 1.0);
    this.exchangeRates.set('eur', 0.85);
    this.exchangeRates.set('gbp', 0.73);
    this.exchangeRates.set('cad', 1.25);
    this.exchangeRates.set('aud', 1.35);
    this.exchangeRates.set('jpy', 110.0);
    this.lastRateUpdate = new Date();
  }
}
```

**Step 5: Commit**

```bash
git add backend/src/currency/exchange-rate.service.ts backend/src/currency/currency.module.ts backend/src/currency/currency.service.ts backend/src/stripe/stripe.service.ts
git commit -m "feat: add Stripe Exchange Rates API integration with Redis caching"
```

---

## Task 2: Add Country Field to User Model

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20250312_add_country/migration.sql`
- Modify: `backend/src/users/entities/user.entity.ts`
- Modify: `backend/src/auth/dto/register.dto.ts`

**Step 1: Add country field to Prisma schema**

```prisma
// backend/prisma/schema.prisma
model User {
  id                String   @id @default(cuid())
  email             String   @unique
  password          String
  name              String?
  role              Role     @default(USER)
  preferredCurrency String   @default("usd")
  country           String?  // ISO 3166-1 alpha-2 code (e.g., "US", "DE")
  stripeCustomerId  String?  @unique
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  paymentMethods PaymentMethod[]
  payments       Payment[]
  usageRecords   Usage[]
  subscriptions  Subscription[]
  promoCodeUsages PromoCodeUsage[]
}
```

**Step 2: Create migration**

```bash
cd backend && npx prisma migrate dev --name add_country
```

**Step 3: Update UserEntity**

```typescript
// backend/src/users/entities/user.entity.ts
export class UserEntity {
  id: string;
  email: string;
  name?: string;
  role: 'USER' | 'ADMIN';
  preferredCurrency: string;
  country?: string;  // NEW
  stripeCustomerId?: string;
  createdAt: Date;
}
```

**Step 4: Update RegisterDto**

```typescript
// backend/src/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

const validCountries = [
  'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'AU', 'JP',
  // Add more as needed
];

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @IsIn(validCountries, { message: 'Invalid country code' })
  country?: string;
}
```

**Step 5: Update AuthService to handle country**

```typescript
// backend/src/auth/auth.service.ts
// In register method, pass country to user creation
async register(dto: RegisterDto) {
  // ... existing code
  
  const user = await this.usersService.create({
    email: dto.email,
    password: hashedPassword,
    name: dto.name,
    country: dto.country,  // NEW
  });
  
  // ... rest of code
}
```

**Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/ backend/src/users/entities/user.entity.ts backend/src/auth/dto/register.dto.ts backend/src/auth/auth.service.ts
git commit -m "feat: add country field to user model"
```

---

## Task 3: Add Country-to-Currency Mapping

**Files:**
- Modify: `backend/src/currency/currency.service.ts`

**Step 1: Expand country-to-currency mapping**

```typescript
// backend/src/currency/currency.service.ts
// Replace existing getCurrencyFromCountry with comprehensive mapping

  /**
   * Get currency from country code (ISO 3166-1 alpha-2)
   */
  getCurrencyFromCountry(countryCode: string): string {
    const countryToCurrency: Record<string, string> = {
      // North America
      'US': 'usd',
      'CA': 'cad',
      'MX': 'mxn',
      // Europe
      'GB': 'gbp',
      'DE': 'eur',
      'FR': 'eur',
      'IT': 'eur',
      'ES': 'eur',
      'NL': 'eur',
      'BE': 'eur',
      'AT': 'eur',
      'IE': 'eur',
      'PT': 'eur',
      'FI': 'eur',
      'GR': 'eur',
      'CY': 'eur',
      'MT': 'eur',
      'SK': 'eur',
      'SI': 'eur',
      'EE': 'eur',
      'LV': 'eur',
      'LT': 'eur',
      'LU': 'eur',
      'CH': 'chf',
      'NO': 'nok',
      'SE': 'sek',
      'DK': 'dkk',
      'PL': 'pln',
      'CZ': 'czk',
      'HU': 'huf',
      'RO': 'ron',
      'BG': 'bgn',
      'HR': 'hrk',
      'RS': 'rsd',
      // Asia-Pacific
      'JP': 'jpy',
      'AU': 'aud',
      'NZ': 'nzd',
      'SG': 'sgd',
      'HK': 'hkd',
      'KR': 'krw',
      'CN': 'cny',
      'IN': 'inr',
      'TH': 'thb',
      'MY': 'myr',
      'ID': 'idr',
      'PH': 'php',
      'VN': 'vnd',
      // Middle East
      'AE': 'aed',
      'SA': 'sar',
      'IL': 'ils',
      'QA': 'qar',
      'KW': 'kwd',
      'BH': 'bhd',
      'OM': 'omr',
      // Africa
      'ZA': 'zar',
      'EG': 'egp',
      'NG': 'ngn',
      'KE': 'kes',
      'GH': 'ghs',
      // South America
      'BR': 'brl',
      'AR': 'ars',
      'CL': 'clp',
      'CO': 'cop',
      'PE': 'pen',
      'UY': 'uyu',
      // Default
    };

    return countryToCurrency[countryCode.toUpperCase()] || 'usd';
  }

  /**
   * Suggest currency based on user country
   */
  suggestCurrencyForUser(countryCode?: string): { currency: string; source: string } {
    if (!countryCode) {
      return { currency: 'usd', source: 'default' };
    }

    const currency = this.getCurrencyFromCountry(countryCode);
    const isSupported = this.isSupported(currency);
    
    if (isSupported) {
      return { currency, source: 'country' };
    }
    
    // If currency not supported, fallback to USD
    return { currency: 'usd', source: 'default' };
  }
```

**Step 2: Commit**

```bash
git add backend/src/currency/currency.service.ts
git commit -m "feat: add comprehensive country-to-currency mapping"
```

---

## Task 4: Add Country Selection to Registration

**Files:**
- Modify: `frontend/app/auth/register/page.tsx`
- Modify: `frontend/types/index.ts`

**Step 1: Update User type**

```typescript
// frontend/types/index.ts
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'USER' | 'ADMIN';
  preferredCurrency: string;
  country?: string;  // NEW
}
```

**Step 2: Update registration page with country selector**

```typescript
// frontend/app/auth/register/page.tsx
// Add country state and selector

const [country, setCountry] = useState('');

const countries = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  // Add more as needed
];

// In form submission
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await register({
      email,
      password,
      name: name || undefined,
      country: country || undefined,
    }).unwrap();
    // ...
  } catch (err) {
    // ...
  }
};

// Add to form JSX
<div>
  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
    Country (Optional)
  </label>
  <select
    id="country"
    value={country}
    onChange={(e) => setCountry(e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
  >
    <option value="">Select your country</option>
    {countries.map((c) => (
      <option key={c.code} value={c.code}>
        {c.flag} {c.name}
      </option>
    ))}
  </select>
  <p className="text-sm text-gray-500 mt-1">
    We'll suggest the best currency for your region
  </p>
</div>
```

**Step 3: Commit**

```bash
git add frontend/app/auth/register/page.tsx frontend/types/index.ts
git commit -m "feat: add country selection to registration"
```

---

## Task 5: Add Country Setting to Settings Page

**Files:**
- Modify: `frontend/app/settings/page.tsx`
- Modify: `backend/src/users/users.service.ts`
- Modify: `backend/src/users/users.controller.ts`

**Step 1: Add updateCountry method to UsersService**

```typescript
// backend/src/users/users.service.ts
async updateCountry(userId: string, country: string): Promise<UserEntity> {
  const user = await this.prisma.user.update({
    where: { id: userId },
    data: { country },
  });

  // Auto-update currency based on country
  const suggestedCurrency = this.currencyService.getCurrencyFromCountry(country);
  if (this.currencyService.isSupported(suggestedCurrency)) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { preferredCurrency: suggestedCurrency },
    });
  }

  return this.mapToEntity(user);
}
```

**Step 2: Add endpoint to UsersController**

```typescript
// backend/src/users/users.controller.ts
@Patch('country')
@UseGuards(JwtAuthGuard)
async updateCountry(
  @Req() req: RequestWithUser,
  @Body('country') country: string,
) {
  const user = await this.usersService.updateCountry(req.user.userId, country);
  return {
    message: 'Country updated successfully',
    user,
    suggestedCurrency: this.currencyService.suggestCurrencyForUser(country),
  };
}
```

**Step 3: Update settings page with country selector**

```typescript
// frontend/app/settings/page.tsx
// Add country section similar to currency section

const [updateCountry, { isLoading: updatingCountry }] = useUpdateCountryMutation();

const handleCountryChange = async (newCountry: string) => {
  try {
    const result = await updateCountry(newCountry).unwrap();
    // Show success message with suggested currency
    if (result.suggestedCurrency.source === 'country') {
      showNotification(`Currency updated to ${result.suggestedCurrency.currency.toUpperCase()} based on your country`);
    }
  } catch (error) {
    showNotification('Failed to update country', 'error');
  }
};
```

**Step 4: Commit**

```bash
git add backend/src/users/users.service.ts backend/src/users/users.controller.ts frontend/app/settings/page.tsx
git commit -m "feat: add country setting with auto currency suggestion"
```

---

## Task 6: Add Background Job for Daily Rate Updates

**Files:**
- Create: `backend/src/currency/currency.processor.ts`
- Modify: `backend/src/currency/currency.module.ts`
- Modify: `backend/src/currency/exchange-rate.service.ts`

**Step 1: Install Bull dependencies**

```bash
cd backend && pnpm add @nestjs/bull bull
```

**Step 2: Create CurrencyProcessor**

```typescript
// backend/src/currency/currency.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ExchangeRateService } from './exchange-rate.service';

@Processor('currency')
export class CurrencyProcessor {
  private readonly logger = new Logger(CurrencyProcessor.name);

  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  @Process('refresh-rates')
  async handleRefreshRates(job: Job) {
    this.logger.log(`Processing job ${job.id}: refresh-rates`);
    
    const success = await this.exchangeRateService.refreshRates();
    
    if (success) {
      this.logger.log('Exchange rates refreshed successfully from Stripe');
    } else {
      this.logger.error('Failed to refresh exchange rates');
      throw new Error('Rate refresh failed');
    }
  }
}
```

**Step 3: Update ExchangeRateService to schedule daily updates**

```typescript
// backend/src/currency/exchange-rate.service.ts
// Add to imports
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

// Add to constructor
constructor(
  private readonly stripeService: StripeService,
  private readonly redisService: RedisService,
  @InjectQueue('currency') private readonly currencyQueue: Queue,
) {}

// Add method to schedule daily updates
async scheduleDailyRefresh(): Promise<void> {
  const job = await this.currencyQueue.add('refresh-rates', {}, {
    repeat: {
      cron: '0 0 * * *', // Daily at midnight UTC
    },
    jobId: 'daily-rate-refresh',
    removeOnComplete: 10,
    removeOnFail: 5,
  });
  
  this.logger.log(`Scheduled daily rate refresh from Stripe: ${job.id}`);
}
```

**Step 4: Update CurrencyModule with Bull**

```typescript
// backend/src/currency/currency.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { ExchangeRateService } from './exchange-rate.service';
import { CurrencyProcessor } from './currency.processor';
import { StripeModule } from '../stripe/stripe.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    StripeModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'currency',
      redis: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
  ],
  controllers: [CurrencyController],
  providers: [CurrencyService, ExchangeRateService, CurrencyProcessor],
  exports: [CurrencyService],
})
export class CurrencyModule {}
```

**Step 5: Commit**

```bash
git add backend/src/currency/currency.processor.ts backend/src/currency/exchange-rate.service.ts backend/src/currency/currency.module.ts backend/package.json
git commit -m "feat: add Bull queue for daily exchange rate updates from Stripe"
```

---

## Task 7: Add Health Check Endpoint

**Files:**
- Modify: `backend/src/currency/currency.controller.ts`

**Step 1: Add health check endpoint**

```typescript
@Get('health')
async getHealth() {
  const lastUpdate = this.currencyService.getLastRateUpdate();
  const cachedRates = await this.exchangeRateService.getCachedRates();
  
  const isStale = lastUpdate 
    ? Date.now() - lastUpdate.getTime() > 24 * 60 * 60 * 1000 // 24 hours
    : true;
  
  return {
    status: isStale ? 'stale' : 'healthy',
    lastUpdate: lastUpdate?.toISOString(),
    cachedCurrencies: cachedRates ? Object.keys(cachedRates).length : 0,
    source: 'Stripe Exchange Rates API',
  };
}
```

**Step 2: Commit**

```bash
git add backend/src/currency/currency.controller.ts
git commit -m "feat: add currency service health check endpoint"
```

---

## Task 8: Update Documentation

**Files:**
- Modify: `README.md`

**Step 1: Add production configuration section**

```markdown
## Production Configuration

### Exchange Rates
The system uses **Stripe's Exchange Rates API** for real-time rates:
- Rates are cached in Redis for 1 hour
- Daily background job refreshes rates at midnight UTC
- Fallback to static rates if API is unavailable
- No additional API key required (uses existing Stripe key)

### Currency Detection
Users select their **country** during registration or in settings:
- Country is stored in user profile (ISO 3166-1 alpha-2 code)
- System suggests currency based on country
- User can override the suggested currency
- No IP geolocation or third-party services required

Example country-to-currency mapping:
- US → USD
- DE → EUR
- GB → GBP
- JP → JPY
- AU → AUD
- CA → CAD

### Health Monitoring
```bash
GET /currency/health
```

Response:
```json
{
  "status": "healthy",
  "lastUpdate": "2025-03-12T00:00:00.000Z",
  "cachedCurrencies": 50,
  "source": "Stripe Exchange Rates API"
}
```
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add production configuration for multi-currency with Stripe"
```

---

## Task 9: Build and Verify

**Step 1: Build backend**

```bash
cd backend && pnpm build
```

**Step 2: Run typecheck on frontend**

```bash
cd frontend && npm run typecheck
```

**Step 3: Final commit**

```bash
git commit -m "chore: verify production build"
```

---

## Summary

This plan makes the multi-currency system production-ready using **only Stripe** (no third-party services):

1. **Stripe Exchange Rates API** - Real-time rates, no extra API key
2. **User-provided country** - Selected during registration/settings
3. **Country-to-currency mapping** - Comprehensive mapping for 50+ countries
4. **Auto-suggestion** - Currency suggested based on country
5. **Background jobs** - Daily rate updates via Bull queue
6. **Health checks** - For observability
7. **Comprehensive documentation**

**Estimated time:** 1.5-2 hours
**Dependencies:** Only Stripe (existing) + Redis (existing)

### Benefits
- ✅ **Zero third-party services** (besides Stripe)
- ✅ **Privacy-friendly** (no IP tracking)
- ✅ **User-controlled** (explicit country selection)
- ✅ **Accurate rates** (same as Stripe transactions)
- ✅ **Simple architecture** (no external APIs to manage)
