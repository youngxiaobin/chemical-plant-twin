# 第三方声明

根目录 `LICENSE` 只许可 Xiaobin Zeng 有权按 MIT 提供的原创部分。本文件列出随仓库或锁文件出现、但不能改写成 MIT 的内容。这不是法律审计。

## 随仓库分发的文件

### CC0 1.0：悬铃木模型

- 文件：`public/models/plane-tree-v1-lod2.glb`
- 页面：https://tevy.dev/models/plane-tree
- 固定地址：https://tevy.dev/models/plane-tree/v1/lod2.glb
- 元数据：https://tevy.dev/models/plane-tree.json
- 站点说明：https://tevy.dev/llms.txt
- 2026-11-20 重核：元数据 `license` 为 `CC0-1.0`；声明的 SHA256 与本地文件一致：`76001c5667fb27e2e3da3d9b512ab33a2108dd67bb98231ec69f55f069158da2`
- 法律文本：`docs/licenses/CC0-1.0.txt`
- 旁边说明：`public/models/plane-tree-v1-lod2.NOTICE.txt`

CC0 的声明人是 tevy 发布者，不是本仓库作者。依据是发布者自己的元数据和站点文字。没有独立公证或律师审查。

### Apache-2.0：Basis Universal 转码器

- 文件：`public/decoders/basis/basis_transcoder.js`、`basis_transcoder.wasm`
- 来源：`three@0.187.0` 的 `examples/jsm/libs/basis/`
- three.js 在该目录 README 中指向 https://github.com/BinomialLLC/basis_universal ，并写明 Apache License 2.0
- 全文：`public/decoders/basis/LICENSE` 与 `docs/licenses/Apache-2.0.txt`
- 归属：`public/decoders/basis/NOTICE`
- wasm SHA256：`6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a`

这两个文件按安装时的 three 版本原样复制，没有改成 MIT。

### MIT：three.js 与 meshoptimizer 解码器

- `three@0.187.0`，MIT，版权 2010-2026 three.js authors。全文：`docs/licenses/three-MIT.txt`
- `node_modules/three/examples/jsm/libs/meshopt_decoder.module.js` 文件头写明它属于 meshoptimizer，MIT，Copyright (C) 2016-2026 Arseny Kapoulkine。构建时从 three 包引用，没有单独放进 `public/`，也没有改许可证。

界面字体只写了系统字体名，仓库里没有字体文件。

## 没有放进仓库的候选

tevy 炼油模块、城市道路、球罐、Falcon 整厂、Tennessee Eastman 数据和 Poly Haven 贴图都没有放进本仓库。详见 `docs/assets.md`。

## npm 锁文件里的依赖

直接依赖：`react`、`react-dom`、`three` 为 MIT。开发依赖里 `typescript` 和 `puppeteer-core` 为 Apache-2.0，其余直接开发依赖为 MIT。

2026-11-20 对当前 `node_modules` 的许可证字段统计见 `docs/dependency-licenses.md`。其中需要单独记住的是：

- `lightningcss@1.33.0` 及其两个 Linux 平台包为 MPL-2.0。它们是 Vite 的传递依赖，源码包不包含这些文件。分发 `node_modules` 时必须保留它们自己的 MPL 声明。本仓库没有修改这些文件。
- 没有发现 GPL、AGPL 或 SSPL 许可证字段。

依赖在安装时取得，不因为本仓库的 MIT 许可证而改变。

## 原创范围

`src/`、`server/`、`scripts/` 中的实现是本仓库编写的。它参考了公开技术栈和一条示意工艺链，但仓库里没有教程正文，也没有把教程写成授权来源。
