# 化工厂数字孪生

本地可运行的示意装置。中央是真实的 Three.js 画布，可以旋转、缩放和平移。温度、压力、流量和管线流速来自本机的确定性模拟，通过 SSE 推到页面。

它不是现场数字孪生，没有连接任何工业控制系统，数值也不能用于工程决策。几何是参数化示意，遥测是本地模拟，不是现场采集，也不是工程精度。

## 许可证边界

根目录 `LICENSE` 是 MIT 许可证，版权持有人是 Xiaobin Zeng，年份 2026。它只覆盖本仓库中有权按 MIT 许可的原创代码和原创文档。

下面这些内容没有改成 MIT：

- `public/models/plane-tree-v1-lod2.glb` 按发布者元数据为 CC0 1.0。法律文本在 `docs/licenses/CC0-1.0.txt`。
- `public/decoders/basis/` 的转码器按 three.js 所注明的来源为 Apache-2.0。全文在该目录的 `LICENSE`。
- `npm install` 取得的依赖保留各自许可证。其中 `lightningcss` 是 MPL-2.0，只在安装依赖时出现，没有被改写进本仓库源码。

`package.json` 的 `license` 字段写成 `(MIT AND Apache-2.0 AND CC0-1.0)`，表示公开目录同时带有这三类文件，而不是把全部内容都标成 MIT。`private: true` 只是阻止误发到 npm，不改变上面的许可证。

工艺和场景代码是本仓库的原创实现，不是某一份教程源码的复制，也不构成教程授权。清单见 `THIRD_PARTY_NOTICES.md`。这不是法律审计结论。

## 环境

已在本仓库验证：

- Node.js `v22.23.4`
- npm `10.9.9`
- 依赖版本写在 `package.json` 和 `package-lock.json`

需要 Node.js 22.18 或更新版本。浏览器需要 WebGL。

## 获取代码

仓库：https://github.com/youngxiaobin/chemical-plant-twin

首次克隆：

```text
git clone https://github.com/youngxiaobin/chemical-plant-twin.git
cd chemical-plant-twin
```

已经克隆过时，在仓库目录拉取 `main`：

```text
git pull origin main
```

## 启动

在项目根目录：

```text
npm install
npm run dev
```

然后打开 [http://127.0.0.1:4317](http://127.0.0.1:4317)。

- 页面监听 `127.0.0.1:4317`。开发和预览默认只接受本机连接。
- 模拟服务：`127.0.0.1:4318`
- 页面里的 `/api` 由 Vite 反代，浏览器不用单独打开 4318

停止：在运行 `npm run dev` 的终端按 `Ctrl+C`。启动器会同时结束页面和模拟服务。

换端口时同时设置两个变量，否则反代会找不到模拟服务：

```text
PORT=4321 SIM_PORT=4322 npm run dev
```

Windows 的 cmd：

```text
set PORT=4321&& set SIM_PORT=4322&& npm run dev
```

PowerShell：

```text
$env:PORT=4321; $env:SIM_PORT=4322; npm run dev
```

`npm run dev` 本身是 Node 脚本，不依赖 bash。

生产构建：

```text
npm run build
npm start
```

`npm start` 同样打开 4317，并带上模拟服务。`npm run preview` 只启动已构建的页面，接口代理需要配套的本机模拟服务。

## 断网运行

`npm install` 完成后，模型和转码器都在 `public/`，页面不请求 CDN，也不需要账号或密钥。之后可以断开网络再执行 `npm run dev`。

## 演示

1. 确认右上角是“模拟已连接”，采样序号会增加。
2. 拖拽中央画面旋转，滚轮缩放，右键平移。点“全厂”或“复位”回到默认视角，点“俯视”或“开始巡检”切换机位。
3. 点左侧设备或直接点模型。列表、标签、底栏和右侧趋势使用同一个位号。
4. 拖动负荷。进料流量和相关温度会在下一帧变化，发光管线的速度跟着变。
5. 点“故障演练”。CW-301、T-102、V-301 会逐步进入预警再进入告警，流量下降。点“恢复”后应力回落，状态回到正常。
6. 点“暂停”。序号停住，管线不再流动。再点一次继续。
7. 点“断开”。状态变为链路已断开，数字保留为最后已知值并视为过期，流动停止。点“重连”恢复。
8. 打开“天气”，切换晴、雨、暴雨、雨强、风力和开关。这些只改画面。

## 其他命令

```text
npm run typecheck
npm run lint
npm test
npm run verify-versions
```

`npm run e2e` 需要本机 Chrome 和运行中的开发服务。可通过 `CHROME_PATH` 指定 Chrome 路径，并用与开发服务相同的 `PORT` 指定页面端口。脚本会通过页面的同源接口重置并操作模拟器，建议为端到端检查单独启动一组 `PORT` 和 `SIM_PORT`。

验收报告和截图默认写到 `evidence/`，可用 `E2E_OUT_DIR` 指定目录。断言或运行失败时，脚本保存诊断报告并以非零状态退出。

## 坐标和位号

1 米一个单位，Y 向上，X 向东，-Z 向北。场地约 116×90 米，是示意而不是测绘。工艺层在 0、13、26 米。位号和教程示例的对应关系见 `docs/architecture.md`。

## 已知限制

- 塔、管廊、立式罐、风机和水池是参数化几何，用来对齐已确认的布置，不是激光扫描模型。
- 读数是确定性示意函数，不是物料衡算或热力学仿真。范围只用于告警演示。
- 没有 OPC、Modbus、MQTT 或其他现场协议。只读适配接口在 `src/sim/adapter.ts`，目前唯一实现是本地模拟器。
- 管线半径被加粗，否则总览里看不见流向。
- 本次帧率是在无独立 GPU 的 Chrome SwiftShader 上测得的，大约 20 FPS、约 200 次绘制、约 22 万三角面。这不是工作站显卡的帧率。
- 高画质会给水池打开反射，会多画一遍场景。
- tevy 炼油模块、Falcon 整厂和 TE 基准数据都没有放进运行时。取舍见 `docs/assets.md`。
- 开源边界、第三方原文和发布前检查见 `THIRD_PARTY_NOTICES.md`、`CONTRIBUTING.md`、`SECURITY.md` 和 `docs/release-checklist.md`。
