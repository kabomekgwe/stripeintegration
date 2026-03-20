import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/src/test/utils';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    const mockLogin = vi.fn();
    renderWithProviders(<LoginForm onSubmit={mockLogin} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn();
    renderWithProviders(<LoginForm onSubmit={mockLogin} />);

    const submitButton = screen.getByTestId('submit-button');
    await user.click(submitButton);

    expect(await screen.findByTestId('email-error')).toBeInTheDocument();
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByTestId('password-error')).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();

    // Should not call onSubmit when validation fails
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid email format', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn();
    renderWithProviders(<LoginForm onSubmit={mockLogin} />);

    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const submitButton = screen.getByTestId('submit-button');

    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(await screen.findByText(/please enter a valid email/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls onSubmit with credentials when form is valid', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<LoginForm onSubmit={mockLogin} />);

    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const submitButton = screen.getByTestId('submit-button');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('shows loading state when isLoading is true', () => {
    const mockLogin = vi.fn();
    renderWithProviders(<LoginForm onSubmit={mockLogin} isLoading={true} />);

    const submitButton = screen.getByTestId('submit-button');

    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent(/signing in/i);
  });

  it('disables inputs during loading', () => {
    const mockLogin = vi.fn();
    renderWithProviders(<LoginForm onSubmit={mockLogin} isLoading={true} />);

    expect(screen.getByTestId('email-input')).toBeDisabled();
    expect(screen.getByTestId('password-input')).toBeDisabled();
  });

  it('displays error message when error prop is provided', () => {
    const mockLogin = vi.fn();
    renderWithProviders(<LoginForm onSubmit={mockLogin} error="Invalid credentials" />);

    expect(screen.getByTestId('login-error')).toBeInTheDocument();
    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it('clears validation error when user starts typing', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn();
    renderWithProviders(<LoginForm onSubmit={mockLogin} />);

    const submitButton = screen.getByTestId('submit-button');
    await user.click(submitButton);

    // Validation errors appear
    expect(await screen.findByTestId('email-error')).toBeInTheDocument();

    // User starts typing email
    const emailInput = screen.getByTestId('email-input');
    await user.type(emailInput, 't');

    // Email error should clear
    expect(screen.queryByTestId('email-error')).not.toBeInTheDocument();
  });
});