import { NextRequest, NextResponse } from 'next/server';
import { getSyncProgress, normalizeAddress } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
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

    const progress = await getSyncProgress(address);

    if (!progress) {
      return NextResponse.json({
        isActive: false,
        currentBlock: 0,
        targetBlock: 0,
        startBlock: 0,
        eventsProcessed: 0,
        percentComplete: 0,
        startedAt: 0
      });
    }

    return NextResponse.json(progress);
  } catch (error: any) {
    console.error('Error fetching sync progress:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
