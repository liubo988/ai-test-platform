import { NextRequest, NextResponse } from 'next/server';
import { executeTest } from '@/lib/test-executor';

export async function POST(req: NextRequest) {
  try {
    const { code, sessionId, auth } = await req.json();
    if (!code) return NextResponse.json({ error: '缺少测试代码' }, { status: 400 });

    const result = await executeTest(code, sessionId || 'default', auth);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
