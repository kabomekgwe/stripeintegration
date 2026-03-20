import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from './utils';

// Simple component for testing
const TestComponent = () => (
  <div>
    <h1>Test Component</h1>
    <button>Click Me</button>
  </div>
);

describe('Test Infrastructure', () => {
  it('renders the test infrastructure correctly', () => {
    renderWithProviders(<TestComponent />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Component');
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('can use jest-dom matchers', () => {
    renderWithProviders(<TestComponent />);

    const heading = screen.getByRole('heading');
    expect(heading).toBeVisible();
    expect(heading).toHaveTextContent('Test Component');
  });
});