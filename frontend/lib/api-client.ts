import { cookies } from 'next/headers';

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const API_KEY = process.env.API_KEY;

interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Server-side API client for React Server Components
 * Automatically forwards cookies and adds API key
 */
export async function apiClient<T>(
  path: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  
  // Get cookies from the request
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  
  const url = `${API_BASE_URL}/${path}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY || '',
      ...(cookieHeader && { Cookie: cookieHeader }),
      ...headers,
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data as T;
}

/**
 * Get current user from server-side context
 */
export async function getCurrentUser() {
  try {
    const user = await apiClient<{
      id: string;
      email: string;
      name?: string;
      role: string;
      preferredCurrency: string;
      country?: string;
    }>('auth/me');
    return user;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated server-side
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}
