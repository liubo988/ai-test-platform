import { NextRequest } from 'next/server';
import { generateTest } from '@/lib/test-generator';

export async function POST(req: NextRequest) {
  const { snapshot, description, auth } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generateTest(snapshot, description, auth)) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (err: any) {
        const data = `data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`;
        controller.enqueue(encoder.encode(data));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
