import { NextRequest, NextResponse } from 'next/server';
import {
  getMetadata,
  getCurrentState,
  getFullTimeline,
  getTimelineRange,
  normalizeAddress
} from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const endpoint = searchParams.get('endpoint') || 'full';
    const addressParam = searchParams.get('address');

    // Validate address parameter
    if (!addressParam) {
      return NextResponse.json(
        { error: 'address parameter is required' },
        { status: 400 }
      );
    }

    let address: string;
    try {
      address = normalizeAddress(addressParam);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

    switch (endpoint) {
      case 'metadata': {
        const metadata = await getMetadata(address);
        return NextResponse.json(metadata || null);
      }

      case 'current': {
        const currentState = await getCurrentState(address);
        return NextResponse.json(currentState || null);
      }

      case 'timeline': {
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        if (from && to) {
          // Return timeline range
          const fromBlock = parseInt(from);
          const toBlock = parseInt(to);

          if (isNaN(fromBlock) || isNaN(toBlock)) {
            return NextResponse.json(
              { error: 'Invalid from or to block number' },
              { status: 400 }
            );
          }

          const timeline = await getTimelineRange(fromBlock, toBlock, address);
          return NextResponse.json(timeline);
        } else {
          // Return full timeline
          const timeline = await getFullTimeline(address);
          return NextResponse.json(timeline);
        }
      }

      default: {
        // Legacy full data endpoint for backward compatibility
        const [metadata, currentState, timeline] = await Promise.all([
          getMetadata(address),
          getCurrentState(address),
          getFullTimeline(address)
        ]);

        if (!metadata || !currentState) {
          return NextResponse.json(
            { error: 'No data found. Please run sync first.' },
            { status: 404 }
          );
        }

        // Return in legacy VotingPowerData format
        return NextResponse.json({
          lastSyncedBlock: metadata.lastSyncedBlock,
          timeline,
          currentDelegators: currentState.delegators
        });
      }
    }
  } catch (error: any) {
    console.error('Error fetching data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
