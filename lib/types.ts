export type Mode = 'rewrite-ending' | 'continue' | 'branch' | 'rewrite-section';

export interface LLMConfig {
  baseURL?: string;
  apiKey?: string;
  model?: string;
}

export interface GenOptions {
  temperature?: number;
  maxTokens?: number;
  /** 目标篇幅（字数），仅作为提示词里的软约束 */
  targetWords?: number;
  /** 喂给模型的原文上下文上限（字符数），用于超长文本裁剪 */
  maxContextChars?: number;
}

export interface GenerateRequest {
  mode: Mode;
  /** 原文全文 */
  text: string;
  /** 用户意愿 / 期望走向 */
  instruction?: string;
  /** 平行结局模式：分叉点描述 */
  branchPoint?: string;
  /** 局部改写模式：待改写片段 */
  section?: string;
  llm?: LLMConfig;
  options?: GenOptions;
}
