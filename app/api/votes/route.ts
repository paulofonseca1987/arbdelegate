import { NextResponse } from 'next/server';
import { getVotesData, getVotesMetadata, getVotesInRange } from '@/lib/votesStorage';
import { normalizeAddress } from '@/lib/storage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || 'votes';
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

  try {
    if (endpoint === 'metadata') {
      const metadata = await getVotesMetadata(address);

      if (!metadata) {
        return NextResponse.json({
          lastSyncTimestamp: 0,
          totalVotes: 0,
          snapshotVotes: 0,
          onchainCoreVotes: 0,
          onchainTreasuryVotes: 0,
        });
      }

      return NextResponse.json(metadata);
    }

    if (endpoint === 'votes') {
      // Optional timestamp range filtering
      const fromTimestamp = searchParams.get('from');
      const toTimestamp = searchParams.get('to');

      if (fromTimestamp || toTimestamp) {
        const votes = await getVotesInRange(
          fromTimestamp ? parseInt(fromTimestamp, 10) : undefined,
          toTimestamp ? parseInt(toTimestamp, 10) : undefined,
          address
        );
        return NextResponse.json({ votes });
      }

      const data = await getVotesData(address);

      if (!data) {
        return NextResponse.json({ votes: [] });
      }

      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: `Unknown endpoint: ${endpoint}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error fetching votes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch votes' },
      { status: 500 }
    );
  }
}
