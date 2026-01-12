/**
 * Storage layer for vote data
 * Uses local file storage in data/ directory
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { VoteEntry, VotesMetadata, VotesData } from './types';
import { normalizeAddress } from './storage';

const LOCAL_DATA_DIR = join(process.cwd(), 'data');

const VOTES_METADATA_FILE = 'data-votes-metadata.json';
const VOTES_DATA_FILE = 'data-votes.json';

// Cache storage with TTL
const votesCache = new Map<string, { data: any; expiresAt: number }>();

// Ensure data directory exists
if (typeof window === 'undefined') {
  try {
    if (!existsSync(LOCAL_DATA_DIR)) {
      mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

/**
 * Get data directory for a specific address
 */
function getAddressDataDir(address: string): string {
  const normalized = normalizeAddress(address);
  const dir = join(LOCAL_DATA_DIR, normalized);

  // Ensure address directory exists
  if (typeof window === 'undefined' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return dir;
}

/**
 * Get cache key with address prefix
 */
function getCacheKey(key: string, address?: string): string {
  return address ? `${normalizeAddress(address)}:${key}` : key;
}

/**
 * Get cached data
 */
function getCachedData<T>(key: string): T | null {
  const cached = votesCache.get(key);
  if (!cached || Date.now() > cached.expiresAt) {
    votesCache.delete(key);
    return null;
  }
  return cached.data as T;
}

/**
 * Set cached data with TTL
 */
function setCachedData<T>(key: string, data: T, ttlMs: number): void {
  votesCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Clear votes cache
 */
export function clearVotesCache(): void {
  votesCache.clear();
}

/**
 * Read data from local file
 */
function readLocalFile(fileName: string, address?: string): string | null {
  try {
    const baseDir = address ? getAddressDataDir(address) : LOCAL_DATA_DIR;
    const filePath = join(baseDir, fileName);
    if (!existsSync(filePath)) {
      return null;
    }
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading local file ${fileName}:`, error);
    return null;
  }
}

/**
 * Write data to local file
 */
function writeLocalFile(fileName: string, data: string, address?: string): boolean {
  try {
    const baseDir = address ? getAddressDataDir(address) : LOCAL_DATA_DIR;
    const filePath = join(baseDir, fileName);
    writeFileSync(filePath, data, 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing local file ${fileName}:`, error);
    throw error;
  }
}

// ============================================================================
// VOTES METADATA
// ============================================================================

/**
 * Get votes metadata
 */
export async function getVotesMetadata(address?: string): Promise<VotesMetadata | null> {
  const cacheKey = getCacheKey('votes-metadata', address);

  // Check cache first
  const cached = getCachedData<VotesMetadata>(cacheKey);
  if (cached) return cached;

  const data = readLocalFile(VOTES_METADATA_FILE, address);
  if (!data) return null;

  try {
    const metadata = JSON.parse(data) as VotesMetadata;
    setCachedData(cacheKey, metadata, 30000); // 30 second cache
    return metadata;
  } catch (error) {
    console.error('Error parsing votes metadata:', error);
    return null;
  }
}

/**
 * Save votes metadata
 */
export async function saveVotesMetadata(metadata: VotesMetadata, address?: string): Promise<void> {
  const cacheKey = getCacheKey('votes-metadata', address);
  writeLocalFile(VOTES_METADATA_FILE, JSON.stringify(metadata, null, 2), address);
  setCachedData(cacheKey, metadata, 30000);
}

// ============================================================================
// VOTES DATA
// ============================================================================

/**
 * Get all votes
 */
export async function getVotesData(address?: string): Promise<VotesData | null> {
  const cacheKey = getCacheKey('votes-data', address);

  // Check cache first
  const cached = getCachedData<VotesData>(cacheKey);
  if (cached) return cached;

  const data = readLocalFile(VOTES_DATA_FILE, address);
  if (!data) return null;

  try {
    const votesData = JSON.parse(data) as VotesData;
    setCachedData(cacheKey, votesData, 60000); // 60 second cache
    return votesData;
  } catch (error) {
    console.error('Error parsing votes data:', error);
    return null;
  }
}

/**
 * Save all votes
 */
export async function saveVotesData(data: VotesData, address?: string): Promise<void> {
  const cacheKey = getCacheKey('votes-data', address);
  writeLocalFile(VOTES_DATA_FILE, JSON.stringify(data, null, 2), address);
  setCachedData(cacheKey, data, 60000);
}

/**
 * Add new votes (merging with existing, avoiding duplicates)
 */
export async function appendVotes(newVotes: VoteEntry[], address?: string): Promise<VotesData> {
  const existingData = await getVotesData(address);
  const existingVotes = existingData?.votes || [];

  // Create a map of existing votes by proposalId + source for deduplication
  const existingMap = new Map<string, VoteEntry>();
  for (const vote of existingVotes) {
    const key = `${vote.proposalId}-${vote.source}`;
    existingMap.set(key, vote);
  }

  // Add or update with new votes
  for (const vote of newVotes) {
    const key = `${vote.proposalId}-${vote.source}`;
    existingMap.set(key, vote);
  }

  // Convert back to array and sort by snapshot timestamp
  const allVotes = Array.from(existingMap.values());
  allVotes.sort((a, b) => a.snapshotTimestamp - b.snapshotTimestamp);

  const updatedData: VotesData = { votes: allVotes };
  await saveVotesData(updatedData, address);

  // Update metadata
  const metadata: VotesMetadata = {
    lastSyncTimestamp: Date.now(),
    totalVotes: allVotes.length,
    snapshotVotes: allVotes.filter((v) => v.source === 'snapshot').length,
    onchainCoreVotes: allVotes.filter((v) => v.source === 'onchain-core').length,
    onchainTreasuryVotes: allVotes.filter((v) => v.source === 'onchain-treasury').length,
  };
  await saveVotesMetadata(metadata, address);

  return updatedData;
}

/**
 * Get votes filtered by timestamp range
 */
export async function getVotesInRange(
  fromTimestamp?: number,
  toTimestamp?: number,
  address?: string
): Promise<VoteEntry[]> {
  const data = await getVotesData(address);
  if (!data) return [];

  return data.votes.filter((vote) => {
    if (fromTimestamp && vote.snapshotTimestamp < fromTimestamp) return false;
    if (toTimestamp && vote.snapshotTimestamp > toTimestamp) return false;
    return true;
  });
}
