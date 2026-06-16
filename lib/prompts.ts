import type { GenerateRequest } from './types';
import { clip } from './context';

const STYLE_RULES = `写作要求：
- 严格延续原作的语言风格、叙事人称、时态与语气，读起来要像同一位作者亲笔所写。
- 保持人物性格、人物称谓、世界观设定、已发生的既定事实前后一致，不得与前文矛盾。
- 用与原文相同的语言写作（原文是中文就写中文，英文就写英文）。
- 注意呼应前文埋下的伏笔与铺垫，让转折显得有迹可循、令人信服。
- 只输出正文内容，不要输出任何解释、标题、点评，也不要写"以下是续写""好的，我来改写"之类的话。`;

const SYSTEM = `你是一位顶尖的小说编辑与代笔作家，擅长精准模仿任何作者的文风，并按读者意愿改写、续写或重构故事走向，同时保持长篇叙事的连贯性与一致性。你只产出高质量的故事正文。`;

export function buildMessages(req: GenerateRequest) {
  const ctxBudget = clampInt(req.options?.maxContextChars ?? 24000, 2000, 200000);
  const wish = (req.instruction || '').trim();
  const lenHint = req.options?.targetWords
    ? `\n篇幅参考：约 ${req.options.targetWords} 字（可适当浮动，以叙事完整为优先）。`
    : '';

  let task = '';

  switch (req.mode) {
    case 'continue': {
      const ctx = clip(req.text, ctxBudget);
      task =
        `下面是一部作品已有的内容（若过长，中间部分已省略）：\n\n` +
        `<<<原文\n${ctx}\n原文>>>\n\n` +
        `任务：从原文结尾处自然地继续往下写，承接当前剧情、情绪与节奏。` +
        (wish ? `\n读者期望的后续走向：${wish}` : `\n读者未指定方向，请按最合理、最精彩的方式推进剧情。`) +
        lenHint +
        `\n\n${STYLE_RULES}`;
      break;
    }

    case 'rewrite-ending': {
      const ctx = clip(req.text, ctxBudget);
      task =
        `下面是一部作品的内容（若过长，已保留开头设定与结尾剧情，省略中间部分）：\n\n` +
        `<<<原文\n${ctx}\n原文>>>\n\n` +
        `任务：前文保持不变，请你重新创作这部作品的结局。在合理衔接现有剧情、人物弧光与伏笔的前提下，按读者意愿改写结尾。` +
        (wish
          ? `\n读者想要的结局：${wish}`
          : `\n读者未给出具体要求，请创作一个比原作更有力量、更令人回味的结局。`) +
        lenHint +
        `\n\n${STYLE_RULES}`;
      break;
    }

    case 'branch': {
      const ctx = clip(req.text, ctxBudget);
      const point = (req.branchPoint || '').trim();
      task =
        `下面是一部作品的内容（若过长，中间部分已省略）：\n\n` +
        `<<<原文\n${ctx}\n原文>>>\n\n` +
        `任务：生成一条"平行结局 / 如果当初……"的分支剧情线。` +
        (point ? `\n指定的分叉点：${point}` : `\n请你自行选定一个关键转折点作为分叉点。`) +
        (wish ? `\n读者希望这条支线的走向：${wish}` : ``) +
        `\n请从分叉点开始，写出与原作不同的剧情发展，直到一个全新的结局。开头可用一句话点明"分叉点"，再展开正文。` +
        lenHint +
        `\n\n${STYLE_RULES}`;
      break;
    }

    case 'rewrite-section': {
      const excerpt = (req.section || '').trim();
      // 局部改写时，原文仅作上下文参考，分给它的预算小一些，把空间留给片段本身。
      const ctx = clip(req.text, Math.floor(ctxBudget * 0.7));
      task =
        (ctx
          ? `这是作品的整体上下文（仅供你保持一致性时参考）：\n\n<<<上下文\n${ctx}\n上下文>>>\n\n`
          : ``) +
        `下面是需要改写的具体片段：\n\n` +
        `<<<待改写片段\n${excerpt}\n待改写片段>>>\n\n` +
        `任务：仅改写"待改写片段"这一段，要求${wish ? `：${wish}` : '写得更精彩、更符合读者期待'}。` +
        `改写后的内容要能无缝替换原片段，与上下文衔接自然、风格统一。` +
        lenHint +
        `\n\n${STYLE_RULES}`;
      break;
    }
  }

  return [
    { role: 'system' as const, content: SYSTEM },
    { role: 'user' as const, content: task },
  ];
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
