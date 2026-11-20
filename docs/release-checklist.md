# 公开发布前检查

这是给准备把本仓库放到公开位置的人用的清单。它不是法律意见。

1. 确认根目录 `LICENSE` 仍是 Xiaobin Zeng 2026 年的 MIT 文本，并且没有被拿去覆盖 `public/` 里的第三方文件。
2. 阅读 `THIRD_PARTY_NOTICES.md`。CC0 模型、Apache-2.0 转码器和 npm 依赖仍各自保留许可。
3. 重新计算并核对：
   - `public/models/plane-tree-v1-lod2.glb`
   - `public/decoders/basis/basis_transcoder.wasm`
4. 确认公开包不含 `.git`、`.env`、`node_modules`、`evidence/`、设计原稿、受保护文档或会话日志。
5. 运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`。
6. README 仍写明：参数化示意、本地模拟遥测、不可用于工程决策，且没有连接现场设备。
7. 若 tevy 的 CC0 声明无法再核到，先从公开包移除该 GLB，不要把它改写成 MIT。场景会退回参数化行道树。
8. 不要启用仓库里不存在的发布、部署或安全响应功能。
