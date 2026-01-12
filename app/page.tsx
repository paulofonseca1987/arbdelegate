"use client";

import { useState, useEffect } from "react";
import TimelineChart from "./components/TimelineChart";
import DelegatorsList from "./components/DelegatorsList";
import VotesList from "./components/VotesList";
import DelegateButton from "./components/DelegateButton";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Helper function to format date as "Jan 1st, 2026 at 14:32:33 UTC"
function formatBlockTimestamp(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const day = date.getUTCDate();
  const ordinal = getOrdinalSuffix(day);
  const month = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const time = date.toISOString().slice(11, 19); // HH:mm:ss
  return `${month} ${day}${ordinal}, ${year} at ${time} UTC`;
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}
import type {
  MetadataSchema,
  CurrentStateSchema,
  TimelineEntry,
  SyncProgress,
  VoteEntry,
  VotesMetadata,
} from "@/lib/types";

export default function Home() {
  const [metadata, setMetadata] = useState<MetadataSchema | null>(null);
  const [currentState, setCurrentState] = useState<CurrentStateSchema | null>(
    null,
  );
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [votes, setVotes] = useState<VoteEntry[]>([]);
  const [votesMetadata, setVotesMetadata] = useState<VotesMetadata | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingVotes, setSyncingVotes] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [delegateAddress, setDelegateAddress] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [tallyDaoName, setTallyDaoName] = useState<string>('arbitrum');
  const [snapshotSpace, setSnapshotSpace] = useState<string>('arbitrumfoundation.eth');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load critical data first (metadata + current state) - fast
      const [metadataRes, currentRes] = await Promise.all([
        fetch("/api/data?endpoint=metadata"),
        fetch("/api/data?endpoint=current"),
      ]);

      if (!metadataRes.ok || !currentRes.ok) {
        if (metadataRes.status === 404 || currentRes.status === 404) {
          // No data yet, but don't show error if sync is active
          const progressRes = await fetch("/api/sync/progress");
          if (progressRes.ok) {
            const progress = await progressRes.json();
            if (!progress.isActive) {
              setError("No data found. Please sync first.");
            }
          } else {
            setError("No data found. Please sync first.");
          }
          setLoading(false);
          return;
        }
        throw new Error("Failed to fetch data");
      }

      const metadataData = await metadataRes.json();
      const currentStateData = await currentRes.json();

      setMetadata(metadataData);
      setCurrentState(currentStateData);
      setLoading(false);

      // Load timeline in background - slower
      setTimelineLoading(true);
      const timelineRes = await fetch("/api/data?endpoint=timeline");

      if (timelineRes.ok) {
        const timelineData = await timelineRes.json();
        setTimeline(timelineData);
      }
      setTimelineLoading(false);

      // Load votes data
      try {
        const [votesRes, votesMetaRes] = await Promise.all([
          fetch("/api/votes?endpoint=votes"),
          fetch("/api/votes?endpoint=metadata"),
        ]);

        if (votesRes.ok) {
          const votesData = await votesRes.json();
          setVotes(votesData.votes || []);
        }

        if (votesMetaRes.ok) {
          const votesMeta = await votesMetaRes.json();
          setVotesMetadata(votesMeta);
        }
      } catch (err) {
        console.warn("Failed to fetch votes:", err);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
      setLoading(false);
      setTimelineLoading(false);
    }
  };

  const handleSyncVotes = async () => {
    try {
      setSyncingVotes(true);
      setSyncStatus("Syncing votes...");

      const response = await fetch("/api/votes/sync", { method: "POST" });
      const result = await response.json();

      if (response.ok) {
        setSyncStatus(
          `Votes sync completed! Snapshot: ${result.snapshotVotes}, Core: ${result.onchainCoreVotes}, Treasury: ${result.onchainTreasuryVotes}`,
        );
        // Refresh votes data
        const votesRes = await fetch("/api/votes?endpoint=votes");
        if (votesRes.ok) {
          const votesData = await votesRes.json();
          setVotes(votesData.votes || []);
        }
        const votesMetaRes = await fetch("/api/votes?endpoint=metadata");
        if (votesMetaRes.ok) {
          const votesMeta = await votesMetaRes.json();
          setVotesMetadata(votesMeta);
        }
      } else {
        throw new Error(result.error || "Votes sync failed");
      }
    } catch (err: any) {
      setError(err.message || "Votes sync failed");
      setSyncStatus(null);
    } finally {
      setSyncingVotes(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncStatus("Starting sync...");

      // Start the sync request (non-blocking)
      fetch("/api/sync", { method: "POST" })
        .then(async (response) => {
          const result = await response.json();
          if (response.ok) {
            setSyncStatus(
              `Sync completed! Processed ${result.eventsProcessed} events. Timeline entries: ${result.timelineEntries}, Delegators: ${result.currentDelegators}`,
            );
          } else {
            throw new Error(result.error || "Sync failed");
          }
        })
        .catch((err: any) => {
          setError(err.message || "Sync failed");
          setSyncStatus(null);
          setSyncing(false);
        });
    } catch (err: any) {
      setError(err.message || "Sync failed");
      setSyncStatus(null);
      setSyncing(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatTimeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const fetchSyncProgress = async () => {
    try {
      const response = await fetch("/api/sync/progress");
      if (response.ok) {
        const progress = await response.json();
        setSyncProgress(progress);

        // Update syncing state based on progress
        if (progress.isActive) {
          setSyncing(true);
        } else {
          // Sync completed
          setSyncing(false);
          setSyncProgress(null);
          // Refresh data after sync completes
          await fetchData();
        }
      }
    } catch (err) {
      console.warn("Failed to fetch sync progress:", err);
    }
  };

  useEffect(() => {
    // Fetch config to get delegate address
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (response.ok) {
          const config = await response.json();
          setDelegateAddress(config.delegateAddress);
          setTokenAddress(config.tokenAddress);
          if (config.tallyDaoName) setTallyDaoName(config.tallyDaoName);
          if (config.snapshotSpace) setSnapshotSpace(config.snapshotSpace);
        }
      } catch (err) {
        console.warn("Failed to fetch config:", err);
      }
    };

    fetchConfig();

    // Check if sync is already in progress FIRST
    fetchSyncProgress();

    // Then fetch data
    fetchData();

    // Auto-sync: Check if data is stale and trigger background sync
    const checkAndAutoSync = async () => {
      try {
        const metadataRes = await fetch("/api/data?endpoint=metadata");
        if (metadataRes.ok) {
          const metadata = await metadataRes.json();
          const now = Date.now();
          const oneHour = 60 * 60 * 1000;

          // If data is older than 1 hour, trigger background sync
          if (now - metadata.lastSyncTimestamp > oneHour) {
            console.log("Data is stale, triggering background sync...");
            fetch("/api/sync/background", {
              method: "POST",
              headers: {
                "X-Sync-Token":
                  process.env.NEXT_PUBLIC_SYNC_SECRET || "default-secret",
              },
            }).catch((err) => console.warn("Background sync failed:", err));
          }
        }
      } catch (err) {
        console.warn("Auto-sync check failed:", err);
      }
    };

    checkAndAutoSync();
  }, []);

  // Poll for sync progress
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (syncing) {
      // Poll every 2 seconds while syncing
      fetchSyncProgress();
      intervalId = setInterval(fetchSyncProgress, 2000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [syncing]);

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg p-8 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold mb-3">
                Delegate Activity Dashboard
              </h1>
              <p className="text-blue-100 text-lg mb-4 max-w-2xl">
                Track delegation activity, voting power, and governance participation for this delegate.
              </p>
              {delegateAddress && (
                <div className="flex items-center gap-2 text-sm text-blue-200">
                  <span className="font-mono bg-white/10 px-3 py-1 rounded-full">
                    {delegateAddress.slice(0, 6)}...{delegateAddress.slice(-4)}
                  </span>
                  <span className="text-blue-300">•</span>
                  <span>Arbitrum DAO Delegate</span>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {delegateAddress && tokenAddress && (
                <DelegateButton
                  delegateAddress={delegateAddress}
                  tokenAddress={tokenAddress}
                />
              )}
            </div>
          </div>
        </div>

        {/* Sync Progress Visualization */}
        {syncProgress && syncProgress.isActive && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Syncing Blockchain Data
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {syncProgress.percentComplete.toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {syncProgress.estimatedTimeRemaining
                      ? formatDuration(syncProgress.estimatedTimeRemaining)
                      : "Calculating..."}{" "}
                    remaining
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                  style={{ width: `${syncProgress.percentComplete}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
                </div>
              </div>
            </div>

            {/* Progress Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-1">
                  Current Block
                </p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {syncProgress.currentBlock.toLocaleString()}
                </p>
              </div>
              {metadata && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    Last Checkpoint Block
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {metadata.lastSyncedBlock.toLocaleString()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-1">
                  Events Processed
                </p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {syncProgress.eventsProcessed.toLocaleString()}
                </p>
              </div>
              {metadata && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    Timeline Entries
                  </p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {metadata.totalTimelineEntries.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Block Range Info */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Processing blocks {syncProgress.startBlock.toLocaleString()} to{" "}
                {syncProgress.targetBlock.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">
                Loading data...
              </p>
            </div>
          </div>
        ) : metadata && currentState ? (
          <>
            {/* Summary Stats + Timeline Chart */}
            <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex flex-col md:flex-row gap-4 py-4 mb-6">
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {votesMetadata?.totalVotes || 0} Votes Cast
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    both offchain and onchain
                  </p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Object.keys(currentState.delegators).length} Delegators
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    with{" "}
                    {
                      Object.values(currentState.delegators).filter(
                        (balance) => BigInt(balance) > 0n,
                      ).length
                    }{" "}
                    currently active
                  </p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(() => {
                      const formatted = (
                        Number(metadata.totalVotingPower) / 1e18
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      });
                      const [integerPart, decimalPart] = formatted.split(".");
                      return (
                        <>
                          {integerPart}
                          {decimalPart && (
                            <>
                              <span>.</span>
                              <span>{decimalPart}</span>
                            </>
                          )}
                          {" ARB"}
                        </>
                      );
                    })()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    total voting power
                  </p>
                </div>
              </div>
              {timelineLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Loading timeline data...
                    </p>
                  </div>
                </div>
              ) : timeline.length > 0 ? (
                <>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-right">
                    All data as of{" "}
                    {formatBlockTimestamp(metadata.lastBlockTimestamp || metadata.lastSyncTimestamp / 1000)}{" "}
                    on Arbitrum block{" "}
                    <a
                      href={`https://arbiscan.io/block/${metadata.lastSyncedBlock}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {metadata.lastSyncedBlock.toLocaleString()}
                    </a>
                  </p>
                  <TimelineChart timeline={timeline} votes={votes} lastSyncTimestamp={(metadata.lastBlockTimestamp || metadata.lastSyncTimestamp / 1000) * 1000} />
                </>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  No timeline data available.
                </p>
              )}
            </div>

            {/* Delegators List */}
            <div className="mb-8">
              <DelegatorsList
                delegators={currentState.delegators}
                timeline={timeline}
                votes={votes}
                delegateAddress={delegateAddress || undefined}
              />
            </div>

            {/* Votes List */}
            <div className="mb-8">
              <VotesList votes={votes} tallyDaoName={tallyDaoName} snapshotSpace={snapshotSpace} />
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-gray-500 dark:text-gray-400">
              No data available. Click &quot;Sync Data&quot; to start tracking.
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
            <p>
              Built by{' '}
              <a
                href="https://paulofonseca.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                paulofonseca.eth
              </a>
            </p>
            <a
              href="https://github.com/paulofonseca1987/arbdelegate"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Open Source on GitHub
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
