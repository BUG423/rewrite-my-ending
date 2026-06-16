/**
 * 超长文本裁剪：小说动辄几十上百万字，远超模型上下文。
 * 策略：保留开头（设定/人物登场）一部分 + 结尾（最新剧情）一大部分，
 * 中间用占位标记省略。这样既保住世界观设定，又保住最贴近"结局"的近期剧情。
 */
export function clip(text: string, maxChars: number, headRatio = 0.2): string {
  const t = (text || '').trim();
  if (t.length <= maxChars) return t;

  const head = Math.max(0, Math.floor(maxChars * headRatio));
  const tail = Math.max(0, maxChars - head);
  const omitted = t.length - head - tail;

  const parts: string[] = [];
  if (head > 0) parts.push(t.slice(0, head));
  parts.push(`\n\n……（为适配模型上下文，此处省略中间约 ${omitted.toLocaleString()} 字）……\n\n`);
  if (tail > 0) parts.push(t.slice(t.length - tail));
  return parts.join('');
}

/** 粗略估算中文/英文混排的字数（按字符数近似） */
export function countWords(text: string): number {
  return (text || '').trim().length;
}
