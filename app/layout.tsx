import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '结局模改器 · Rewrite My Ending',
  description:
    '按你的意愿改写小说结局、续写断更、生成平行结局。开源、纯静态、自带你的大模型 API 即用（OpenRouter / Ollama / DeepSeek / Kimi / 智谱 / OpenAI）。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
