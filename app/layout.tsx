import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI E2E 测试平台',
  description: '输入 URL + 功能描述，自动生成并执行 E2E 测试',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
