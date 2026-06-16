# 结局模改器 · Rewrite My Ending

> 不满意原作的结局？嫌作者更新太慢？把故事交给你自己改写。

一个开源的「故事结局模改器」：把小说、名著、文章的正文喂进去，用自然语言说出你想要的走向，AI 就按你的意愿**改写结局 / 续写 / 生成平行结局 / 局部改写**——并尽量延续原作的文风与人物。

- 🔑 **自带你的 API 即用**：本工具不自带模型。你在界面里选择服务商、填入**你自己的 API Key** 即可，密钥只存在你本机浏览器。
- 🌐 **纯静态、零后端**：可直接托管到 GitHub Pages。请求由你的浏览器直接发往你选的模型服务，本站不设服务器、不经手、不留存任何数据。
- 🔌 **任意 OpenAI 兼容模型**：OpenRouter、本地 Ollama、DeepSeek、Kimi、智谱、OpenAI……填 baseURL + Key + 模型名即可。
- ⚡ **逐字流式输出**，像看作者现场敲键盘。
- 📚 **超长文本友好**：几十万字也能用——自动保留开头设定与最新剧情送入模型。

---

## 功能

| 模式 | 用途 |
| --- | --- |
| **改写结局** | 保留前文不动，按你的意愿重写结尾。可指定走向，也可留空让 AI 自由发挥。 |
| **续写** | 作者断更时，从原文结尾自然往下接着写。 |
| **平行结局** | 选定一个「分叉点」（如"如果当初她没上那艘船"），走出一条与原作不同的剧情线。 |
| **局部改写** | 只改你指定的某一段（可直接在原文里框选），其余作为上下文保持一致。 |

---

## 一分钟上手

1. 打开网站（或本地 `npm run dev`）。
2. 点右上角 **⚙ 设置**，选一个服务商，按提示**填入你自己的 API Key**。
3. 左侧粘贴/上传原文 → 选改写方式 → 写下你想要的走向 → 点 **开始改写**。

### 我还没有 API Key，去哪里搞？

本工具**不提供模型**，你需要自备一个 OpenAI 兼容服务的 Key。下面任选其一：

| 服务商 | 适合 | 在哪申请 Key | 浏览器直连 |
| --- | --- | --- | --- |
| **OpenRouter** ⭐ | 一个 Key 调几十种模型，对本项目最省心 | <https://openrouter.ai/keys> | ✅ 支持 |
| **本地 Ollama** ⭐ | 完全免费、数据不出本机、无需 Key | 安装 <https://ollama.com/download>，再 `ollama pull qwen2.5` | ✅ 支持 |
| DeepSeek | 中文写作好、便宜 | <https://platform.deepseek.com/api_keys> | ⚠ 见下方 CORS |
| Kimi / Moonshot | 长上下文强 | <https://platform.moonshot.cn/console/api-keys> | ⚠ 见下方 CORS |
| 智谱 GLM | `glm-4-flash` 有免费额度 | <https://open.bigmodel.cn/usercenter/apikeys> | ⚠ 见下方 CORS |
| OpenAI / ChatGPT | 通用 | <https://platform.openai.com/api-keys>（注意是 API Key，非 ChatGPT 会员） | ⚠ 见下方 CORS |

> 💡 不知道选哪个？**想免费/隐私优先就用本地 Ollama；想省事就用 OpenRouter。**

### ⚠ 关于 CORS（很重要）

本工具是**纯静态前端，由浏览器直接调用模型**。而 OpenAI、DeepSeek 等多数云服务商**默认不允许浏览器跨域直连**（CORS 限制），直接使用会报「无法连接」。

可靠的用法：

- ✅ **OpenRouter**：允许浏览器直连，开箱即用。
- ✅ **本地 Ollama**：自己的服务，启动时设 `OLLAMA_ORIGINS=*` 即可被网页访问。
- 🔁 想用 OpenAI / DeepSeek 等被 CORS 限制的服务：请改用**带服务端代理的部署方式**（见下文「想要服务端代理？」）。

---

## 本地运行

需要 Node.js ≥ 18。

```bash
npm install
npm run dev      # 打开 http://localhost:3000
```

构建静态产物：

```bash
npm run build    # 产物在 out/，可直接托管到任意静态服务器
```

---

## 部署到 GitHub Pages

仓库已内置 GitHub Actions（`.github/workflows/deploy.yml`），推到 `main` 即自动构建并发布。

1. 把本项目推到名为 **`rewrite-my-ending`** 的 GitHub 仓库
   （若用别的仓库名，请同步修改 workflow 里的 `PAGES_BASE_PATH`）。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
3. 推送代码，等待 Actions 跑完，站点会发布在
   `https://<你的用户名>.github.io/rewrite-my-ending/`。

> Pages 部署的是静态前端，因此遵循上面的 CORS 说明：建议搭配 OpenRouter 或本地 Ollama 使用。

---

## 想要服务端代理？（绕过 CORS，支持任意服务商）

如果你希望任意服务商（OpenAI/DeepSeek…）都能用、且把 Key 藏在服务端，可以加一层代理：

- 用 **Vercel** 部署一个把请求转发到模型的 API（无 CORS 问题、Key 在服务端）；或
- 用 **Cloudflare Worker** 等做一个轻量转发。

欢迎 PR 一个可选的代理模式（在设置里填代理地址即可）。

---

## 工作原理

```
浏览器 (app/page.tsx)
   │  buildMessages()         ← lib/prompts.ts  按模式构造提示词
   │  clip()                  ← lib/context.ts  超长文本保头留尾
   ▼  streamChat()            ← lib/llm.ts      直接 fetch 你的模型 /chat/completions (stream=true)
你选择的模型服务  →  逐字流式返回，前端实时拼接呈现
```

关键文件：

- `lib/prompts.ts` —— 四种模式的提示词工程，是改写质量的核心，欢迎调优。
- `lib/context.ts` —— 长文本上下文裁剪策略。
- `lib/llm.ts` —— 浏览器端 OpenAI 兼容流式调用与 SSE 解析。
- `app/page.tsx` —— 全部前端交互与服务商配置向导。

---

## 路线图（欢迎 PR）

- [ ] 可选的服务端代理模式（绕过 CORS，支持 OpenAI/DeepSeek 等）
- [ ] `.epub` / `.docx` / `.pdf` 解析上传
- [ ] 自动按章节切分，逐章续写并保持长程一致性
- [ ] 故事「记忆」：先让模型对全文做大纲摘要，再基于摘要改写超长篇
- [ ] 多结局对比、版本管理
- [ ] 国际化（i18n）

---

## ⚠ 版权与使用须知

本工具仅供**个人阅读、学习与同人（二次）创作**。请尊重原作者的著作权：

- 不要将改写结果用于商业用途；
- 不要冒充原作者，或以可能造成混淆的方式传播；
- 上传的原文请确保你有合法获取与使用的权利。

由使用本工具产生的一切内容与后果，由使用者自行负责。

---

## License

[MIT](./LICENSE)
