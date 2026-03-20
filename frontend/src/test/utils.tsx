import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Create a mock store for tests
const createMockStore = () => {
  return configureStore({
    reducer: {
      // Add reducers here as needed
    },
  });
};

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  store?: ReturnType<typeof createMockStore>;
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { store = createMockStore(), ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    store,
  };
}

export * from '@testing-library/react';