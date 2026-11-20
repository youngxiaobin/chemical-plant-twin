# 参与贡献

原创代码按仓库根目录的 MIT 许可证提供，版权持有人是 Xiaobin Zeng。提交补丁即表示你有权贡献这些改动，并同意你的原创贡献以同一 MIT 许可证授权给仓库。

第三方文件不随这次贡献改成 MIT。新增或替换模型、解码器、字体或依赖前，请在说明里写下来源、版本、许可证和校验值。CC0、Apache-2.0、MPL-2.0 和其他许可证要原样保留。

请不要提交：

- `.env`、密钥、令牌、密码
- 私人链接、受密码保护的文档、设计底稿或他人截图
- `node_modules`、构建产物和本地证据日志

本地检查：

```text
npm test
npm run typecheck
npm run lint
npm run build
```

问题复现请用 Issue 模板。功能讨论可以先开 Issue，再提交 Pull Request。
