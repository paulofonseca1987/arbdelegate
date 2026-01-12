# Arbitrum Delegate Dashboard

A Next.js dashboard for tracking Arbitrum DAO delegate activity, voting power, and governance participation.

## Project Overview

- **Framework**: Next.js 14 with App Router
- **Blockchain**: Arbitrum (chainId: 42161)
- **Wallet Connection**: RainbowKit + wagmi
- **Token**: ARB (ERC20Votes)

## Key Files

- `config.json` - Delegate address, token address, block range configuration
- `data/` - Synced blockchain data (delegators, timeline, votes, metadata)
- `app/api/sync/` - Blockchain sync endpoints
- `app/api/votes/` - Vote sync endpoints (Snapshot + on-chain)
- `app/components/` - UI components (DelegateButton, DelegatorsList, TimelineChart, VotesList)

## Important Instructions

### Always Commit Data Files

When committing changes, **always include the data files** in `data/` directory:
- `data/data-metadata.json`
- `data/data-current-state.json`
- `data/data-timeline-*.json`
- `data/data-votes.json`
- `data/data-votes-metadata.json`

These files contain synced blockchain state and should be committed to preserve the latest data.

**Do NOT commit:**
- `data/data-sync-lock.json` (temporary lock file)
- `data/data-sync-progress.json` (temporary progress file)

### Gas Fees on Arbitrum

When sending transactions on Arbitrum, always specify explicit gas fees to avoid "max fee per gas less than block base fee" errors:
```typescript
maxFeePerGas: parseGwei('0.1'),
maxPriorityFeePerGas: parseGwei('0.01'),
```

### Environment Variables

Required in `.env.local`:
- `ARBITRUM_RPC_URL` - RPC endpoint for Arbitrum (e.g., dRPC, Alchemy)

## Sync Commands

- Start server: `npm run dev`
- Sync delegation data: `POST /api/sync`
- Sync votes: `POST /api/votes/sync`
