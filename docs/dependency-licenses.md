# 已安装依赖的许可证字段

统计时间：2026-11-20。方法：读取当时 `node_modules` 里每个包自己的 `package.json` `license` 字段，按包名去重。这只反映锁文件安装结果上的声明，不是法律审计，也不会把这些包改成 MIT。

MIT 包 164 个，下面只列非 MIT。

## Apache-2.0

`@dimforge/rapier3d-compat@0.12.0`、`@eslint/config-array@0.21.2`、`@eslint/config-helpers@0.4.2`、`@eslint/core@0.17.0`、`@eslint/object-schema@2.1.7`、`@eslint/plugin-kit@0.4.1`、`@humanfs/core@0.19.2`、`@humanfs/node@0.16.8`、`@humanfs/types@0.15.0`、`@humanwhocodes/module-importer@1.0.1`、`@humanwhocodes/retry@0.4.3`、`@puppeteer/browsers@2.10.6`、`b4a@1.9.0`、`bare-buffer@3.7.3`、`bare-events@2.9.2`、`bare-fs@4.8.4`、`bare-path@3.1.3`、`bare-stream@2.13.4`、`bare-url@2.5.8`、`chromium-bidi@7.2.0`、`detect-libc@2.1.2`、`eslint-visitor-keys@3.4.3`、`events-universal@1.0.1`、`puppeteer-core@24.15.0`、`text-decoder@1.2.7`、`typescript@5.9.3`

## MPL-2.0

`lightningcss@1.33.0`、`lightningcss-linux-x64-gnu@1.33.0`、`lightningcss-linux-x64-musl@1.33.0`

这是文件级弱 copyleft。源码包不收录这些文件。若把 `node_modules` 一起公开，必须保留它们自带的 MPL 文本，不能删掉后说成 MIT。

## BSD-2-Clause

`escodegen@2.1.0`、`eslint-scope@8.4.0`、`espree@10.4.0`、`esprima@4.0.1`、`esrecurse@4.3.0`、`estraverse@5.3.0`、`esutils@2.0.3`、`extract-zip@2.0.1`、`uri-js@4.4.1`

## BSD-3-Clause

`devtools-protocol@0.0.1464554`、`esquery@1.7.0`、`source-map-js@1.2.4`、`source-map@0.6.1`

## ISC

`cliui@8.0.1`、`fastq@1.20.3`、`flatted@3.4.4`、`get-caller-file@2.0.5`、`glob-parent@6.0.2`、`isexe@2.0.0`、`lru-cache@7.18.3`、`minimatch@9.0.9`、`once@1.4.0`、`picocolors@1.1.1`、`semver@7.8.6`、`which@2.0.2`、`wrappy@1.0.2`、`y18n@5.0.8`、`yargs-parser@21.1.1`

## 其他宽松许可证

- `tslib@2.9.1`：0BSD
- `argparse@2.0.1`：Python-2.0

未在许可证字段中看到 GPL、AGPL 或 SSPL。
