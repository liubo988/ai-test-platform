import { NextRequest, NextResponse } from 'next/server';
import { handleTestFailure } from '@/lib/feedback-loop';

export async function POST(req: NextRequest) {
  try {
    const { testCode, error, url, description } = await req.json();
    const result = await handleTestFailure(testCode, error, url, description);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
