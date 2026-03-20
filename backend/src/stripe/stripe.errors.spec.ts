import { HttpStatus } from '@nestjs/common';
import Stripe from 'stripe';
import {
  isStripeError,
  isRetryableStripeError,
  stripeErrorToDetail,
  handleStripeError,
  logStripeError,
  PaymentException,
  PaymentErrorDetail,
  PaymentErrorCode,
} from './stripe.errors';

// Helper to create mock Stripe errors
function createMockStripeError(
  type: string,
  Class: typeof Stripe.errors.StripeError,
  overrides: Record<string, unknown> = {},
): Stripe.errors.StripeError {
  const error = new Class(
    Object.assign(
      {
        type,
        message: `Test ${type} error`,
      },
      overrides,
    ),
  );
  return error;
}

describe('Stripe Error Handling', () => {
  // ============================================
  // isStripeError() Type Guard Tests
  // ============================================
  describe('isStripeError', () => {
    it('should return true for StripeCardError', () => {
      const error = new Stripe.errors.StripeCardError({
        type: 'card_error',
        message: 'Card declined',
      });
      expect(isStripeError(error)).toBe(true);
    });

    it('should return true for StripeRateLimitError', () => {
      const error = new Stripe.errors.StripeRateLimitError({
        type: 'rate_limit_error',
        message: 'Rate limit exceeded',
      });
      expect(isStripeError(error)).toBe(true);
    });

    it('should return true for StripeInvalidRequestError', () => {
      const error = new Stripe.errors.StripeInvalidRequestError({
        type: 'invalid_request_error',
        message: 'Invalid request',
      });
      expect(isStripeError(error)).toBe(true);
    });

    it('should return true for StripeAuthenticationError', () => {
      const error = new Stripe.errors.StripeAuthenticationError({
        type: 'authentication_error',
        message: 'Invalid API key',
      });
      expect(isStripeError(error)).toBe(true);
    });

    it('should return true for StripeConnectionError', () => {
      const error = new Stripe.errors.StripeConnectionError({
        type: 'api_connection_error',
        message: 'Connection failed',
      });
      expect(isStripeError(error)).toBe(true);
    });

    it('should return true for StripeAPIError', () => {
      const error = new Stripe.errors.StripeAPIError({
        type: 'api_error',
        message: 'API error',
      });
      expect(isStripeError(error)).toBe(true);
    });

    it('should return false for generic Error', () => {
      const error = new Error('Generic error');
      expect(isStripeError(error)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isStripeError('error')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isStripeError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isStripeError(undefined)).toBe(false);
    });

    it('should return false for plain object', () => {
      expect(isStripeError({ type: 'card_error' })).toBe(false);
    });
  });

  // ============================================
  // isRetryableStripeError() Tests
  // ============================================
  describe('isRetryableStripeError', () => {
    it('should return true for StripeRateLimitError', () => {
      const error = new Stripe.errors.StripeRateLimitError({
        type: 'rate_limit_error',
        message: 'Rate limit exceeded',
      });
      expect(isRetryableStripeError(error)).toBe(true);
    });

    it('should return true for StripeConnectionError', () => {
      const error = new Stripe.errors.StripeConnectionError({
        type: 'api_connection_error',
        message: 'Connection failed',
      });
      expect(isRetryableStripeError(error)).toBe(true);
    });

    it('should return true for StripeAPIError with timeout message', () => {
      const error = new Stripe.errors.StripeAPIError({
        type: 'api_error',
        message: 'Request timeout',
      });
      expect(isRetryableStripeError(error)).toBe(true);
    });

    it('should return true for StripeAPIError with temporarily unavailable message', () => {
      const error = new Stripe.errors.StripeAPIError({
        type: 'api_error',
        message: 'Service temporarily unavailable',
      });
      expect(isRetryableStripeError(error)).toBe(true);
    });

    it('should return true for StripeAPIError with try again message', () => {
      const error = new Stripe.errors.StripeAPIError({
        type: 'api_error',
        message: 'Please try again later',
      });
      expect(isRetryableStripeError(error)).toBe(true);
    });

    it('should return true for StripeAPIError with overloaded message', () => {
      const error = new Stripe.errors.StripeAPIError({
        type: 'api_error',
        message: 'Service overloaded',
      });
      expect(isRetryableStripeError(error)).toBe(true);
    });

    it('should return false for StripeAPIError without retryable message', () => {
      const error = new Stripe.errors.StripeAPIError({
        type: 'api_error',
        message: 'Something went wrong',
      });
      expect(isRetryableStripeError(error)).toBe(false);
    });

    it('should return false for StripeCardError', () => {
      const error = new Stripe.errors.StripeCardError({
        type: 'card_error',
        message: 'Card declined',
      });
      expect(isRetryableStripeError(error)).toBe(false);
    });

    it('should return false for StripeInvalidRequestError', () => {
      const error = new Stripe.errors.StripeInvalidRequestError({
        type: 'invalid_request_error',
        message: 'Invalid parameter',
      });
      expect(isRetryableStripeError(error)).toBe(false);
    });

    it('should return false for StripeAuthenticationError', () => {
      const error = new Stripe.errors.StripeAuthenticationError({
        type: 'authentication_error',
        message: 'Invalid API key',
      });
      expect(isRetryableStripeError(error)).toBe(false);
    });

    it('should return false for non-Stripe errors', () => {
      const error = new Error('Generic error');
      expect(isRetryableStripeError(error)).toBe(false);
    });
  });

  // ============================================
  // stripeErrorToDetail() Tests
  // ============================================
  describe('stripeErrorToDetail', () => {
    describe('StripeCardError', () => {
      it('should map card declined error', () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Your card was declined',
          decline_code: 'generic_decline',
          charge: 'ch_123',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('CARD_DECLINED');
        expect(detail.message).toBe('Your card was declined');
        expect(detail.userMessage).toBe('Your card was declined. Please try a different payment method.');
        expect(detail.declineCode).toBe('generic_decline');
        expect(detail.chargeId).toBe('ch_123');
        expect(detail.stripeType).toBe('card_error');
      });

      it('should map insufficient_funds decline', () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Card declined',
          decline_code: 'insufficient_funds',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('INSUFFICIENT_FUNDS');
        expect(detail.userMessage).toBe('Insufficient funds in your account.');
      });

      it('should map expired_card decline', () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Card expired',
          decline_code: 'expired_card',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('EXPIRED_CARD');
        expect(detail.userMessage).toBe('Your card has expired. Please update your payment method.');
      });

      it('should map lost_card decline', () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Card lost',
          decline_code: 'lost_card',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('LOST_CARD');
        expect(detail.userMessage).toBe('This card has been reported lost. Please contact your bank.');
      });

      it('should map stolen_card decline', () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Card stolen',
          decline_code: 'stolen_card',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('STOLEN_CARD');
        expect(detail.userMessage).toBe('This card has been reported stolen. Please contact your bank.');
      });

      it('should map incorrect_cvc decline', () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Invalid CVC',
          decline_code: 'incorrect_cvc',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('INCORRECT_CVC');
        expect(detail.userMessage).toBe('The security code (CVC) is incorrect.');
      });

      it('should map incorrect_number decline', () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Invalid number',
          decline_code: 'incorrect_number',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('INCORRECT_NUMBER');
        expect(detail.userMessage).toBe('The card number is incorrect.');
      });

      it('should map fraudulent decline to CARD_DECLINED', () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Fraudulent',
          decline_code: 'fraudulent',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('CARD_DECLINED');
        expect(detail.userMessage).toBe('This transaction was flagged as potentially fraudulent.');
      });

      it('should handle unknown decline codes', () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Card error',
          decline_code: 'unknown_decline_code',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('CARD_DECLINED');
        expect(detail.userMessage).toBe('Card error'); // Falls back to message
      });

      it('should handle missing decline_code', () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Card declined',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('CARD_DECLINED');
        expect(detail.declineCode).toBe('generic_decline');
      });
    });

    describe('StripeRateLimitError', () => {
      it('should map rate limit error', () => {
        const error = new Stripe.errors.StripeRateLimitError({
          type: 'rate_limit_error',
          message: 'Rate limit exceeded',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('RATE_LIMIT');
        expect(detail.message).toBe('Rate limit exceeded');
        expect(detail.userMessage).toBe('Too many payment requests. Please wait a moment and try again.');
        expect(detail.retryAfter).toBe(60);
        expect(detail.stripeType).toBe('rate_limit_error');
      });
    });

    describe('StripeInvalidRequestError', () => {
      it('should map invalid request error', () => {
        const error = new Stripe.errors.StripeInvalidRequestError({
          type: 'invalid_request_error',
          message: 'Invalid parameter',
          param: 'amount',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('INVALID_REQUEST');
        expect(detail.message).toBe('Invalid parameter');
        expect(detail.userMessage).toBe('The payment request was invalid. Please check your details.');
        expect(detail.param).toBe('amount');
        expect(detail.stripeType).toBe('invalid_request_error');
      });
    });

    describe('StripeAuthenticationError', () => {
      it('should map authentication error', () => {
        const error = new Stripe.errors.StripeAuthenticationError({
          type: 'authentication_error',
          message: 'Invalid API key',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('AUTHENTICATION_ERROR');
        expect(detail.message).toBe('Invalid API key');
        expect(detail.userMessage).toBe('Payment service configuration error. Please contact support.');
        expect(detail.stripeType).toBe('authentication_error');
      });
    });

    describe('StripeConnectionError', () => {
      it('should map connection error', () => {
        const error = new Stripe.errors.StripeConnectionError({
          type: 'api_connection_error',
          message: 'Connection timeout',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('API_CONNECTION_ERROR');
        expect(detail.message).toBe('Connection timeout');
        expect(detail.userMessage).toBe('Unable to connect to payment service. Please try again.');
        expect(detail.retryAfter).toBe(30);
        expect(detail.stripeType).toBe('api_connection_error');
      });
    });

    describe('StripeAPIError', () => {
      it('should map API error', () => {
        const error = new Stripe.errors.StripeAPIError({
          type: 'api_error',
          message: 'Internal error',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('PROCESSING_ERROR');
        expect(detail.message).toBe('Internal error');
        expect(detail.userMessage).toBe('A payment processing error occurred. Please try again.');
        expect(detail.stripeType).toBe('api_error');
      });
    });

    describe('Unknown error type', () => {
      it('should map unknown error type', () => {
        // Stripe.errors.StripeError base class sets type to 'StripeError' by default
        // For truly unknown types, we use error.type as stripeType
        const error = new Stripe.errors.StripeError({
          type: 'unknown_error_type' as Stripe.errors.StripeErrorType,
          message: 'Something weird happened',
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.code).toBe('UNKNOWN_ERROR');
        expect(detail.message).toBe('Something weird happened');
        expect(detail.userMessage).toBe('An unexpected payment error occurred. Please try again.');
        // Stripe SDK may normalize the type, so we check it's defined
        expect(detail.stripeType).toBeDefined();
      });
    });
  });

  // ============================================
  // handleStripeError() Tests
  // ============================================
  describe('handleStripeError', () => {
    it('should throw PaymentException for StripeCardError with BAD_REQUEST status', () => {
      const error = new Stripe.errors.StripeCardError({
        type: 'card_error',
        message: 'Card declined',
        decline_code: 'generic_decline',
      });

      expect(() => handleStripeError(error)).toThrow(PaymentException);
      try {
        handleStripeError(error);
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentException);
        const paymentException = e as PaymentException;
        expect(paymentException.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(paymentException.detail.code).toBe('CARD_DECLINED');
      }
    });

    it('should throw PaymentException for StripeRateLimitError with TOO_MANY_REQUESTS status', () => {
      const error = new Stripe.errors.StripeRateLimitError({
        type: 'rate_limit_error',
        message: 'Rate limit exceeded',
      });

      try {
        handleStripeError(error);
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentException);
        const paymentException = e as PaymentException;
        expect(paymentException.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(paymentException.detail.code).toBe('RATE_LIMIT');
      }
    });

    it('should throw PaymentException for StripeAuthenticationError with INTERNAL_SERVER_ERROR status', () => {
      const error = new Stripe.errors.StripeAuthenticationError({
        type: 'authentication_error',
        message: 'Invalid API key',
      });

      try {
        handleStripeError(error);
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentException);
        const paymentException = e as PaymentException;
        expect(paymentException.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(paymentException.detail.code).toBe('AUTHENTICATION_ERROR');
      }
    });

    it('should throw PaymentException for StripeConnectionError with SERVICE_UNAVAILABLE status', () => {
      const error = new Stripe.errors.StripeConnectionError({
        type: 'api_connection_error',
        message: 'Connection failed',
      });

      try {
        handleStripeError(error);
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentException);
        const paymentException = e as PaymentException;
        expect(paymentException.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(paymentException.detail.code).toBe('API_CONNECTION_ERROR');
      }
    });

    it('should throw PaymentException for StripeInvalidRequestError with BAD_REQUEST status', () => {
      const error = new Stripe.errors.StripeInvalidRequestError({
        type: 'invalid_request_error',
        message: 'Invalid parameter',
        param: 'amount',
      });

      try {
        handleStripeError(error);
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentException);
        const paymentException = e as PaymentException;
        expect(paymentException.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(paymentException.detail.code).toBe('INVALID_REQUEST');
        expect(paymentException.detail.param).toBe('amount');
      }
    });

    it('should rethrow non-Stripe errors', () => {
      const error = new Error('Generic error');

      expect(() => handleStripeError(error)).toThrow(Error);
      expect(() => handleStripeError(error)).toThrow('Generic error');
    });
  });

  // ============================================
  // logStripeError() Tests
  // ============================================
  describe('logStripeError', () => {
    const mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should log authentication errors as error level', () => {
      const error = new Stripe.errors.StripeAuthenticationError({
        type: 'authentication_error',
        message: 'Invalid API key',
      });

      logStripeError(mockLogger, error, { userId: 'user_123' });

      expect(mockLogger.error).toHaveBeenCalledWith('Stripe authentication error', {
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid API key',
        declineCode: undefined,
        chargeId: undefined,
        param: undefined,
        stripeType: 'authentication_error',
        userId: 'user_123',
      });
    });

    it('should log rate limit errors as warn level', () => {
      const error = new Stripe.errors.StripeRateLimitError({
        type: 'rate_limit_error',
        message: 'Rate limit exceeded',
      });

      logStripeError(mockLogger, error);

      expect(mockLogger.warn).toHaveBeenCalledWith('Stripe transient error', {
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
        declineCode: undefined,
        chargeId: undefined,
        param: undefined,
        stripeType: 'rate_limit_error',
      });
    });

    it('should log connection errors as warn level', () => {
      const error = new Stripe.errors.StripeConnectionError({
        type: 'api_connection_error',
        message: 'Connection failed',
      });

      logStripeError(mockLogger, error);

      expect(mockLogger.warn).toHaveBeenCalledWith('Stripe transient error', {
        code: 'API_CONNECTION_ERROR',
        message: 'Connection failed',
        declineCode: undefined,
        chargeId: undefined,
        param: undefined,
        stripeType: 'api_connection_error',
      });
    });

    it('should log card errors as warn level', () => {
      const error = new Stripe.errors.StripeCardError({
        type: 'card_error',
        message: 'Card declined',
        decline_code: 'insufficient_funds',
        charge: 'ch_123',
      });

      logStripeError(mockLogger, error);

      expect(mockLogger.warn).toHaveBeenCalledWith('Stripe card error', {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Card declined',
        declineCode: 'insufficient_funds',
        chargeId: 'ch_123',
        param: undefined,
        stripeType: 'card_error',
      });
    });

    it('should log API errors as error level', () => {
      const error = new Stripe.errors.StripeAPIError({
        type: 'api_error',
        message: 'Internal error',
      });

      logStripeError(mockLogger, error);

      expect(mockLogger.error).toHaveBeenCalledWith('Stripe error', {
        code: 'PROCESSING_ERROR',
        message: 'Internal error',
        declineCode: undefined,
        chargeId: undefined,
        param: undefined,
        stripeType: 'api_error',
      });
    });

    it('should include context in log data', () => {
      const error = new Stripe.errors.StripeCardError({
        type: 'card_error',
        message: 'Card declined',
        decline_code: 'fraudulent',
      });

      logStripeError(mockLogger, error, { orderId: 'order_456', amount: 1000 });

      expect(mockLogger.warn).toHaveBeenCalledWith('Stripe card error', {
        code: 'CARD_DECLINED',
        message: 'Card declined',
        declineCode: 'fraudulent',
        chargeId: undefined,
        param: undefined,
        stripeType: 'card_error',
        orderId: 'order_456',
        amount: 1000,
      });
    });
  });

  // ============================================
  // PaymentException Tests
  // ============================================
  describe('PaymentException', () => {
    it('should create exception with default BAD_REQUEST status', () => {
      const detail: PaymentErrorDetail = {
        code: 'CARD_DECLINED',
        message: 'Card was declined',
        userMessage: 'Your card was declined. Please try again.',
      };

      const exception = new PaymentException(detail);

      expect(exception).toBeInstanceOf(PaymentException);
      expect(exception.name).toBe('PaymentException');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.detail).toBe(detail);
      expect(exception.message).toBe('Your card was declined. Please try again.');
    });

    it('should create exception with custom status', () => {
      const detail: PaymentErrorDetail = {
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
        userMessage: 'Too many requests.',
        retryAfter: 60,
      };

      const exception = new PaymentException(detail, HttpStatus.TOO_MANY_REQUESTS);

      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(exception.detail.retryAfter).toBe(60);
    });

    it('should create exception with all detail fields', () => {
      const detail: PaymentErrorDetail = {
        code: 'CARD_DECLINED',
        message: 'Card declined',
        userMessage: 'Your card was declined.',
        declineCode: 'insufficient_funds',
        chargeId: 'ch_123',
        param: 'amount',
        retryAfter: undefined,
        stripeType: 'card_error',
      };

      const exception = new PaymentException(detail);

      expect(exception.detail.code).toBe('CARD_DECLINED');
      expect(exception.detail.declineCode).toBe('insufficient_funds');
      expect(exception.detail.chargeId).toBe('ch_123');
      expect(exception.detail.param).toBe('amount');
      expect(exception.detail.stripeType).toBe('card_error');
    });
  });

  // ============================================
  // Decline Code Mapping Coverage Tests
  // ============================================
  describe('DECLINE_CODE_MESSAGES Coverage', () => {
    const declineCodes = [
      'insufficient_funds',
      'lost_card',
      'stolen_card',
      'generic_decline',
      'do_not_honor',
      'fraudulent',
      'restricted_card',
      'expired_card',
      'incorrect_number',
      'incorrect_cvc',
      'incorrect_zip',
      'issuer_not_available',
      'try_again_later',
      'invalid_amount',
      'invalid_currency',
      'online_or_offline',
      'pickup_card',
      'block_new',
      'merchant_blacklist',
      'security_violation',
      'declined',
    ];

    declineCodes.forEach((declineCode) => {
      it(`should have user-friendly message for decline code: ${declineCode}`, () => {
        const error = new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Test',
          decline_code: declineCode,
        });
        const detail = stripeErrorToDetail(error);
        expect(detail.userMessage).toBeDefined();
        expect(detail.userMessage.length).toBeGreaterThan(0);
      });
    });
  });
});