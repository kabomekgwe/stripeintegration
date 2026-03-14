import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api';
import authReducer from './authSlice';
import { rtkQueryPersistenceMiddleware, clearExpiredCache } from './persistenceMiddleware';

// Clear expired cache on app startup
clearExpiredCache();

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(baseApi.middleware)
      .concat(rtkQueryPersistenceMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
