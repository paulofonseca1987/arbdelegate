"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DelegateConfig {
  address: string;
  name?: string;
  startBlock: number;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function RootPage() {
  const [delegates, setDelegates] = useState<DelegateConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.delegates && data.delegates.length > 0) {
          setDelegates(data.delegates);
        } else {
          // Fallback to single delegate from legacy config
          setDelegates([{
            address: data.delegateAddress,
            startBlock: data.startBlock,
          }]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          Arbitrum Delegate Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-center">
          Select a delegate to view their voting power and activity
        </p>

        <div className="space-y-4">
          {delegates.map((delegate) => (
            <Link
              key={delegate.address}
              href={`/${delegate.address.toLowerCase()}`}
              className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {delegate.name || 'Delegate'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {truncateAddress(delegate.address)}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
