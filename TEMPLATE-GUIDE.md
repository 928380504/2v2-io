---
template: browser-game-template
version: 2.26.2
documentation_revision: 54
last_verified: 2026-08-22
status: stable
---

# 游戏网站模板系统指南

本文档是模板当前架构、约定和操作方式的唯一总览。它同时服务于站点维护者和 AI：开始修改前先读本文，完成修改后同步更新受影响章节，并在 `CHANGELOG.md` 记录变化。

数据库表、迁移、社区基础数据、竞赛扩展数据、索引、缓存与 D1 消耗优化的完整稳定边界见 `docs/DATABASE-ARCHITECTURE-OPTIMIZATION-SPEC.md`。涉及服务端数据的修改必须同时遵守该文档；跑马灯和排行榜还必须遵守 `docs/COMPETITION-FEED-LEADERBOARD-SPEC.md`。

## 快速理解

这是一套面向浏览器游戏站的 Next.js 静态导出模板。静态页面负责游戏展示、SEO 和快速访问；Cloudflare Pages Functions 与 D1 负责评论、评分、互动、对局、跑马灯和排行榜等动态数据。

模板采用五层结构：

1. `components`、`app`、`lib` 等目录提供可升级的模板核心。
2. `site/manifest.json` 和 `site/content` 定义单个网站的身份与内容。
3. `site/overrides` 可以替换个别核心组件，优先级高于默认组件。
4. `site/generated` 保存远程广告配置和构建期评分等生成数据。
5. `backend` 提供可升级的通用社区服务与可替换竞赛适配器，`functions/api` 只保留稳定路由。

新增网站时复制模板，填写一份站点蓝图并用 `site:create` 生成完整站点包，再补齐清单中的授权资源即可。模板后续升级通过 SHA-256 发布清单同步核心，不覆盖站点保护区。

最常用的检查命令：

```text
npm run docs:check
npm run backend:check
npm run competition:examples:check
npm run competition:install:test
npm run filters:check
npm run game:add:test
npm run site:create:test
npm run site:export:test
npm run site:admin:test
npm run cloudflare:test
npm run template:fleet:test
npm run site:adopt-legacy:test
npm run site:extract-legacy:test
npm run functions:migrate:test
npm run validate-site
npm exec tsc -- --noEmit
npm run build
npm run template:verify
```

## 架构与优先级

配置和组件遵循以下优先级，右侧覆盖左侧：

```text
模板默认实现 → site 全局配置/内容 → site/overrides 自定义组件
```

- 模板核心负责通用布局、UI、数据客户端、静态路由引擎和构建工具。
- 站点包负责域名、品牌、主题、游戏目录、页面文案、功能开关和竞赛指标。
- 覆盖层只保存真正不同的组件，未配置的插槽继续使用模板默认实现。
- `backend/community` 提供跨站复用的评论、评分和互动；竞赛差异由 `backend/adapters` 隔离。
- Pages Functions 路由包装和 migrations 仍属于站点保护区，防止覆盖站点接口与数据库历史。

稳定入口位于 `config/`。许多文件只是转发到 `site/` 的兼容门面，核心组件应优先从 `@/config/...` 读取配置，站点包内部则直接使用 `@/site/...`。

## 目录结构

```text
app/                         Next.js 页面与动态静态路由
admin/                       只在本机运行的可视化站点配置界面
backend/                     可升级的服务端核心、社区模块和竞赛适配器
  core/                      D1、HTTP 等通用基础能力
  community/                 评论、评分、互动和卡片数据
  adapters/                  对局、战绩、跑马灯与排行榜适配器
components/                  通用 UI、游戏框、内容区和插槽注册表
  slots/                     插槽契约与默认组件注册表
config/                      核心数据模型、目录引擎和 site 兼容入口
hooks/                       评分、互动、卡片数据等客户端 Hooks
lib/                         API 客户端、缓存、通信桥和数据适配器
scripts/                     构建、校验、初始化、发布和同步工具
styles/                      全局样式常量
site/                        单个网站的完整站点包
  blueprint.json             后台与生成器共同使用的可编辑站点蓝图
  manifest.json              域名、身份、路由、功能和主题唯一来源
  game-filters.json          游戏属性、筛选组、选项与生成器参数唯一来源
  content/                   游戏数据和页面文案
  generated/                 构建前生成或远程获取的数据
  overrides/                 可选组件覆盖
  data-provider.ts           API、缓存、竞赛指标与展示措辞
  backend.ts                 D1 绑定名与竞赛适配器选择
  runtime.ts                 localStorage、事件和游戏通信命名空间
public/                      当前网站的 Logo、图标等静态资源
functions/                   稳定的 Cloudflare Pages Functions 路由包装
migrations/                  不可回改的当前网站 D1 数据库迁移历史
template/                    模板版本、核心边界和发布哈希
  sites.example.json         多网站目标清单示例
  sites.json                 本机目标清单，不进入模板发布包
  reports/                   最近一次批量升级的机器可读报告
out/                         静态导出与编译后的 Pages Worker
```

`.next`、`out`、`node_modules`、`.wrangler`、`backups` 和 TypeScript 构建缓存不属于源码。

## 页面与路由

页面由少量固定模板和可配置路由组成：

- `/`：首页展示主游戏、推荐游戏和主内容区；启用玩家榜时右侧展示竞赛排行榜，否则展示无需竞赛数据的 Popular/New 游戏榜。
- `/hot-games`：固定热门游戏页。
- `/{gameCategory}`：可改名的分类页，例如 `/1v1-lol-games`。
- `/{gameFilters}`：可改名的筛选页，例如 `/shooting-games`。
- `/{gameCategory}/{gameId}`：游戏内页，由游戏目录自动生成。
- `/about-us`、`/contact-us`、`/terms-of-service`、`/privacy-policy`、`/dmca`：统一法律信息页。

`app/[collectionSlug]` 同时承载分类页、筛选页和旧标签入口；`app/[collectionSlug]/[gameId]` 根据目录生成游戏内页。公开路径必须在 `site/manifest.json` 中保持唯一、使用一个小写路径段。

首页主游戏与对应游戏内页通过 `getGamePageContext(primaryGameId)` 读取同一条权威游戏记录、分类、游玩地址和相关推荐。首页不得另建一份主游戏数据；它只负责自由组合首页专属的封面文案、排行榜、侧栏、视频、FAQ 和正文。标准游戏内页继续展示完整资料，因此两种页面可以共享游戏框、互动、评论、评分、对局桥和目录字段，而不必复制数据或业务逻辑。

首页与游戏内页的桌面内容侧栏统一复用 `SquareGameRecommendations`：右侧目录下方最多展示 4 个相关推荐，左侧竖向广告下方最多展示 2 个，并自动排除当前游戏、排行排除项及左右重复项。`1440px` 以下隐藏方形推荐，`1440px` 起统一使用两列小卡片，移动端随侧栏隐藏。卡片默认显示向左上外伸的 Hot、New 或 Top 单一立体角标，悬停或键盘聚焦后角标淡出，底部渐变与游戏名进入。角标读取全站统一排名快照，不得根据当前组件收到的局部游戏列表重新编号，也不得再用评分或 `isHot` 单独判断。

修改路径时不要直接改组件中的链接。先修改 manifest，再运行 `npm run validate-site`，由校验器检查导航与路由引用。

## 站点配置

`site/blueprint.json` 是人工配置和未来可视化后台的统一编辑入口；`site:create` 由它生成运行时文件。`site/manifest.json` 是应用运行时读取的全局配置来源，主要字段包括：

- `site`：ID、名称、域名、URL、语言、邮箱、时区、主游戏和主分类。
- `site.assets`：游戏资源域名、Logo、导航 Logo 和 favicon。
- `site.seo`：首页标题、描述、关键词和社交账号。
- `site.navigation`、`site.footer`：导航入口与页脚推荐游戏。
- `routes`：全部公开路径。
- `features`：跑马灯、排行、评论、评分、互动、广告等功能开关。
- `theme`：默认明暗模式、布局宽度、主色和反馈组件颜色。

`site/game-filters.json` 是游戏属性架构唯一来源。每个筛选组定义页面标签、图标、目录字段、`game:add` 参数名、是否多选、默认值和可选项；`icon` 会映射到 `GameFilterGroupIcon` 内置的彩色卡通 SVG，默认提供 players、controls、loading、pvp 和 perspective 五类，未知值回退为手柄图标。`primaryMatchGroup` 决定 Similar Games 与排行卡片优先展示和匹配哪一组属性。新站可以把五组射击属性整体替换为跑酷距离、益智难度或文字游戏类型；新增图标语义时扩展统一图标映射，不要在页面里散落图片地址。

`site/site.ts`、`site/routes.ts`、`site/features.ts` 和 `site/theme.ts` 读取 manifest，不应再次写死同一信息。Sitemap 也直接读取 manifest 的域名和旧路径。

纯模板默认关闭 `activityFeed`、`leaderboard` 和 `matchEvents`，因此没有 D1、对局桥或玩家数据时也能直接使用。首页仍保持 80/20 游戏区，原玩家榜位置自动显示 Popular/New 游戏排行；站点接入竞赛数据库后再在蓝图中开启这三个功能。Popular 的全站热度统一为 `播放量 × 1 + 点赞 × 5 + 收藏 × 50`；三项接口数据完整时使用真实统计，否则整批回退到游戏目录初始值，禁止把局部实时值与其他游戏的初始值混排。并列时依次比较收藏、点赞、播放、`siteAddedAt` 和游戏 ID。New 始终按站内上架时间 `siteAddedAt` 排序，不使用游戏原始发行时间。

全站参与排行的游戏少于 30 个时，方形卡片角标范围为 TOP 1–3、HOT 4–8、NEW 最近 5 个；达到 30 个后改为 TOP 1–5、HOT 6–15、NEW 最近 10 个。NEW 还必须处于上架后 45 天内。每张卡片只显示一个角标，优先级固定为 `TOP > NEW > HOT`。`/hot-games`、分类页、筛选页、相关游戏榜 Popular、方形卡片角标以及其他热度入口必须共享 `useGlobalGameRankings` 产生的全站名次；筛选只改变可见集合，不能改变游戏的全站名次。

`/hot-games` 的展示数量由模板核心统一固定为全站热度前 21 名。每个未进入排行排除项的新增游戏都会自动参与同一热度排序；达到前 21 名时自动进入页面，跌出前 21 名时自动移出。站点蓝图和本地可视化后台不提供单站数量上限，旧蓝图中的 `hotGames.limit` 会在重新生成时被忽略。旧站提取器也不得按迁移当时的游戏数量固化上限。

页面主体内容统一使用 `.site-container-width`：跑马灯、首页、游戏内页、分类页、热门页、标签筛选页和法律信息页均从同一个容器宽度规则读取。模板默认使用 `clamp(960px, 70vw, 1574px)`，并保留至少 16px 的左右视口安全边距；站点通过既有 `theme.layout.gameBaseMaxWidth`、`gameDesktopWidth` 和 `gameDesktopMaxWidth` 三个字段覆盖主体容器的基础上限、桌面比例与桌面上限。导航栏保持全宽，主页脚继续使用独立的 Tailwind `container`，友情链接保留 1200px 独立上限，不跟随主体容器。旧 `.game-layout-width`、`.site-list-width` 和对应 CSS 变量只作为迁移兼容别名保留，新主体组件不得继续使用。默认 80/20 游戏分栏在 1200px 桌面断点下至少获得约 192px 的右栏，同时其他主体页面与游戏交互区保持左右边界一致。

主页脚的 Games、Company、Legal 三列保持等宽。每组标题与链接组成一个整体居中的内容块，块内标题和链接全部左对齐并共享同一条左侧基线。不得通过单列额外水平内边距制造视觉偏移，移动端单列沿用同一规则。

游戏榜与玩家榜的标题区只保留 `Top games` 或 `Top players` 单一语义标题。不要再叠加 `Game Rankings`、`Arena Legends` 等重复副标题；右上角入口或刷新按钮以及 Popular/New、Daily/All-time 切换仍须保留，从而把有限高度优先留给榜单条目。两类标题分别使用清晰可辨的彩色火焰和彩色奖杯，标题沿用原 `Arena Legends` 的 16px 粗体规格，图标按比例使用 20px；标题统一采用日间黑色、暗夜白色。

Tailwind 的内容扫描必须包含 `site/`。站点主题中的标签颜色由 `site/theme.ts` 提供；如果新增承载 Tailwind 完整类名的站点配置文件，也必须保持在现有 `site/**/*` 扫描范围内，避免文字颜色存在但胶囊背景类未生成。

完整新站生成（默认读取 `site/blueprint.json` 且只预览）：

```text
npm run site:create
npm run site:create -- --apply
npm run site:create -- --from examples/site-blueprint.example.json
npm run site:create -- --from path/to/site-blueprint.json --apply
```

蓝图统一描述站点身份、域名、主题、功能开关、路由、主分类、筛选架构、首页、热门页、完整法律文案、初始游戏目录与内页正文、排行排除项、竞赛适配器和 Cloudflare 目标。生成器会重建对应的站点运行文件、保留已有评分快照，并生成 `site/generated/resource-checklist.json`；它不会下载或伪造 Logo、封面、游戏包等可能受版权约束的资源。

`site:create` 默认只展示变更文件和缺失资源。增加 `--apply` 后，它会先在 `backups/site-create/` 逐文件备份，再写入并执行站点、筛选、后端和 TypeScript 校验；TypeScript 校验前会清除 `.next`、`out/types` 与 `tsconfig.tsbuildinfo` 这三类可再生缓存，再运行 Next.js `typegen`，确保校验只使用当前路由而不是框架升级或重构前的类型和增量图。任一校验失败会恢复所有旧文件并删除本次新增文件，同时保留具体的类型生成或 TypeScript 错误。缺失本地资源时禁止应用，但允许预览。命令不连接远程 D1、不执行 SQL、不部署，也不覆盖 `public/`、`functions/`、远程广告配置或站点组件覆盖；若选择了未安装的内置竞赛适配器，只会像 `competition:install` 一样追加受版本管理的新编号迁移及其分组，绝不回改已有迁移。

现有站点也可以反向生成后台蓝图：

```text
npm run site:export
npm run site:export -- --apply
```

第一条只比较当前运行文件与蓝图；第二条先备份旧蓝图，再把当前站点内容反向写入 `site/blueprint.json`。因此日常应优先编辑蓝图并运行 `site:create -- --apply`；如果临时直接修改了 `site/content`、manifest、筛选或 Legal 文件，则必须使用 `site:export -- --apply` 收回这些变化。`site:export:test` 会验证“蓝图 → 运行文件 → 蓝图”完全一致，防止可视化后台上线后覆盖手工内容。

不熟悉 JSON 时可以启动本地可视化后台：

```text
npm run site:admin
```

命令会在本机打开 Local Site Studio。当前表单覆盖站点身份、资源地址、SEO、路由、主分类、主题、功能开关、首页长文、视频、FAQ、热门页、筛选页文案、游戏目录、游戏属性、筛选架构、五个 Legal 页面、About Us、Cloudflare Pages、D1、竞赛适配器和排行排除项。图片字段会即时预览；只读资源选择器仅列出当前 `public/` 中已有的 PNG、JPEG、WebP、GIF、AVIF 和 ICO。首页长文与游戏内页正文既可继续编辑原始 HTML，也可在显式打开的分区编辑器中调整标题、正文和顺序。尚未专门表单化的低频字段仍可在 Advanced JSON 中编辑。所有表单都直接维护同一份蓝图，不会另建数据库或第二套配置。

后台只监听 `127.0.0.1`，每次启动生成临时访问令牌，不会进入 Next.js 公开路由或生产构建。资源浏览接口同样要求临时令牌，图片预览只能解析到 `public/` 内受支持的现有图片，跳过符号链接且拒绝目录穿越。当前版本不提供上传、下载或资源复制，避免绕过来源和授权审查。保存必须先预览生成文件、确认本地资源齐全并输入站点 ID；随后才会建立 `backups/site-admin/` 备份、写入、运行站点/筛选/后端/TypeScript 校验，失败时自动回滚。页面刷新或关闭前会提醒尚未保存的修改；后台停止后临时令牌立即失效。

旧的 `site:init` 暂时保留为兼容入口，只适用于维护旧自动化中的 manifest 单文件初始化；新站一律优先使用 `site:create`。

## 游戏数据

每个游戏只在 `site/content/game-catalog-data.ts` 建立一次权威记录。常用字段包括：

- `categoryId`、`title`、`image`、`description`
- `plays`、`rating`、`ratingCount`、`favorites`、`likes`
- `gameAttributes`：按 `site/game-filters.json` 声明的站点游戏属性
- `developer`、`technology`、`platforms`、`siteAddedAt`
- `detail.playUrl`、封面、SEO 描述、正文和 YouTube 信息
- `matchBridge`：是否接收游戏 iframe 的档案与对局事件

增加游戏后，目录引擎会自动为卡片、筛选、内页元数据、静态路径和推荐区域提供数据。不要在组件中再维护一份游戏数组。

新增游戏的标准流程：

1. 使用 `game:add` 生成并预览权威游戏记录。
2. 确认分类、属性、SEO、Logo、封面和游玩地址。
3. 增加 `--apply` 写入；工具会先备份，写入后校验，失败自动恢复。
4. 需要推荐时，在首页、页脚或分类配置中引用该 ID。
5. 细化自动生成的介绍正文，并运行完整构建。

单个游戏预览和写入：

```text
npm run game:add -- --id space-arena --title "Space Arena" --description "A useful English description containing at least forty characters."
npm run game:add -- --id space-arena --title "Space Arena" --description "A useful English description containing at least forty characters." --apply
```

批量导入：

```text
npm run game:add -- --from examples/game-import.example.json
npm run game:add -- --from path/to/games.json --apply
```

批量文件可以是数组，也可以使用 `{ "games": [...] }`。单批最多 100 个游戏，ID 在批次内部和现有目录中都必须唯一。参数支持分类、资源路径、开发者、技术、平台、标签、站点游戏属性、上线日期、YouTube 和对局桥开关。属性参数名来自每组的 `generatorKey`；没有手写标签时，生成器会使用主匹配组的标签。相对资源路径自动使用站点游戏资源域名；绝对 URL 和 `/` 开头的本地路径保持不变。

修改属性架构后先运行 `npm run filters:check`。它会同时检查配置中的重复键、无效默认值和别名，以及游戏目录中未知、缺失或类型不匹配的属性；筛选页面、URL 查询、Similar Games 和 `game:add` 会自动使用同一份配置。

生成器只写 `site/content/game-catalog-data.ts`，不会伪造播放、点赞、收藏或真实评分。新游戏以 `plays: 0` 开始，公开评分继续使用全局 50 票、5 星基础权重。`game:add` 插入标记属于结构契约，不能删除。

评分公开值采用 50 票、5 星的基础权重，真实评论评分在此基础上叠加。SEO 结构化评分与可见评分应使用同一评分数据源。

首页与对应主游戏内页复用 `GameStructuredData`。内页默认使用游戏详情 URL；首页显式传入根页面 URL，并在首页 `WebPage.mainEntity` 中关联同页的 `#game` 实体。两页都使用同一游戏 ID、构建期评分快照和客户端评分缓存，但各自保留正确的页面 URL 与实体 ID。首页必须继续显示该聚合评分，不能只在 JSON-LD 中提供不可见数据。

## 组件插槽

`components/slots/contracts.ts` 定义可覆盖组件的属性契约；`components/slots/index.ts` 组合默认组件与站点覆盖项。

当前插槽：

- `Navbar`
- `ActivityFeed`
- `Footer`
- `FeedbackWidget`
- `GamePlayer`
- `Leaderboard`
- `RelatedGames`
- `GameRankingPanel`
- `GameArticle`
- `FriendLinks`

站点自定义只编辑 `site/overrides/components.ts`：

```tsx
import type { SiteComponentOverrides } from "@/components/slots/contracts";
import { CustomNavbar } from "@/site/overrides/CustomNavbar";

export const SITE_COMPONENT_OVERRIDES = {
  Navbar: CustomNavbar,
} satisfies SiteComponentOverrides;
```

自定义组件必须接受默认组件兼容的 props。不要直接修改页面导入来绕过插槽，否则模板同步无法保护这项差异。

## 动态数据与缓存

前端动态数据统一通过 `lib/data/game-data-client.ts` 和 `site/data-provider.ts`，UI 不直接拼接后端地址。

当前数据包括：

- 游戏播放、点赞、踩、收藏
- 评论、回复、评论排序和评论反应
- 评分汇总与构建期评分快照
- 对局批量上传、个人档案、跑马灯
- 日榜、总榜、个人排名窗口和主动实时刷新

浏览器缓存键、跨组件事件名和 iframe 通信标识由 `site/runtime.ts` 根据站点 ID 生成，避免多个站点共用旧的 `1v1lol` 命名空间。

当前默认缓存策略以 `site/data-provider.ts` 为准：评分、卡片、互动和跑马灯一般缓存 15 分钟；日榜快照 3 小时；总榜快照 24 小时。排行榜主动刷新仍由服务端冷却和每日上限控制。

公共日榜与总榜同时使用两层服务端优化。D1 排名快照负责避免每位访客重新执行完整排名计算；Cloudflare `caches.default` 负责在同一边缘节点共享公共榜单响应，缓存键只包含规范化后的周期、日期、页数和偏移量，不包含任意查询参数。个人排名窗口与主动实时刷新不进入公共缓存，防止不同玩家互相复用私有状态。普通快照读取必须将当前范围和最后一名写成可分别使用 `(snapshot_id, rank)` 索引的查询分支，禁止用一个 `OR` 让 SQLite 扫描该快照的全部排名行。

缓存设计原则：

- 首屏优先展示可用的本地缓存，再后台更新。
- 公共榜单使用 Cache API 的真实边缘共享缓存；仅设置 `Cache-Control` 响应头不能替代服务端 `cache.match` / `cache.put`。
- 同一批游戏数据合并请求，避免每张卡片单独查询；全站游戏卡片统计超过接口单批上限时自动按 50 个拆批，并继续合并为同一份排名快照。
- 未互动的用户不产生写入。
- 服务端数据失败时保留旧快照，不清空可见内容。
- 改缓存键时要考虑旧访客数据迁移，不能随意重命名。

## Pages Functions 与 D1

静态导出并不代表没有服务端请求。`functions/` 会编译为 `out/_worker.js`，排行榜、评论、评分、互动和对局上传都会经过 Cloudflare Workers 运行时并读写 D1。

服务端现在分为四层：

1. `functions/api` 保持现有 `/api/*` 地址，只转发请求，不包含 SQL 和业务实现。
2. `backend/core` 提供 D1 绑定、HTTP 响应和错误处理。
3. `backend/community` 提供评论、评分、评论反应、播放、点赞、踩和收藏。
4. `backend/adapters/1v1-lol` 提供当前游戏的对局、战绩、快照、奖牌和跑马灯。

`site/backend.ts` 是单站入口，当前选择 D1 绑定 `DB` 和 `1v1-lol` 适配器。未来的文字积分、跑酷距离或其他竞赛模型应新增适配器，不应修改 1v1 适配器来兼容无关指标。模板核心当前内置 `1v1-lol` 与 `word-score` 两种实现，站点通过保护区配置选择其一。

当前 1v1 适配器包含：

- 游戏 ID 与 `mode_key = 1v1`
- 胜局、击杀、死亡、连胜等字段
- 昨日前三、日榜和总榜快照
- LIVE、STREAK、ARENA 跑马灯事件

`examples/competition-adapters/text-twist-2-untimed` 提供第二种可复制的
文字积分制样例。它沿用稳定 `/api/*` 路由和 iframe 消息桥，但把竞赛指标
改为 `bestScore`：日榜与总榜均取每个档案的单局最高分，平分时依次比较
完成轮次、找到单词数、Bingo 数、最长词和更早达成时间。Untimed 模式不
使用游玩时长排序，也不上传猜词内容或题库文本。

该目录是默认不启用的参考实现，包含事件校验、完整端点处理、D1 表结构、
数据展示配置和游戏侧桥接示例。参考页面是跨域 Canvas 构建，未核验到公开
分数接口，因此只有可控或获授权的游戏构建才能通过显式消息可靠上报分数。

竞赛适配器使用包清单和安全安装器启用：

```text
npm run competition:install -- --list
npm run competition:install -- --adapter word-score
npm run competition:install -- --adapter word-score --apply
```

默认只预览。写入时只改变 `site` 配置并向受保护 `migrations` 追加下一个
未使用编号；替换前备份，后端、站点或 TypeScript 校验失败时自动恢复。安装
器不会连接远程 D1、执行 SQL 或部署网站。适配器实现继续作为模板核心升级，
站点选择和迁移历史不会被模板同步覆盖。

客户端上报的积分只能视作社区娱乐排行。如果存在奖金、奖品或高对抗作弊
风险，必须额外接入可信签名或服务端可验证的计分来源，不能把本样例当作
反作弊系统。

所有竞赛适配器和相关 UI 还必须遵守
`docs/COMPETITION-FEED-LEADERBOARD-SPEC.md`。该规范固定了跨游戏接口、
首访与错误回退、事件分层、跑马灯内容比例、最多两种正文强调色、个人
排名窗口、时区、领奖台、缓存、主动刷新和数据库性能边界。胜局、积分、
距离、生存时间或速通只替换指标配置与适配器排序，不能分叉通用组件行为。

`backend/` 已进入模板核心，可以随模板升级；`functions/` 只保留稳定包装层并继续受保护。已有站点第一次采用 2.2.0 时需要人工确认其 API 路由已经换成包装层，此后通用服务端修复只需同步 `backend/`。

D1 历史文件不移动、不改名、不回改。新站使用受保护的 `site/competition-migrations.json` 将它们逻辑划分为 `community` 和适配器组；旧站在尚未生成该文件时继续兼容 `backend/migrations.json`。`npm run migrations:list` 会把站点所需两组重新按全局编号排序。新增迁移仍在 `migrations/` 追加新编号，并加入且只加入一个分组。部署前先核对目标数据库和 `site/backend.ts` 中的绑定名。

`site/cloudflare.json` 是单站 Cloudflare 部署清单，保存 Pages 项目名、生产域名、分支、D1 绑定名、数据库名称/ID、首选位置和健康检查列表，不保存 API Token。每个生成的网站必须新建并独占一套 D1，禁止复用其他网站的数据库，也不提供旧数据库接管分支。`cloudflare:provision` 默认只预览；确认后通过 Wrangler 创建新库，把 UUID 备份并原子写回该文件。数据库 ID 配置完成后，Wrangler 从 `0001` 开始建立本站结构，并记录以后模板版本追加的结构升级。

D1 位置可以留空让 Cloudflare 自动放置，也可以设置为 `weur`、`eeur`、`apac`、`oc`、`wnam` 或 `enam`。当前示例面向美国东部用户，默认使用 `enam`；复制到面向其他地区的网站时应在站点蓝图中调整，而不是修改部署脚本。

竞赛样例的结构校验使用：

```text
npm run competition:examples:check
```

## 构建与部署

当前部署目标是 Next.js Static HTML Export + Cloudflare Pages：

```text
npm run build
```

Cloudflare 部署向导：

```text
npm run cloudflare:check
npm run cloudflare:provision
npm run cloudflare:provision -- --apply --confirm <site/database/create>
npm run cloudflare:prepare
npm run cloudflare:migrations -- --remote
npm run cloudflare:migrations -- --remote --apply --confirm <site/database>
npm run cloudflare:deploy
npm run cloudflare:deploy -- --apply --confirm <site/project>
npm run cloudflare:health -- --url https://preview.pages.dev
```

`cloudflare:check` 完全只读，检查域名、绑定、构建产物、当前竞赛适配器和迁移哈希。`cloudflare:provision` 的预览不会联网写入；应用时必须提供 `<site/database/create>` 精确令牌，并拒绝覆盖已有数据库 ID。Wrangler 创建成功后，原配置先备份到 `backups/cloudflare-provision/`，再写回 UUID。

`cloudflare:prepare -- --apply` 只在忽略的 `.wrangler/cloudflare-deploy/` 中生成临时 Wrangler 配置，并仅复制 `community + 当前适配器` 的迁移。临时配置同时声明 `pages_build_output_dir` 和 D1 绑定；`cloudflare:deploy` 从该目录执行，因此绑定会随 Pages 部署生效，不需要再在控制台重复添加。远程迁移和 Pages 发布仍必须分别提供 `--apply` 与审计输出的精确确认令牌。每个网站的新数据库使用 Wrangler 原生 `d1_migrations` 追踪，单条失败由 Cloudflare 事务回滚；禁止使用 raw `d1 execute` 绕过追踪。

新站首次上线顺序固定为：

1. `cloudflare:check` 核对项目名、数据库名、位置和绑定。
2. `cloudflare:provision` 创建新库并写回 ID。
3. `cloudflare:migrations -- --remote` 预览，再确认应用全部本站结构。
4. 完整构建后使用 `cloudflare:deploy`；Pages 从临时配置取得 D1 绑定。
5. 使用 `cloudflare:health` 验证页面、绑定和三类真实数据接口。

远程命令要求 Wrangler 已登录；在 CI 或非交互环境中通过环境变量提供 `CLOUDFLARE_API_TOKEN`。令牌只能进入本机环境或部署平台的加密变量，禁止写入 `site/cloudflare.json`、`.env` 示例、日志或提交记录。

部署后 `cloudflare:health` 只发送 GET 请求，依次验证首页、`/api/health` D1 绑定、评分表、日榜表和跑马灯表。仅首页 200 不代表动态功能可用；五项全部通过才算部署完成。

构建流程：

1. `docs:check` 检查指南、版本和更新记录。
2. `backend:check` 检查 API 包装、模块边界、适配器选择和迁移分组。
3. `filters:check` 检查站点属性架构及全部游戏属性。
4. `game:add:test` 检查单条/批量生成、动态属性、重复保护、备份和回滚。
5. `site:create:test` 检查完整站点包生成、资源清单、竞赛迁移、幂等和回滚。
6. `site:export:test` 检查现有站点反向导出、内容保真、备份和生成—导出无损往返。
7. `site:admin:test` 检查本地后台资源、临时令牌、只读预览、来源限制和保存确认保护。
8. `cloudflare:test` 检查部署清单、迁移筛选、临时工作区和只读健康探针。
9. `template:fleet:test` 检查多站清单、同步结果解析与汇总逻辑。
10. `site:adopt-legacy:test` 检查旧站域名识别、路由盘点、差异审计和阻断条件。
11. `site:extract-legacy:test` 检查旧目录静态解析、首页主游戏补全、伪造指标丢弃和只读保证。
12. `functions:migrate:test` 检查受保护接口差异、升级前置条件、备份和失败恢复。
13. `validate-site` 检查站点清单、路由、游戏引用和资源。
14. `fetch-config` 获取远程广告、分析和友情链接配置；没有远程变量时保留旧生成文件。
15. `fetch-ratings` 按游戏 ID 批量更新评分构建快照；失败时保留旧快照。
16. `next build` 生成静态页面。
17. `structured-data:check` 验证首页与主游戏内页共享评分来源，同时分别使用正确页面 URL，并检查首页 `WebPage.mainEntity` 关联。
18. `next-sitemap` 生成 Sitemap 和 robots.txt。
19. `build:functions` 编译 Pages Functions 到 `out/_worker.js`。

部署前至少确认：

- 文档和站点校验通过。
- TypeScript 无错误。
- 35 类似的路由数量变化符合预期。
- 主游戏和新增内页能够实际打开。
- Pages Functions 构建成功。
- D1 迁移已经在正确环境执行。

## 模板版本与多站同步

`template/template.json` 定义模板 ID、语义版本、核心路径、保护路径和忽略路径。`template/release-manifest.json` 保存每个核心文件的 SHA-256。

发布新版本：

```text
npm run template:release -- --version 2.22.6
npm run template:verify
```

发布前必须先把本文档和 `CHANGELOG.md` 更新到目标版本，否则文档校验会失败。

首次接管已有网站：

```text
npm run template:sync -- --target "H:\path\to\game-site" --adopt
npm run template:sync -- --target "H:\path\to\game-site" --adopt --apply
```

如果旧网站还没有 `site/manifest.json`，按站点包是否已经准备好选择以下流程。

### 从 stimulation-clicker 旧站提取蓝图

旧站还没有准备好的 `site` 包时，先把其静态内容提取为新模板蓝图：

```text
npm run site:extract-legacy -- --target "H:\path\to\legacy-site"
npm run site:extract-legacy -- --target "H:\path\to\legacy-site" --output "template\reports\site.blueprint.json" --report "template\reports\site.extraction.json"
npm run site:create -- --from "template\reports\site.blueprint.json"
```

第一条命令永远只读，只输出摘要。只有显式传入 `--output` 或 `--report` 才会在指定位置写预览文件；提取器不会修改旧站、复制资源、下载图片、执行 SQL 或部署。它读取旧站身份、单一分类、游戏目录、内页正文、首页游戏地址、YouTube、静态 FAQ，以及旧版封面组件中的首页背景图和 Logo；旧站中随机生成或无法核实的播放量和评分会重置为零。首页主游戏没有列入旧目录时会自动生成主游戏记录。

当前自动提取范围是 `stimulation-clicker`、恰好一个分类且不超过 100 款游戏。游戏属性通过标题和描述自动推断，属于可直接迁移、迁移后再按实际游玩修正的默认结果，不单独形成 warning。资源只生成缺失清单，迁移前仍须处理文案、授权资源、竞赛适配器和报告中的其他 warning。`site:create` 首次仅做预览，补齐清单后才可另行确认 `--apply`。

已有完整且域名匹配的 `site` 包时，不需要提取，直接使用旧站接管向导：

```text
npm run site:adopt-legacy -- --target "H:\path\to\legacy-site"
npm run site:adopt-legacy -- --target "H:\path\to\legacy-site" --apply
```

第一条命令只读审计旧站，推断域名、盘点旧路由和配置、核对站点包身份，并比较受保护的 Pages Functions。报告保存到 `template/reports/legacy-adoption-latest.json`。域名不一致、存在残缺 `site` 目录或已有发布基线时会阻止写入。

第二条命令只做两件事：把已核对的 `site` 站点包作为受保护配置加入旧站，并把当前旧核心记录为 `0.0.0-adopted` 基线。它不会立即替换旧页面、组件、公共资源、Functions、迁移或环境变量。完成后仍需运行 `template:fleet` 预览真正的核心升级，再单独确认 `--apply`。

迁移其他域名时必须先准备对应站点包，并使用 `--site-package` 指定；工具拒绝把一个网站的站点包写入另一个域名。写入阶段会在 `backups/template-adoption` 保存接管计划；建立基线失败时会自动移除本次新增的站点包。

同步更新：

```text
npm run template:sync -- --target "H:\path\to\game-site"
npm run template:sync -- --target "H:\path\to\game-site" --apply
```

预览不会写入。应用前会备份被更新或删除的核心文件。网站本地修改过的核心文件会成为冲突并停止更新；应优先把差异迁入 `site` 或组件覆盖层，而不是使用 `--force-conflicts`。

多网站管理使用本机清单 `template/sites.json`。首次使用时复制 `template/sites.example.json`，为每个网站设置唯一 ID、名称、本机绝对或相对路径和启用状态。该文件以及 `template/reports/` 都不会进入模板发布包，也不会同步到网站。

批量预览：

```text
npm run template:fleet
npm run template:fleet -- --site 1v1-lol,temple-run
```

批量应用：

```text
npm run template:fleet -- --apply
```

默认永远是预览；只有 `--apply` 会写入。工具逐站调用同一套 `template:sync` 逻辑，因此每个网站仍独立判断版本、更新、删除和本地冲突，并在自身 `backups/template-upgrade` 下备份。单站失败会记录在汇总中，但不会阻止其他站点完成检查。最近一次结构化报告保存到 `template/reports/latest.json`；使用 `--details` 可查看每站完整计划，使用 `--no-report` 可跳过报告文件。

尚未建立发布基线的网站先单独采用：

```text
npm run template:fleet -- --site new-site --adopt --apply
```

`--force-conflicts` 和 `--force-adopt` 仍属于人工复核后的高风险选项，不应在日常批量更新中使用。

模板发布清单和同步器对常见源代码、配置及文档文本统一按 LF 计算 SHA-256，因此 Windows Git 将工作区检出为 CRLF 时不会产生虚假核心冲突。二进制文件始终按原始字节计算哈希，任何真实资源变化仍会被识别。文本内容本身发生变化时仍属于真实冲突，不得仅因换行符兼容而跳过审查。

同步器执行三方判断：模板自上次基线后未修改、但目标站本地修改的核心文件归入 `Preserved local` 并原样保留，不阻塞其他更新；目标站保持旧基线而模板已修改的文件自动更新；只有模板和目标站同时修改同一文件才归入 `Local conflicts`。同步报告必须分别展示自动更新、保留本地版本和真实冲突数量。

旧站接管与核心升级完成后，受保护的 Pages Functions 不会被模板同步自动覆盖。使用独立迁移向导审计并迁移包装层：

```text
npm run functions:migrate -- --target "H:\path\to\game-site"
npm run functions:migrate -- --target "H:\path\to\game-site" --apply
```

向导逐文件列出新增、替换、相同和目标站独有的 Functions，并把公开文件路径转换为 API 路由清单。只有目标站已经具备 `backend/runtime.ts`、`backend/migrations.json`、`site/backend.ts`、后端校验器和模板定义时才允许应用，避免包装层提前引用尚不存在的模块。

应用时，每个待替换文件会备份到 `backups/functions-migration`；目标站独有 Functions 保留，D1 migrations、公共资源和环境文件保持不变。复制后自动执行目标站后端校验，失败则恢复全部替换文件并移除本次新增文件。审计报告保存在 `template/reports/functions-migration-latest.json`，完成后必须在目标站运行完整生产构建。

## 保护区

模板同步永远不自动覆盖：

- `site/`：网站身份、内容、生成配置和组件覆盖。
- `public/`：当前网站的 Logo、图片和其他静态资源。
- `functions/`：当前网站的服务端契约。
- `migrations/`：当前网站的 D1 历史与结构。
- `.env*`：密钥、远程配置和环境变量。

构建产物和依赖目录会被忽略，不参与版本同步。所有删除动作只针对上一版发布清单中记录、且用户未本地修改的核心文件，并在删除前备份。

## AI 修改协议

AI 或自动化工具修改本模板时必须遵循：

### 修改前

1. 阅读根目录 `AGENTS.md`、本文档和 `template/template.json`。
2. 确认本次任务修改的是模板目录、具体网站还是游戏构建包。
3. 检查工作区已有改动，禁止覆盖不相关的用户文件。
4. 判断修改属于核心、站点内容、组件覆盖、Functions 还是迁移。

### 修改中

1. 通用能力进入核心；单站差异进入 `site`；组件差异优先进入 `site/overrides`。
2. 不在组件、页面和脚本中重复写域名、路径或游戏数组。
3. 不修改已经执行过的 D1 历史迁移。
4. 不删除或覆盖模板保护区。
5. 新增配置时同步增加校验规则或合理默认值。

### 修改后

1. 如果当前架构、配置、流程或注意事项变化，更新本文相应章节。
2. 所有有意义的代码、配置和文档变化都写入 `CHANGELOG.md` 的 `Unreleased` 或目标版本。
3. 依次运行 `docs:check`、`filters:check`、`site:create:test`、`site:export:test`、`site:admin:test`、`template:fleet:test`、`site:adopt-legacy:test`、`site:extract-legacy:test`、`functions:migrate:test`、`validate-site`、TypeScript 检查和完整构建。
4. 核心发生变化时生成新模板发布清单并运行 `template:verify`。
5. 向用户明确说明修改目录、验证结果和仍受保护或待拆分的部分。

## 常见问题

### 为什么静态网站仍消耗 Workers？

静态 HTML 本身由 Pages/CDN 提供，但 `/api/*` 由 Pages Functions 处理；任何动态读取和写入都会产生 Worker 请求及 D1 行读取或写入。

### 为什么不能直接复制一个组件再修改？

复制会造成多份逻辑逐渐分叉。通用变化应改默认组件；单站视觉差异应使用组件插槽覆盖。

### 为什么游戏内页不需要一个文件一个文件创建？

动态静态路由会从权威游戏目录生成页面。`game:add` 新增一条游戏数据即可生成路径、SEO、卡片和筛选信息；批量 JSON 可以一次生成多条。

### 换成其他游戏类型时需要改筛选组件吗？

不需要。修改站点保护区中的 `site/game-filters.json`，再按新属性更新游戏目录即可。筛选页、URL 查询、相似游戏匹配、排行标签和生成器都会读取同一架构；`primaryMatchGroup` 用于指定最能代表“强相关”的属性组。

### 为什么评分脚本失败后仍能构建？

为了避免外部 API 短暂故障阻塞部署，脚本会保留已有评分快照；日志会明确说明是否更新或回退。

### 为什么 Functions 仍不直接随模板更新？

`functions/api` 是站点公开接口的包装层，继续受保护以避免覆盖特殊路由。可升级实现已经迁入模板核心 `backend/`；包装层确认接入一次后，后续逻辑更新无需重复修改 Functions。

### 什么时候需要提升模板版本？

新增兼容能力使用次版本，例如 `2.1.0`；修复兼容问题使用补丁版本，例如 `2.1.1`；破坏配置、接口或覆盖契约时提升主版本。

### 批量更新会不会因为一个网站冲突而覆盖其他网站？

不会。每个网站独立运行单站同步器：预览只生成报告，应用时各自建立备份；存在本地核心冲突的网站会停止写入并标记失败，其他网站继续处理。保护区始终不会进入同步计划。

### 为什么旧站接管不直接完成全部升级？

接管与升级被刻意拆成两次确认。第一次只补齐站点身份并记录旧核心基线；第二次才展示每个新增、更新、删除和冲突文件。这样可以在旧页面被替换前检查完整计划，也能把受保护的 Functions 和 D1 迁移留给单独审查。

### Functions 迁移为什么必须放在核心升级之后？

新的 `functions/api` 只负责把请求转交给 `backend/community` 或竞赛适配器。若目标站还没有新版 `backend` 和 `site/backend.ts`，提前替换会导致接口无法编译。迁移向导会检测这些前置条件并在写入前阻断。

## 当前限制与下一步

当前模板已经完成站点包、动态路由、统一游戏目录、站点级可配置属性架构、数据客户端、组件插槽、站点校验、旧站分阶段接管、受保护 Functions 迁移、安全单站与多站版本同步、后端适配器拆分、可无损往返的完整站点蓝图、带事务回滚的单条/批量游戏生成器，以及覆盖主要站点配置的本机可视化后台。

模板现在还包含两种竞赛模型和安全适配器安装器：安装器可以自动选择指标、更新站点展示配置、分配不可变 D1 迁移编号，并在验证失败时回滚。

下一阶段优先事项：

1. 为部署向导增加 Pages 项目不存在时的安全创建步骤，以及可选的独立 Preview D1。
2. 为本地可视化后台增加经过来源审查的资源导入流程、可选图片压缩和更丰富的正文区块模板；上传前必须明确来源与使用权限。
3. 在拥有多个已接管网站后，根据真实报告增加分批发布和失败重试能力。
4. 为 `site:create` 增加多分类蓝图、可选内容段落模板和受审查的资源复制步骤。
5. 持续记录迁移后的旧 `_shared` 文件清理条件，确认无引用后再由独立清理流程处理。

本文记录“当前真实状态”，`CHANGELOG.md` 记录“如何走到当前状态”。两者必须同时维护。
