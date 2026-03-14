import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiClient } from './api-client';

export interface Session {
  user: {
    id: string;
    email: string;
    name?: string;
    role: string;
    preferredCurrency: string;
    country?: string;
  };
}

/**
 * Get session from cookies (Server Component only)
 */
export async function getSession(): Promise<Session | null> {
  try {
    const user = await apiClient<Session['user']>('auth/me');
    return { user };
  } catch {
    return null;
  }
}

/**
 * Require authentication (redirects to login if not authenticated)
 */
export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }
  
  return session;
}

/**
 * Require admin role (redirects if not admin)
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();
  
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }
  
  return session;
}

/**
 * Get auth token from cookies (for client-side usage)
 */
export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}
