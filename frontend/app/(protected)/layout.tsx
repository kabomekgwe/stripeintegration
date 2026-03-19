'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { useGetMeQuery } from '@/store/api';

import { clearCredentials } from '@/store/authSlice';
import { clearAllCache } from '@/store/persistenceMiddleware';
import { AppLayout } from '@/components/layout/sidebar';
import { Navbar } from '@/components/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { data: user, isLoading, isError, error } = useGetMeQuery();

  useEffect(() => {
    if (isError) {
      dispatch(clearCredentials());
      clearAllCache();
      router.push('/auth/login');
    }
  }, [isError, error, router, dispatch]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <Navbar />
      {children}
    </AppLayout>
  );
}
