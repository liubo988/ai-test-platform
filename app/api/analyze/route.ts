import { NextRequest, NextResponse } from 'next/server';
import { analyzePage } from '@/lib/page-analyzer';

export async function POST(req: NextRequest) {
  try {
    const { url, auth } = await req.json();
    if (!url) return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });

    const snapshot = await analyzePage(url, auth);
    return NextResponse.json({ snapshot });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
