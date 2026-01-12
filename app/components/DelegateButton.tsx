'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { parseAbi, formatUnits } from 'viem';
import { arbitrum } from 'wagmi/chains';

// ERC20Votes ABI - only the functions we need
const erc20VotesAbi = parseAbi([
  'function delegate(address delegatee) external',
  'function delegates(address account) view returns (address)',
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)',
]);

interface DelegateButtonProps {
  delegateAddress: string;
  tokenAddress: string;
}

export default function DelegateButton({ delegateAddress, tokenAddress }: DelegateButtonProps) {
  const { address, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain } = useSwitchChain();
  const [delegationStatus, setDelegationStatus] = useState<'idle' | 'delegating' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if user is on the correct chain (Arbitrum)
  const isOnArbitrum = chainId === arbitrum.id;

  // Check current delegate
  const { data: currentDelegate, refetch: refetchDelegate } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20VotesAbi,
    functionName: 'delegates',
    args: address ? [address] : undefined,
    chainId: arbitrum.id,
    query: {
      enabled: !!address,
    },
  });

  // Check token balance
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20VotesAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrum.id,
    query: {
      enabled: !!address,
    },
  });

  // Write contract hook
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Check if already delegating to target
  const isAlreadyDelegated = currentDelegate?.toLowerCase() === delegateAddress.toLowerCase();

  // Update status based on transaction state
  useEffect(() => {
    if (isPending || isConfirming) {
      setDelegationStatus('delegating');
    } else if (isConfirmed) {
      setDelegationStatus('success');
      refetchDelegate();
      // Reset after 5 seconds
      setTimeout(() => setDelegationStatus('idle'), 5000);
    } else if (writeError) {
      setDelegationStatus('error');
      setErrorMessage(writeError.message.includes('User rejected')
        ? 'Transaction rejected by user'
        : 'Delegation failed. Please try again.');
      // Reset after 5 seconds
      setTimeout(() => {
        setDelegationStatus('idle');
        setErrorMessage(null);
      }, 5000);
    }
  }, [isPending, isConfirming, isConfirmed, writeError, refetchDelegate]);

  const handleDelegate = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    if (isAlreadyDelegated) {
      return;
    }

    // Switch to Arbitrum if not already on it
    if (!isOnArbitrum) {
      try {
        switchChain({ chainId: arbitrum.id });
        return; // User will need to click again after switching
      } catch (err) {
        console.error('Chain switch error:', err);
        setDelegationStatus('error');
        setErrorMessage('Please switch to Arbitrum network');
        setTimeout(() => {
          setDelegationStatus('idle');
          setErrorMessage(null);
        }, 5000);
        return;
      }
    }

    setDelegationStatus('idle');
    setErrorMessage(null);

    try {
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20VotesAbi,
        functionName: 'delegate',
        args: [delegateAddress as `0x${string}`],
        chainId: arbitrum.id,
      });
    } catch (err) {
      console.error('Delegation error:', err);
      setDelegationStatus('error');
      setErrorMessage('Failed to initiate delegation');
    }
  };

  // Format balance for display
  const formattedBalance = tokenBalance
    ? Number(formatUnits(tokenBalance, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '0';

  // Button text based on state
  const getButtonContent = () => {
    if (!isConnected) {
      return (
        <>
          Delegate your ARB
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </>
      );
    }

    if (!isOnArbitrum) {
      return (
        <>
          Switch to Arbitrum
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </>
      );
    }

    if (delegationStatus === 'delegating') {
      return (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {isConfirming ? 'Confirming...' : 'Delegating...'}
        </>
      );
    }

    if (delegationStatus === 'success') {
      return (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Delegated!
        </>
      );
    }

    if (delegationStatus === 'error') {
      return (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Failed
        </>
      );
    }

    if (isAlreadyDelegated) {
      return (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Delegating {formattedBalance} ARB
        </>
      );
    }

    return (
      <>
        Delegate {formattedBalance} ARB
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </>
    );
  };

  // Button styles based on state
  const getButtonStyles = () => {
    const baseStyles = "inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold transition-all duration-200";

    if (delegationStatus === 'success') {
      return `${baseStyles} bg-green-500 text-white cursor-default`;
    }

    if (delegationStatus === 'error') {
      return `${baseStyles} bg-red-500 text-white cursor-default`;
    }

    if (isAlreadyDelegated) {
      return `${baseStyles} bg-green-600 text-white cursor-default`;
    }

    if (delegationStatus === 'delegating') {
      return `${baseStyles} bg-gray-400 text-white cursor-wait`;
    }

    return `${baseStyles} bg-white text-blue-700 hover:bg-blue-50 cursor-pointer`;
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleDelegate}
        disabled={delegationStatus === 'delegating' || isAlreadyDelegated}
        className={getButtonStyles()}
      >
        {getButtonContent()}
      </button>
      {errorMessage && (
        <p className="text-xs text-red-200">{errorMessage}</p>
      )}
      {isConnected && !isAlreadyDelegated && tokenBalance && tokenBalance > 0n && delegationStatus === 'idle' && (
        <p className="text-xs text-blue-200">
          Your voting power: {formattedBalance} ARB
        </p>
      )}
    </div>
  );
}
