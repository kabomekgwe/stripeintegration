/**
 * Stripe Error Handling - 2026 Best Practices
 *
 * Provides typed error discrimination for all Stripe error types,
 * enabling proper HTTP status mapping and user-friendly messages.
 */

import {
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import Stripe from 'stripe';

/**
 * Error codes for Stripe-related payment errors
 */
export type PaymentErrorCode =
  | 'CARD_DECLINED'
  | 'EXPIRED_CARD'
  | 'INCORRECT_CVC'
  | 'PROCESSING_ERROR'
  | 'INCORRECT_NUMBER'
  | 'INVALID_EXPIRY_MONTH'
  | 'INVALID_EXPIRY_YEAR'
  | 'INVALID_NUMBER'
  | 'INVALID_CVC'
  | 'RATE_LIMIT'
  | 'INSUFFICIENT_FUNDS'
  | 'LOST_CARD'
  | 'STOLEN_CARD'
  | 'INVALID_REQUEST'
  | 'AUTHENTICATION_ERROR'
  | 'API_CONNECTION_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Structured payment error with all context needed for proper response
 */
export interface PaymentErrorDetail {
  code: PaymentErrorCode;
  message: string;
  userMessage: string;
  declineCode?: string;
  chargeId?: string;
  param?: string;
  retryAfter?: number;
  stripeType?: string;
}

/**
 * Custom exception for payment-related errors
 */
export class PaymentException extends HttpException {
  public readonly detail: PaymentErrorDetail;

  constructor(detail: PaymentErrorDetail, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(detail.userMessage, status);
    this.detail = detail;
    this.name = 'PaymentException';
  }
}

/**
 * Map Stripe decline codes to user-friendly messages
 */
const DECLINE_CODE_MESSAGES: Record<string, string> = {
  insufficient_funds: 'Insufficient funds in your account.',
  lost_card: 'This card has been reported lost. Please contact your bank.',
  stolen_card: 'This card has been reported stolen. Please contact your bank.',
  generic_decline: 'Your card was declined. Please try a different payment method.',
  do_not_honor: 'Your card was declined. Please contact your bank.',
  fraudulent: 'This transaction was flagged as potentially fraudulent.',
  restricted_card: 'This card has restrictions on it. Please contact your bank.',
  expired_card: 'Your card has expired. Please update your payment method.',
  incorrect_number: 'The card number is incorrect.',
  incorrect_cvc: 'The security code (CVC) is incorrect.',
  incorrect_zip: 'The billing ZIP/postal code is incorrect.',
  issuer_not_available: 'Your bank could not be reached. Please try again.',
  try_again_later: 'Please try again later.',
  invalid_amount: 'The transaction amount is invalid.',
  invalid_currency: 'This currency is not supported for this card.',
  online_or_offline: 'This card only allows in-person transactions.',
  pickup_card: 'Please pick up your card from the bank.',
  block_new: 'This card cannot be used for new transactions.',
  merchant_blacklist: 'This merchant is not authorized to process this card.',
  security_violation: 'A security violation was detected.',
  declined: 'Your card was declined.',
};

/**
 * Map Stripe error types to HTTP status codes
 */
const STRIPE_ERROR_TO_HTTP_STATUS: Record<string, HttpStatus> = {
  card_error: HttpStatus.BAD_REQUEST,
  rate_limit_error: HttpStatus.TOO_MANY_REQUESTS,
  invalid_request_error: HttpStatus.BAD_REQUEST,
  authentication_error: HttpStatus.INTERNAL_SERVER_ERROR,
  api_connection_error: HttpStatus.SERVICE_UNAVAILABLE,
  api_error: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * Determine if an error is a Stripe error
 */
export function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

/**
 * Determine if an error is retryable (should return 500 to trigger Stripe retry)
 */
export function isRetryableStripeError(error: unknown): boolean {
  if (!isStripeError(error)) return false;

  // Rate limit and connection errors are retryable
  if (error instanceof Stripe.errors.StripeRateLimitError) return true;
  if (error instanceof Stripe.errors.StripeAPIConnectionError) return true;

  // Some API errors are retryable (temporary issues)
  if (error instanceof Stripe.errors.StripeAPIError) {
    // Check for specific retryable codes
    const retryableMessages = [
      'timeout',
      'temporarily unavailable',
      'try again',
      'overloaded',
    ];
    const message = error.message.toLowerCase();
    return retryableMessages.some((m) => message.includes(m));
  }

  return false;
}

/**
 * Convert Stripe error to structured PaymentErrorDetail
 */
export function stripeErrorToDetail(error: Stripe.errors.StripeError): PaymentErrorDetail {
  // Card errors - customer-facing issues
  if (error instanceof Stripe.errors.StripeCardError) {
    const declineCode = (error as Stripe.errors.StripeCardError).decline_code || 'generic_decline';
    const baseMessage = DECLINE_CODE_MESSAGES[declineCode] || error.message;

    return {
      code: mapCardDeclineToCode(declineCode),
      message: error.message,
      userMessage: baseMessage,
      declineCode,
      chargeId: error.charge,
      stripeType: 'card_error',
    };
  }

  // Rate limit errors
  if (error instanceof Stripe.errors.StripeRateLimitError) {
    return {
      code: 'RATE_LIMIT',
      message: error.message,
      userMessage: 'Too many payment requests. Please wait a moment and try again.',
      retryAfter: 60,
      stripeType: 'rate_limit_error',
    };
  }

  // Invalid request errors
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    return {
      code: 'INVALID_REQUEST',
      message: error.message,
      userMessage: 'The payment request was invalid. Please check your details.',
      param: error.param,
      stripeType: 'invalid_request_error',
    };
  }

  // Authentication errors (API key issues)
  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    return {
      code: 'AUTHENTICATION_ERROR',
      message: error.message,
      userMessage: 'Payment service configuration error. Please contact support.',
      stripeType: 'authentication_error',
    };
  }

  // API connection errors
  if (error instanceof Stripe.errors.StripeAPIConnectionError) {
    return {
      code: 'API_CONNECTION_ERROR',
      message: error.message,
      userMessage: 'Unable to connect to payment service. Please try again.',
      retryAfter: 30,
      stripeType: 'api_connection_error',
    };
  }

  // Generic API errors
  if (error instanceof Stripe.errors.StripeAPIError) {
    return {
      code: 'PROCESSING_ERROR',
      message: error.message,
      userMessage: 'A payment processing error occurred. Please try again.',
      stripeType: 'api_error',
    };
  }

  // Unknown error type
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'Unknown Stripe error',
    userMessage: 'An unexpected payment error occurred. Please try again.',
    stripeType: error.type,
  };
}

/**
 * Map Stripe decline codes to our error codes
 */
function mapCardDeclineToCode(declineCode: string): PaymentErrorCode {
  const mapping: Record<string, PaymentErrorCode> = {
    insufficient_funds: 'INSUFFICIENT_FUNDS',
    expired_card: 'EXPIRED_CARD',
    lost_card: 'LOST_CARD',
    stolen_card: 'STOLEN_CARD',
    incorrect_cvc: 'INCORRECT_CVC',
    incorrect_number: 'INCORRECT_NUMBER',
    fraudulent: 'CARD_DECLINED',
    generic_decline: 'CARD_DECLINED',
    do_not_honor: 'CARD_DECLINED',
    restricted_card: 'CARD_DECLINED',
    security_violation: 'CARD_DECLINED',
    declined: 'CARD_DECLINED',
  };

  return mapping[declineCode] || 'CARD_DECLINED';
}

/**
 * Handle Stripe error by converting to PaymentException
 * Use this at service layer boundaries
 */
export function handleStripeError(error: unknown): never {
  if (!isStripeError(error)) {
    // Not a Stripe error, rethrow
    throw error;
  }

  const detail = stripeErrorToDetail(error);
  const status = STRIPE_ERROR_TO_HTTP_STATUS[error.type] || HttpStatus.INTERNAL_SERVER_ERROR;

  throw new PaymentException(detail, status);
}

/**
 * Log Stripe error with appropriate level
 */
export function logStripeError(
  logger: { error: (msg: string, data?: unknown) => void; warn: (msg: string, data?: unknown) => void },
  error: Stripe.errors.StripeError,
  context?: Record<string, unknown>,
): void {
  const detail = stripeErrorToDetail(error);

  const logData = {
    code: detail.code,
    message: detail.message,
    declineCode: detail.declineCode,
    chargeId: detail.chargeId,
    param: detail.param,
    stripeType: detail.stripeType,
    ...context,
  };

  // Authentication errors should be logged as errors (configuration issue)
  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    logger.error('Stripe authentication error', logData);
    return;
  }

  // Rate limits and connection issues are warnings (transient)
  if (
    error instanceof Stripe.errors.StripeRateLimitError ||
    error instanceof Stripe.errors.StripeAPIConnectionError
  ) {
    logger.warn('Stripe transient error', logData);
    return;
  }

  // Card errors are typically user issues, log as warning
  if (error instanceof Stripe.errors.StripeCardError) {
    logger.warn('Stripe card error', logData);
    return;
  }

  // Other errors
  logger.error('Stripe error', logData);
}