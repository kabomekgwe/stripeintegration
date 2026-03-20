import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/src/test/utils';
import userEvent from '@testing-library/user-event';
import { PaymentForm } from './PaymentForm';

// Mock Stripe hooks - must be before component import
vi.mock('@stripe/react-stripe-js', () => ({
  useStripe: () => ({
    confirmPayment: vi.fn().mockResolvedValue({ paymentIntent: { status: 'succeeded' } }),
  }),
  useElements: () => ({
    getElement: vi.fn(),
  }),
  PaymentElement: () => <div data-testid="payment-element">Payment Element</div>,
}));

// Mock RTK Query mutations
vi.mock('@/store/api', () => ({
  useConfirmPaymentMutation: () => [vi.fn().mockResolvedValue({})],
}));

describe('PaymentForm', () => {
  const defaultProps = {
    amount: 10.00,
    description: 'Test payment',
    paymentIntentId: 'pi_test123',
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
    idempotencyKey: 'test-key-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the payment form with amount and description', () => {
    renderWithProviders(<PaymentForm {...defaultProps} />);

    // Check amount field shows correct value
    expect(screen.getByText(/Amount/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('10.00')).toBeInTheDocument();

    // Check description field shows correct value
    expect(screen.getByDisplayValue('Test payment')).toBeInTheDocument();

    // Check PaymentElement is rendered
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
  });

  it('shows submit button', () => {
    renderWithProviders(<PaymentForm {...defaultProps} />);

    expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument();
  });

  it('shows cancel button', () => {
    renderWithProviders(<PaymentForm {...defaultProps} />);

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWithProviders(<PaymentForm {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows idempotency key', () => {
    renderWithProviders(<PaymentForm {...defaultProps} />);

    expect(screen.getByText(/test-key-123/i)).toBeInTheDocument();
  });

  it('displays converted amount when local currency differs from GBP', () => {
    renderWithProviders(
      <PaymentForm
        {...defaultProps}
        localCurrency="usd"
        convertedAmount={{ amount: 1300, currency: 'USD', formatted: '$13.00' }}
      />
    );

    expect(screen.getByTestId('converted-amount')).toBeInTheDocument();
    expect(screen.getByText(/\$13.00/)).toBeInTheDocument();
  });

  it('does not show converted amount when local currency is GBP', () => {
    renderWithProviders(
      <PaymentForm
        {...defaultProps}
        localCurrency="gbp"
        convertedAmount={{ amount: 1000, currency: 'GBP', formatted: '£10.00' }}
      />
    );

    expect(screen.queryByTestId('converted-amount')).not.toBeInTheDocument();
  });
});