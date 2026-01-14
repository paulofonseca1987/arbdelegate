import { NextResponse } from 'next/server';
import { getConfig, getDelegates } from '@/lib/config';

export async function GET() {
  try {
    const config = getConfig();
    const delegates = getDelegates();

    return NextResponse.json({
      delegateAddress: config.delegateAddress.toLowerCase(),
      tokenAddress: config.tokenAddress,
      chainId: config.chainId,
      delegates: delegates.map(d => ({
        ...d,
        address: d.address.toLowerCase(),
      })),
    });
  } catch (error) {
    console.error('Error reading config:', error);
    return NextResponse.json(
      { error: 'Failed to read config' },
      { status: 500 }
    );
  }
}
