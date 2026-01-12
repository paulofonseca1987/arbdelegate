"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import config from '../config.json';

export default function RootPage() {
  const router = useRouter();
  const delegateAddress = config.delegateAddress.toLowerCase();

  useEffect(() => {
    router.replace(`/${delegateAddress}`);
  }, [router, delegateAddress]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-pulse text-gray-500">Redirecting...</div>
    </div>
  );
}
