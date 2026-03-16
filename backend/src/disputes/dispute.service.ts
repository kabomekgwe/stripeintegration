import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { MailService } from '../mail/mail.service';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { DisputeEvidence } from './dto/dispute-evidence.dto';

export type { DisputeEvidence };

@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly mailService: MailService,
  ) {}

  async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    this.logger.warn(`Dispute created: ${dispute.id} for charge ${dispute.charge}`);

    // Find the payment in our database
    const payment = await this.prisma.paymentRecord.findFirst({
      where: { stripePaymentIntentId: dispute.payment_intent as string },
      include: { user: true },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for dispute ${dispute.id}`);
      return;
    }

    // Store dispute in database
    await this.prisma.dispute.create({
      data: {
        stripeDisputeId: dispute.id,
        paymentId: payment.id,
        userId: payment.userId,
        amount: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
        evidenceDueBy: dispute.evidence_details?.due_by 
          ? new Date(dispute.evidence_details.due_by * 1000)
          : null,
        isChargeRefundable: dispute.is_charge_refundable,
      },
    });

    // Send notification email
    await this.mailService.sendDisputeNotification(payment.userId, {
      disputeId: dispute.id,
      amount: (dispute.amount / 100).toFixed(2),
      currency: dispute.currency.toUpperCase(),
      reason: dispute.reason,
      evidenceDueDate: dispute.evidence_details?.due_by 
        ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString()
        : 'N/A',
    });

    this.logger.log(`Dispute ${dispute.id} recorded and notification sent`);
  }

  async handleDisputeUpdated(dispute: Stripe.Dispute): Promise<void> {
    this.logger.log(`Dispute updated: ${dispute.id} - Status: ${dispute.status}`);

    const existingDispute = await this.prisma.dispute.findUnique({
      where: { stripeDisputeId: dispute.id },
      include: { user: true, payment: true },
    });

    if (!existingDispute) {
      this.logger.warn(`Dispute ${dispute.id} not found in database`);
      return;
    }

    // Update status
    await this.prisma.dispute.update({
      where: { stripeDisputeId: dispute.id },
      data: {
        status: dispute.status,
        statusTransitions: {
          push: {
            status: dispute.status,
            timestamp: new Date(),
          },
        },
      },
    });

    // Handle closed status
    if (dispute.status === 'won') {
      this.logger.log(`Dispute ${dispute.id} won`);
      await this.mailService.sendDisputeWonNotification(existingDispute.userId, {
        disputeId: dispute.id,
        amount: (dispute.amount / 100).toFixed(2),
        currency: dispute.currency.toUpperCase(),
      });
    } else if (dispute.status === 'lost') {
      this.logger.log(`Dispute ${dispute.id} lost`);
      await this.mailService.sendDisputeLostNotification(existingDispute.userId, {
        disputeId: dispute.id,
        amount: (dispute.amount / 100).toFixed(2),
        currency: dispute.currency.toUpperCase(),
      });
    }
  }

  async submitEvidence(
    disputeId: string,
    evidence: DisputeEvidence,
  ): Promise<void> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    if (dispute.status !== 'needs_response') {
      throw new Error('Cannot submit evidence for this dispute status');
    }

    // Submit evidence to Stripe
    const stripeEvidence: Stripe.DisputeUpdateParams.Evidence = {};
    if (evidence.productDescription) stripeEvidence.product_description = evidence.productDescription;
    if (evidence.customerCommunication) stripeEvidence.customer_communication = evidence.customerCommunication;
    if (evidence.refundPolicy) stripeEvidence.refund_policy = evidence.refundPolicy;
    // Note: terms_of_service is not a valid Stripe dispute evidence field
    // If provided, include it in uncategorized_text or handle appropriately
    if (evidence.termsOfService) {
      const existingText = evidence.uncategorizedText || '';
      stripeEvidence.uncategorized_text = existingText
        ? `${existingText}\n\nTerms of Service:\n${evidence.termsOfService}`
        : `Terms of Service:\n${evidence.termsOfService}`;
    }
    if (evidence.shippingDocumentation) stripeEvidence.shipping_documentation = evidence.shippingDocumentation;
    if (evidence.serviceDocumentation) stripeEvidence.service_documentation = evidence.serviceDocumentation;
    if (evidence.uncategorizedText && !evidence.termsOfService) stripeEvidence.uncategorized_text = evidence.uncategorizedText;
    if (evidence.receipt) stripeEvidence.receipt = evidence.receipt;

    await this.stripeService.getStripe().disputes.update(
      dispute.stripeDisputeId,
      { evidence: stripeEvidence },
    );

    // Update database
    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        evidenceSubmitted: true,
        evidenceSubmittedAt: new Date(),
        evidence: evidence as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Evidence submitted for dispute ${disputeId}`);
  }

  async closeDispute(disputeId: string, outcome: 'won' | 'lost'): Promise<void> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Note: In production, Stripe handles the actual closing
    // This is for manual updates if needed
    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: outcome,
        statusTransitions: {
          push: {
            status: outcome,
            timestamp: new Date(),
          },
        },
      },
    });

    this.logger.log(`Dispute ${disputeId} manually closed as ${outcome}`);
  }

  async getDisputes(params: {
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ disputes: Prisma.DisputeGetPayload<{
    include: {
      user: { select: { email: true; name: true } };
      payment: { select: { amount: true; currency: true; createdAt: true } };
    };
  }>[]; total: number }> {
    const { userId, status, limit = 50, offset = 0 } = params;

    const where: Prisma.DisputeWhereInput = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: {
          user: { select: { email: true, name: true } },
          payment: { select: { amount: true, currency: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { disputes, total };
  }

  async getDispute(id: string): Promise<Prisma.DisputeGetPayload<{
    include: {
      user: { select: { email: true; name: true } };
      payment: true;
    };
  }> & { stripeData?: Stripe.Dispute }> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, name: true } },
        payment: true,
      },
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Get latest from Stripe
    try {
      const stripeDispute = await this.stripeService.getStripe().disputes.retrieve(
        dispute.stripeDisputeId,
      );

      return {
        ...dispute,
        stripeData: stripeDispute,
      };
    } catch (error) {
      return dispute;
    }
  }

  async getDisputeStats(): Promise<{
    total: number;
    needsResponse: number;
    won: number;
    lost: number;
    totalAmount: number;
    byReason: Record<string, number>;
  }> {
    const [
      total,
      needsResponse,
      won,
      lost,
      byReason,
    ] = await Promise.all([
      this.prisma.dispute.count(),
      this.prisma.dispute.count({ where: { status: 'needs_response' } }),
      this.prisma.dispute.count({ where: { status: 'won' } }),
      this.prisma.dispute.count({ where: { status: 'lost' } }),
      this.prisma.dispute.groupBy({
        by: ['reason'],
        _count: { reason: true },
      }),
    ]);

    const totalAmount = await this.prisma.dispute.aggregate({
      _sum: { amount: true },
    });

    const byReasonMap: Record<string, number> = {};
    byReason.forEach((item) => {
      byReasonMap[item.reason] = item._count.reason;
    });

    return {
      total,
      needsResponse,
      won,
      lost,
      totalAmount: totalAmount._sum.amount || 0,
      byReason: byReasonMap,
    };
  }
}
