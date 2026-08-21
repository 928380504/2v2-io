# 游戏网站模板 AI 修改规则

本规则适用于本目录及其所有子目录。

## 修改前必须阅读

1. `TEMPLATE-GUIDE.md`
2. `template/template.json`
3. 与任务直接相关的 `site/README.md`、`backend/README.md`、`site/overrides/README.md` 或 `template/README.md`

修改跑马灯、排行榜、个人战绩、竞赛指标、结算事件或竞赛适配器时，还必须完整阅读 `docs/COMPETITION-FEED-LEADERBOARD-SPEC.md`。

修改 D1、迁移、评论、评分、播放、点赞、踩、收藏、缓存、跑马灯、排行榜、快照、索引或任何服务端查询时，还必须完整阅读 `docs/DATABASE-ARCHITECTURE-OPTIMIZATION-SPEC.md`。禁止绕过其中的聚合表、快照、共享缓存、幂等、索引和消耗验收规则。

不得在未理解模板核心、站点包、组件覆盖层和保护区的情况下开始修改。

## 边界规则

- 通用能力放入模板核心。
- 单个网站的域名、文案、游戏数据、主题和功能差异放入 `site/`。
- 单站组件差异优先放入 `site/overrides/`，禁止绕过插槽直接分叉页面。
- `public/`、`functions/`、`migrations/` 和 `.env*` 属于站点保护区。
- 可复用服务端实现放入 `backend/`；`functions/api` 只保留稳定路由包装层。
- 社区能力放入 `backend/community`；对局、排行和战绩进入独立竞赛适配器。
- 已执行的 D1 历史迁移禁止回改，只能追加新迁移。
- 每个新网站必须使用独占的新 D1；首次创建使用 `npm run cloudflare:provision`，禁止用 raw `d1 execute` 绕过 Wrangler 追踪。
- 跑马灯、排行榜和游戏结算必须遵守跨游戏竞赛规范；游戏差异通过指标配置与竞赛适配器表达，禁止分叉通用 UI 契约。
- 禁止在组件中重复维护游戏数组、域名、路由或缓存命名空间。
- `site/content/game-catalog-data.ts` 中的 `game:add` 插入标记禁止删除；新增游戏优先使用生成器。
- 游戏属性、筛选选项和生成器参数必须先在 `site/game-filters.json` 声明，禁止重新写死在核心组件或脚本中。
- 面向非程序员的站点配置统一写入 `site/blueprint.json`；修改生成文件后必须运行 `npm run site:export -- --apply` 反向同步蓝图，禁止形成两个互相漂移的数据源。
- 本地可视化后台只能监听回环地址并使用临时令牌，禁止把管理 API、写文件能力或密钥配置暴露到公开 Next.js 路由和线上构建。
- 本地资源选择器只能读取 `public/` 内已有的受支持图片；没有明确来源与授权审查时，禁止增加自动上传、远程下载或跨站资源复制。

## 文档同步规则

- 架构、目录、配置、接口、数据流、缓存、部署或注意事项变化时，必须更新 `TEMPLATE-GUIDE.md` 对应章节。
- 所有有意义的修改必须写入 `CHANGELOG.md` 的 `Unreleased` 或当前发布版本。
- 模板发布版本、指南 frontmatter 和 Changelog 版本必须一致。
- 不能用 Changelog 代替当前说明，也不能只改指南而不记录变化。

## 修改后必做验证

```text
npm run docs:check
npm run backend:check
npm run competition:install:test
npm run filters:check
npm run game:add:test
npm run site:create:test
npm run site:export:test
npm run site:admin:test
npm run cloudflare:test
npm run template:fleet:test
npm run site:adopt-legacy:test
npm run functions:migrate:test
npm run validate-site
npm exec tsc -- --noEmit
npm run build
```

如果修改了模板核心，还必须：

```text
npm run template:release -- --version <next-version>
npm run template:verify
```

模板发布前不得忽略文档校验、站点校验、类型错误或构建失败。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
