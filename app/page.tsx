'use client';

import { useEffect, useRef, useState } from 'react';
import type { Mode } from '@/lib/types';
import { buildMessages } from '@/lib/prompts';
import { streamChat } from '@/lib/llm';

interface Settings {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  targetWords: number;
}

const DEFAULT_SETTINGS: Settings = {
  providerId: '',
  baseURL: '',
  apiKey: '',
  model: '',
  temperature: 0.85,
  targetWords: 1500,
};

interface Provider {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  keyUrl: string;
  keyLabel: string;
  help: string;
  /** 是否允许浏览器跨域直连（本项目为静态部署，浏览器直接调模型） */
  browserOk: boolean;
}

const PROVIDERS: Provider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat',
    keyUrl: 'https://openrouter.ai/keys',
    keyLabel: 'openrouter.ai/keys',
    help: '一个 Key 调用几十家模型，且允许浏览器直接调用——最适合本项目。注册后到 Keys 页面创建即可，部分模型有免费额度。',
    browserOk: true,
  },
  {
    id: 'ollama',
    name: '本地 Ollama',
    baseURL: 'http://localhost:11434/v1',
    model: 'qwen2.5',
    keyUrl: 'https://ollama.com/download',
    keyLabel: 'ollama.com/download',
    help: '在自己电脑上跑模型：完全免费、数据不出本机、无需 Key（留空）。先安装 Ollama，再执行 `ollama pull qwen2.5`。需设置环境变量 OLLAMA_ORIGINS=* 以允许网页访问。',
    browserOk: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyLabel: 'platform.deepseek.com',
    help: '中文写作好、价格便宜。注册 platform.deepseek.com → 充值 → 在「API keys」创建密钥。',
    browserOk: false,
  },
  {
    id: 'moonshot',
    name: 'Kimi / Moonshot',
    baseURL: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-32k',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    keyLabel: 'platform.moonshot.cn',
    help: '长上下文能力强，适合长篇。在 platform.moonshot.cn 控制台创建 API Key。',
    browserOk: false,
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    keyLabel: 'bigmodel.cn',
    help: 'glm-4-flash 有免费额度。在 bigmodel.cn 用户中心 →「API Keys」创建。',
    browserOk: false,
  },
  {
    id: 'openai',
    name: 'OpenAI / ChatGPT',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLabel: 'platform.openai.com',
    help: '注意：要的是 platform.openai.com 的 API Key（按量付费、需单独充值），和 ChatGPT 网页版会员不是一回事。',
    browserOk: false,
  },
  {
    id: 'custom',
    name: '其他 / 自定义',
    baseURL: '',
    model: '',
    keyUrl: '',
    keyLabel: '',
    help: '任何 OpenAI 兼容接口都行：手动填写下面的接口地址、模型名和 Key 即可。',
    browserOk: true,
  },
];

const MODES: { id: Mode; name: string; hint: string }[] = [
  { id: 'rewrite-ending', name: '改写结局', hint: '保留前文，按你的意愿重写结尾' },
  { id: 'continue', name: '续写', hint: '作者断更？从结尾接着往下写' },
  { id: 'branch', name: '平行结局', hint: '选个分叉点，走出不同的剧情线' },
  { id: 'rewrite-section', name: '局部改写', hint: '只改你指定的那一段' },
];

const STORAGE_KEY = 'rewrite-my-ending.settings.v1';

export default function Page() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [mode, setMode] = useState<Mode>('rewrite-ending');
  const [text, setText] = useState('');
  const [instruction, setInstruction] = useState('');
  const [branchPoint, setBranchPoint] = useState('');
  const [section, setSection] = useState('');

  const [output, setOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const mainRef = useRef<HTMLTextAreaElement | null>(null);
  const outRef = useRef<HTMLDivElement | null>(null);

  // 载入本地保存的设置
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  // 设置变化时持久化
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings, loaded]);

  // 首次打开、还没配置时自动弹出设置
  useEffect(() => {
    if (loaded && !(settings.baseURL && settings.model)) setShowSettings(true);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 流式输出时自动滚到底部
  useEffect(() => {
    if (streaming && outRef.current) {
      outRef.current.scrollTop = outRef.current.scrollHeight;
    }
  }, [output, streaming]);

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ''));
    reader.onerror = () => setError('文件读取失败，请确认是纯文本（.txt / .md）');
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }

  function grabSelection() {
    const el = mainRef.current;
    if (!el) return;
    const sel = el.value.slice(el.selectionStart, el.selectionEnd);
    if (sel.trim()) setSection(sel);
    else setError('请先在上方原文里选中要改写的片段，再点这里');
  }

  async function generate() {
    setError('');
    if (!settings.model || !settings.baseURL) {
      setShowSettings(true);
      setError('请先在「设置」里选择服务商并填入你的 API Key');
      return;
    }
    if (mode === 'rewrite-section') {
      if (!section.trim()) {
        setError('请填写（或从原文里选取）要改写的片段');
        return;
      }
    } else if (!text.trim()) {
      setError('请先粘贴或上传原文');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setOutput('');

    try {
      const messages = buildMessages({
        mode,
        text,
        instruction,
        branchPoint,
        section,
        options: { targetWords: settings.targetWords },
      });
      await streamChat({
        baseURL: settings.baseURL,
        apiKey: settings.apiKey,
        model: settings.model,
        messages,
        temperature: settings.temperature,
        maxTokens: Math.min(16000, Math.max(800, Math.round((settings.targetWords || 1500) * 2.2))),
        signal: controller.signal,
        onDelta: (t) => setOutput((o) => o + t),
      });
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || String(e));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function copyOut() {
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      /* ignore */
    }
  }

  function downloadOut() {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `改写结果_${MODES.find((m) => m.id === mode)?.name || ''}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const charCount = text.length;
  const configured = !!(settings.baseURL && settings.model);
  const activeProvider = PROVIDERS.find((p) => p.id === settings.providerId);

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <div className="brand">
            <h1>结局模改器</h1>
            <span className="en">Rewrite My Ending</span>
          </div>
          <p className="tagline">不满意原作的结局？嫌作者更新太慢？把故事交给你自己改写。</p>
        </div>
        <button className="iconbtn" onClick={() => setShowSettings(true)}>
          ⚙ 设置{configured ? ` · ${activeProvider?.name || '已配置'}` : ' · 待配置'}
        </button>
      </div>

      <div className="grid">
        {/* 左栏：输入 */}
        <div className="card">
          <h2>
            <span className="num">1</span> 原文
          </h2>
          <textarea
            ref={mainRef}
            className="main"
            placeholder="把小说 / 文章 / 名著的正文粘贴到这里，或上传 .txt / .md 文件……"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="hintline">
            <span className="counter">{charCount.toLocaleString()}</span> 字
            {charCount > 24000 && ' · 文本较长，将自动保留开头设定与最新剧情送入模型'}
            <label className="btn sm ghost" style={{ float: 'right', cursor: 'pointer' }}>
              📎 上传文件
              <input type="file" accept=".txt,.md,.markdown,text/plain" hidden onChange={onUpload} />
            </label>
          </div>

          <h2 style={{ marginTop: 24 }}>
            <span className="num">2</span> 改写方式
          </h2>
          <div className="modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`mode ${mode === m.id ? 'active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <div className="name">{m.name}</div>
                <div className="hint">{m.hint}</div>
              </button>
            ))}
          </div>

          {mode === 'branch' && (
            <>
              <label className="field">分叉点（可选）——故事从哪里开始走向不同？</label>
              <input
                type="text"
                placeholder="例：男主在第十章没有上那艘船 / 女主当年没有答应那门婚事"
                value={branchPoint}
                onChange={(e) => setBranchPoint(e.target.value)}
              />
            </>
          )}

          {mode === 'rewrite-section' && (
            <>
              <label className="field">
                待改写片段
                <button className="btn sm ghost" style={{ float: 'right' }} onClick={grabSelection}>
                  ⤴ 用上方选中的文字填入
                </button>
              </label>
              <textarea
                style={{ minHeight: 120 }}
                placeholder="把需要改写的那一段粘到这里（原文那栏作为上下文，帮助保持一致）"
                value={section}
                onChange={(e) => setSection(e.target.value)}
              />
            </>
          )}

          <label className="field">
            {mode === 'rewrite-ending'
              ? '你想要的结局（可留空，让 AI 自由发挥）'
              : mode === 'continue'
              ? '你希望剧情怎么走（可留空）'
              : mode === 'branch'
              ? '你希望这条支线的走向（可留空）'
              : '改写要求（怎么改这段）'}
          </label>
          <textarea
            style={{ minHeight: 90 }}
            placeholder={
              mode === 'rewrite-ending'
                ? '例：让男女主在一起，反派幡然悔悟；或：保留悲剧基调但给一个更克制、更余韵悠长的收尾'
                : mode === 'continue'
                ? '例：加快节奏，让主角尽快与失散的同伴重逢'
                : mode === 'branch'
                ? '例：如果当初她选择留下，会发生什么？'
                : '例：把这段打斗写得更有张力，增加心理描写'
            }
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />

          <div className="btn-row">
            {!streaming ? (
              <button className="btn primary" onClick={generate}>
                ✦ 开始改写
              </button>
            ) : (
              <button className="btn" onClick={stop}>
                ■ 停止生成
              </button>
            )}
            <span className="hintline" style={{ marginTop: 0 }}>
              篇幅约 {settings.targetWords} 字 · 创意度 {settings.temperature.toFixed(2)}
            </span>
          </div>

          {error && <div className="banner error">⚠ {error}</div>}
        </div>

        {/* 右栏：输出 */}
        <div className="card">
          <h2 style={{ justifyContent: 'space-between' }}>
            <span>
              <span className="num">3</span> 改写结果
            </span>
            {output && (
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="btn sm ghost" onClick={copyOut}>
                  复制
                </button>
                <button className="btn sm ghost" onClick={downloadOut}>
                  下载 .txt
                </button>
              </span>
            )}
          </h2>
          <div
            ref={outRef}
            className={`output ${output ? '' : 'empty'}`}
            style={{ maxHeight: '70vh', overflowY: 'auto' }}
          >
            {output ? (
              <>
                {output}
                {streaming && <span className="cursor" />}
              </>
            ) : streaming ? (
              '正在构思……'
            ) : (
              '改写结果会在这里逐字呈现。先在左侧准备好原文与要求，再点「开始改写」。'
            )}
          </div>
        </div>
      </div>

      <div className="footer">
        结局模改器 · Rewrite My Ending — 开源 (MIT)。你的 API Key 与文本仅保存在本机浏览器，
        请求由你的浏览器直接发往你选择的模型服务，本站不设服务器、不经手、不留存任何数据。
        <br />
        ⚠ 请尊重原作者版权：本工具仅供个人阅读、学习与同人创作，请勿用于商业用途或传播侵权内容。
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={(s) => {
            setSettings(s);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);
  const provider = PROVIDERS.find((p) => p.id === draft.providerId);

  function pickProvider(p: Provider) {
    setDraft((d) => ({
      ...d,
      providerId: p.id,
      // 自定义模式不覆盖用户已填内容
      baseURL: p.id === 'custom' ? d.baseURL : p.baseURL,
      model: p.id === 'custom' ? d.model : p.model,
    }));
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>连接你的大模型</h2>
        <p className="sub">
          本工具不自带模型，需要你提供自己的 API。下面选一个服务商、填入你自己的 API Key 即可。
          所有信息只保存在你本机浏览器里。
        </p>

        <label className="field">① 选择服务商</label>
        <div className="provider-chips">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              className={draft.providerId === p.id ? 'active' : ''}
              onClick={() => pickProvider(p)}
            >
              {p.name}
            </button>
          ))}
        </div>

        {provider && (
          <div className={`provider-help ${provider.browserOk ? '' : 'warn'}`}>
            <p>{provider.help}</p>
            {provider.keyUrl && (
              <p>
                没有 Key？前往{' '}
                <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer">
                  {provider.keyLabel} →
                </a>{' '}
                注册并创建。
              </p>
            )}
            {!provider.browserOk && (
              <p className="cors">
                ⚠ 该服务商通常<strong>不允许浏览器直接调用</strong>（CORS 限制）。本工具为静态部署、由浏览器直连，
                可能会报「无法连接」错误。建议改用 <strong>OpenRouter</strong> 或 <strong>本地 Ollama</strong>，
                或采用带服务端代理的部署方式（见 README）。
              </p>
            )}
          </div>
        )}

        <label className="field">② 你的 API Key{provider?.id === 'ollama' ? '（本地 Ollama 可留空）' : ''}</label>
        <input
          type="password"
          placeholder="sk-..."
          value={draft.apiKey}
          onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
        />

        <label className="field">③ 接口地址 baseURL（已自动填好，一般无需改动）</label>
        <input
          type="text"
          placeholder="https://openrouter.ai/api/v1"
          value={draft.baseURL}
          onChange={(e) => setDraft({ ...draft, baseURL: e.target.value, providerId: 'custom' })}
        />

        <label className="field">④ 模型名称 model</label>
        <input
          type="text"
          placeholder="deepseek/deepseek-chat"
          value={draft.model}
          onChange={(e) => setDraft({ ...draft, model: e.target.value })}
        />

        <div className="row" style={{ marginTop: 4 }}>
          <div>
            <label className="field">创意度 temperature</label>
            <div className="slider-row">
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={draft.temperature}
                onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })}
              />
              <span className="val">{draft.temperature.toFixed(2)}</span>
            </div>
            <div className="hintline">越高越天马行空，越低越稳健贴合原文</div>
          </div>
          <div>
            <label className="field">目标篇幅（字）</label>
            <input
              type="number"
              min={200}
              max={8000}
              step={100}
              value={draft.targetWords}
              onChange={(e) => setDraft({ ...draft, targetWords: Number(e.target.value) })}
            />
            <div className="hintline">实际长度受模型能力影响</div>
          </div>
        </div>

        <div className="foot">
          <button className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={!draft.baseURL || !draft.model}
            onClick={() => onSave(draft)}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
