import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import Stripe from 'stripe';

@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  async createPortalSession(
    userId: string,
    stripeCustomerId: string,
  ): Promise<Stripe.BillingPortal.Session> {
    if (!stripeCustomerId) {
      throw new NotFoundException('No Stripe customer found for user');
    }

    const returnUrl = this.configService.get<string>('PORTAL_RETURN_URL') || 
      'http://localhost:3000/dashboard';

    // Get or create portal configuration
    const configuration = await this.getOrCreateConfiguration();

    const session = await this.stripeService.getStripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
      configuration: configuration.id,
    });

    this.logger.log(`Created portal session for user ${userId}`);
    return session;
  }

  async getOrCreateConfiguration(): Promise<Stripe.BillingPortal.Configuration> {
    const stripe = this.stripeService.getStripe();
    
    // Try to find existing configuration
    const configurations = await stripe.billingPortal.configurations.list({
      limit: 1,
    });

    if (configurations.data.length > 0) {
      return configurations.data[0];
    }

    // Create new configuration
    const configuration = await stripe.billingPortal.configurations.create({
      features: {
        payment_method_update: {
          enabled: true,
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity', 'promotion_code'],
          proration_behavior: 'create_prorations',
          products: [],
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
          },
        },
        invoice_history: {
          enabled: true,
        },
      },
      business_profile: {
        headline: 'Manage your subscription',
        privacy_policy_url: this.configService.get<string>('PRIVACY_POLICY_URL') || 
          'http://localhost:3000/privacy',
        terms_of_service_url: this.configService.get<string>('TERMS_URL') || 
          'http://localhost:3000/terms',
      },
    });

    this.logger.log(`Created portal configuration: ${configuration.id}`);
    return configuration;
  }
}
