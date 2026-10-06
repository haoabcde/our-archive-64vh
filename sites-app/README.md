# 未完待续 · OUR ARCHIVE

私人纪念档案馆的新版源码。暖白信纸、照片细框、火漆拆信；支持密码进入、相册上传、回信、回忆、时间胶囊与跨设备保存。

## 运行

需要 Node.js 22.13+，本地使用 Node SQLite。安装依赖：`npm ci`。
将 `.env.example` 的四个变量填入 `.dev.vars`，然后运行 `npm run dev`。
生产构建：`npm run build`。验证：`npm run test:sites`。

本地开发服务使用仅限预览的服务器会话，方便预览页面；生产 Worker 始终校验密码会话。

## 数据与访问

- D1 保存记录、回信与互动状态；R2 保存照片。
- 私人初始内容使用 AES-256-GCM 加密存储在 `worker/seed.js`，解密密钥仅配置在服务端。
- `.dev.vars`、环境文件、密钥和私密截图禁止提交。
- `/api/` 与 `/media/` 在服务端校验会话；未解锁不能取得正文和图片。
- 文字导出不包含照片文件；时间胶囊正文到期后才展示或导出。
- 旧站 JSON 备份支持导入回信、未来记录、标记的小事与已兑换特权券。

## 发布

Sites 的配置位于 `.openai/hosting.json`。保留同一 project_id，由 Sites 管理 D1、R2 与密钥。生产输出为 `dist/client` 与 `dist/server`。
