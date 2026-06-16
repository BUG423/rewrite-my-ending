// 浏览器端直接调用 OpenAI 兼容接口（静态部署下没有后端代理）。
// 注意：浏览器跨域调用受 CORS 限制，部分服务商默认不允许，详见 README。

export interface StreamParams {
  baseURL: string;
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

export async function streamChat(p: StreamParams): Promise<void> {
  const base = p.baseURL.trim().replace(/\/+$/, '');

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: p.model,
        messages: p.messages,
        stream: true,
        temperature: p.temperature,
        max_tokens: p.maxTokens,
      }),
      signal: p.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new Error(
      `无法连接模型服务（${e?.message || e}）。\n` +
        `常见原因：① 接口地址 baseURL 填错；② 该服务商不允许浏览器直接调用（CORS）。\n` +
        `本项目为静态部署、由浏览器直连模型：建议改用支持浏览器直连的服务（如 OpenRouter）或本地 Ollama；` +
        `若必须用 OpenAI / DeepSeek 等，请改用带服务端代理的部署方式（见 README）。`
    );
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`模型服务返回错误 ${res.status}：${detail.slice(0, 600)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta: string | undefined = json?.choices?.[0]?.delta?.content;
        if (delta) p.onDelta(delta);
      } catch {
        // 单条 data 行解析失败就跳过
      }
    }
  }
}
