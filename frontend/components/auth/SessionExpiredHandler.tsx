'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

export function SessionExpiredHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasShownToast, setHasShownToast] = useState(false);

  useEffect(() => {
    const reason = searchParams.get('reason');

    if (reason === 'session_expired' && !hasShownToast) {
      setHasShownToast(true);

      toast.warning('Session Expired', {
        description: 'Your session has expired. Please sign in again to continue.',
        action: {
          label: 'Sign In',
          onClick: () => router.push('/auth/login'),
        },
      });

      router.replace('/auth/login');
    }
  }, [searchParams, router, hasShownToast]);

  return null;
}
