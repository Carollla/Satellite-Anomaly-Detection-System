# SatelliteMap.space 本地前端镜像

这是从 `https://satellitemap.space` 拉取并本地化整理的前端镜像。目标是让首页 3D 卫星地图尽量保持原站效果，同时在运行时不再访问外部链接、外部 API、CDN 或地图服务。

本项目不是原站后端的完整克隆，而是“原站前端静态资源 + 本地数据快照 + 本地 API 兼容层”。

## 运行方式

需要本机安装 Node.js。进入本目录后运行：

```bash
npm start
```

然后打开：

```text
http://localhost:5173
```

如果浏览器之前打开过旧版本，请强制刷新：

```text
Ctrl + F5
```

如果 5173 端口被占用，可以换端口：

```powershell
$env:PORT=5174; npm start
```

## 当前验证结果

已用本地 Chrome 对 `http://localhost:5173` 做过运行验证：

- Starlink 默认加载成功，前端实际部署 `10737` 颗卫星。
- 页面面板显示：`Distribution (10737 satellites)`。
- 原站默认视觉参数对齐：`style=2`、`lighting=0`、`clouds=0`、`skybox=1`。
- 本地地图瓦片可以加载，近景验证时瓦片缓存为 `16` 张。
- 运行时外部请求为 `0`。
- `server.mjs` 和 `assets/main.localfix3.js` 均通过 `node --check`。

说明：`json/local-api/satellites-starlink-active.json` 里有 `10761` 条 Starlink 快照记录，但前端会结合 TLE、状态和轨道解析结果部署可用目标，所以实际显示为 `10737` 颗。这和原站同次验证结果一致。

## 相比原站做过的本地化改动

### 1. 增加本地静态服务

新增并使用 `server.mjs` 作为本地入口服务，替代直接双击 `index.html`。

原因是原站前端依赖这些浏览器能力：

- ES module 绝对路径加载，例如 `/assets/...`。
- 客户端路由，例如 `/vis/...`、`/constellation/...`。
- API 请求，例如 `/satellites`、`/v2/tle`。
- WebGL 贴图、二进制文件、地图瓦片等静态资源。

直接用 `file://` 打开时这些路径不会按网站根目录解析，所以必须用本地 HTTP 服务模拟站点根目录。

### 2. 把 API 入口改成本地 `/local-api`

原站前端会访问 `https://api2.satellitemap.space`。本地化后统一改为访问：

```text
/local-api
```

`server.mjs` 里实现了兼容接口，主要包括：

- `/local-api/health`
- `/local-api/api/keys/session`
- `/local-api/api/create-session`
- `/local-api/api/user-state`
- `/local-api/satellites?constellation=starlink&status=active`
- `/local-api/v2/tle`
- `/local-api/tle`
- `/local-api/available-tiles`
- `/local-api/api/launch-sites`
- `/local-api/api/ground-stations`
- `/local-api/searchables`
- `/local-api/constellations`
- `/local-api/hardware-names`

其中核心卫星和 TLE 接口返回真实本地快照；不影响首页主要显示的接口返回空数据或离线 stub，避免前端白屏。

### 3. 修正 session 兼容字段

原站前端创建 session 时实际检查的是 `token` 字段。早期本地 stub 返回 `sessionToken`，导致前端认为 session 创建失败，后续默认 Starlink 加载流程不会执行。

现在 `/local-api/api/create-session` 返回兼容结构：

```json
{
  "success": true,
  "token": "local-offline-session",
  "userData": {
    "email": null,
    "is_verified": false,
    "is_superuser": false,
    "last_visit": []
  }
}
```

这一步是“页面有地球但没有卫星”的关键修复之一。

### 4. 本地化 Starlink 卫星快照

已下载并保存：

```text
json/local-api/satellites-starlink-active.json
```

文件大小约 `4.59 MB`，包含 `10761` 条 Starlink 活跃卫星记录。`server.mjs` 会在前端请求 `/local-api/satellites?...` 时返回这个文件。

### 5. 本地化 Starlink TLE

已下载并保存：

```text
json/local-api/v2-tle-starlink.txt
```

文件大小约 `1.56 MB`。前端通过 `/local-api/v2/tle` 获取 TLE 后计算轨道和实时位置。

没有这份 TLE，即使有卫星 metadata，前端也无法部署可移动卫星点。

### 6. 修正首页默认 Starlink 加载流程

原站 bundle 中首页默认会在 session 成功后进入 Starlink 加载流程。本地镜像早期由于 session stub 不兼容，没有进入该分支。

当前 `assets/main.localfix3.js` 已确保首页默认加载 Starlink，并在本地接口可用后部署移动点数据。

浏览器验证结果：

```text
Distribution (10737 satellites)
```

### 7. 主 bundle 改名以避开浏览器旧缓存

原始主包路径为：

```text
/assets/main.zFJLWONr.js
```

本地修复后的主包为：

```text
/assets/main.localfix3.js
```

所有 HTML 中的主入口脚本已改为加载 `main.localfix3.js`。`server.mjs` 对旧的 `/assets/main.zFJLWONr.js` 返回 `410`，提示浏览器不要继续使用旧缓存。

### 8. 本地化动态 JS/CSS chunk

原站前端不是单个 JS 文件，运行过程中还会动态 import 多个 chunk，例如 UI、分享、计算器等模块。

已下载并修正本地引用，典型文件包括：

```text
assets/blueglobe-ui.Cm_H4t79.js
assets/blueglobe-share.RIcMg-WL.js
assets/extensions-bundle.BE78ukRK.js
assets/altitude-history.CwknV_6r.js
```

这些文件现在都从本地 `/assets/...` 加载。

### 9. 本地化 CDN 依赖

原站部分功能会从 CDN 加载第三方库。为了满足运行时不访问外部链接，已下载到：

```text
assets/vendor/uPlot.esm.js
assets/vendor/uPlot.min.css
assets/vendor/Sortable.min.js
```

相关动态 import 已指向本地文件。

### 10. 本地化主要贴图和图片资源

已下载地球、月球、星空等主要资源，例如：

```text
images/globe-mask.png
images/bluemarble-2k.webp
images/bluemarble-4k.webp
images/bluemarble-distant.webp
images/clouds-alpha.webp
images/earth_lights2.jpg
images/earth_specular_map.jpeg
images/moon_color_2k.jpg
images/moon_color_4k.jpg
images/moon_bump_2k.jpg
images/moon_bump_4k.jpg
images/starmap-4k.jpg
images/milkyway-4k.jpg
```

`images/earth_lights.gif` 原始资源没有完整拉取成功，目前由本地透明占位图兜底；默认首页 `lighting=0`，不影响默认原站视图对齐。

### 11. 本地化边界二进制数据

原站会请求：

```text
/json/combined_borders.bin
```

已下载到：

```text
json/combined_borders.bin
```

同时在 bundle 中给边界资源加了本地 cachebuster：

```text
combined_borders.bin?v=local
```

这是为了避开浏览器或运行时对旧无参路径的缓存/拦截，保证本地文件按静态资源读取。

### 12. 本地化 available-tiles 位图

原站地图瓦片系统会请求：

```text
/available-tiles
```

前端期望的是 8192 字节二进制位图，不是 JSON。早期本地 stub 返回 JSON，会触发：

```text
[TileAtlas] Invalid bitmap size
```

现在已保存原站位图：

```text
json/local-api/available-tiles.bin
```

`server.mjs` 在 `/local-api/available-tiles` 返回 `application/octet-stream`，长度为 `8192` 字节。

### 13. 本地化地图瓦片

原站默认视觉参数为 `style=2`，也就是暗色地图瓦片风格。前端拉近地球时会请求瓦片。

已下载暗色瓦片：

```text
tiles/styles/dark/512/{z}/{x}/{y}.jpg
```

当前下载范围：

```text
z0-z5，共 1365 张
```

原站在非本地环境会请求类似：

```text
/tiles/styles/dark/512/5/16/16.jpg
```

但在 localhost 下，前端实际会请求：

```text
/images/tiles/5/16/16.png
```

因此 `server.mjs` 做了映射：当浏览器请求 `/images/tiles/{z}/{x}/{y}.png` 时，优先读取本地：

```text
tiles/styles/dark/512/{z}/{x}/{y}.jpg
```

并以 `image/jpeg` 返回。这样可以避免地球瓦片变成透明占位图。

### 14. 为未下载瓦片提供兜底

如果请求的瓦片尚未下载，`server.mjs` 会返回 1x1 透明 PNG，避免前端报 404 或白屏。

这意味着：默认视角和 z0-z5 范围内效果较完整；如果继续大幅放大到 z6-z8 或更高层级，尚未下载的瓦片仍可能显示为空白/透明。要继续提高一致性，需要继续批量下载更高层级瓦片。

### 15. 本地化运行时资源 stub

为了避免前端在离线环境访问外部服务，`server.mjs` 为部分功能提供空数据或占位返回：

- `/adsb/aircraft.json` 返回空飞机列表。
- `/json/jpl_ephemeris_ground_truth.json` 返回空测试数据。
- `/json/planes/db/*.js` 返回空对象。
- `/html/app_banner.html.*` 返回空内容。
- `/planespotters/photos/hex/...` 返回空照片列表。
- `/adsb/routeset` 返回空数组。
- `/magdecl` 返回 `{ declination: 0 }`。
- `/music` 返回离线禁用信息。
- `/re-api/...` 返回空 re-entry/aircraft 数据。
- `/api/statistics` 返回成功。

这些 stub 的目的不是复刻完整后端业务，而是让首页主 3D 卫星地图在本地稳定运行。

### 16. 阻止运行时访问外部网络

`server.mjs` 在响应头中设置了 CSP：

```text
default-src 'self' blob: data:
script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:
style-src 'self' 'unsafe-inline'
img-src 'self' blob: data:
font-src 'self' data:
connect-src 'self' blob: data:
media-src 'self' blob: data:
worker-src 'self' blob:
frame-src 'self'
object-src 'none'
base-uri 'self'
form-action 'self'
```

这会限制页面运行时继续连接外部 API、图片、脚本、字体或媒体资源。

外部链接会被引导到：

```text
/offline-external
```

显示本地离线提示，而不是打开真实外站。

### 17. 修正原站 App 资源重定向逻辑

原 bundle 中存在一段 `app://...` 资源重定向逻辑，用于原站或移动 App 场景。普通浏览器本地运行时不支持 `app://`。

本地化时已从该重定向名单中移除 `combined_borders.bin`，避免边界数据被错误导向 `app://combined_borders.bin`。

### 18. 保留原站默认视觉开关

原站首页默认视觉参数并不是“真实光照 + 云层开启”，而是：

```text
style=2
lighting=0
clouds=0
skybox=1
```

本地镜像保持这个默认状态，以便和原站首页第一屏一致。工具栏中仍可以切换光照、云层、地球样式等模式。

## 目录说明

```text
index.html                         首页入口
assets/                            主 JS/CSS bundle 和动态 chunk
assets/vendor/                     本地化第三方前端库
images/                            地球、月球、星空、图标等图片资源
json/                              本地 JSON 和二进制数据
json/local-api/                    本地 API 数据快照
tiles/styles/dark/512/             本地暗色地图瓦片
server.mjs                         本地静态服务和 API 兼容层
package.json                       npm start 入口
README.md                          本说明文件
```

## 关键本地数据

```text
json/local-api/satellites-starlink-active.json  约 4.59 MB，10761 条 Starlink 快照
json/local-api/v2-tle-starlink.txt              约 1.56 MB，Starlink TLE
json/local-api/starlink-norads.json             Starlink NORAD 辅助列表
json/local-api/available-tiles.bin              8192 字节瓦片可用性位图
json/combined_borders.bin                       约 1.14 MB 边界数据
tiles/styles/dark/512/                          z0-z5 暗色地图瓦片，1365 张
```

## 已知限制

- 这是静态前端镜像，不包含原站完整实时后端。
- Starlink 数据和 TLE 是下载时快照，不会自动更新。
- z6-z8 及更高层级地图瓦片尚未全量下载，深度放大时可能出现占位图。
- ADS-B 飞机、登录账号、云端偏好同步、分享状态生成、服务端搜索、实时新闻/视频等功能做了降级或空数据处理。
- `earth_lights.gif` 使用透明占位兜底；默认首页不依赖它。

## 排错

如果白屏或看不到卫星：

1. 确认服务正在运行：`npm start`
2. 打开：`http://localhost:5173`
3. 强制刷新：`Ctrl + F5`
4. 确认浏览器没有继续请求旧文件：`/assets/main.zFJLWONr.js`
5. 打开开发者工具 Console，把第一条红色错误发出来继续排查

如果卫星数量为 0，优先检查：

```text
http://localhost:5173/local-api/satellites?constellation=starlink&status=active
http://localhost:5173/local-api/v2/tle
```

如果地球瓦片缺失，优先检查：

```text
http://localhost:5173/local-api/available-tiles
http://localhost:5173/images/tiles/5/16/16.png
```

如果怀疑仍有外部请求，请打开开发者工具 Network，过滤 `http`，正常情况下首页运行时不应出现非 `localhost:5173` 的活动请求。

