# 几何与素材取舍

首次下载核对是 2026-11-19。悬铃木元数据和哈希在 2026-11-20 又核对了一次，结果见 `public/models/plane-tree-v1-lod2.NOTICE.txt`。主体装置是原创参数化几何，尺寸写在 `public/assets/manifest.json`。这些尺寸是示意，不是工程测量。

## 使用了什么

| 文件 | 来源 | 许可 | SHA256 | 用途 |
| --- | --- | --- | --- | --- |
| `public/models/plane-tree-v1-lod2.glb` | https://tevy.dev/models/plane-tree/v1/lod2.glb | CC0 1.0，站点说明见 https://tevy.dev/llms.txt | `76001c5667fb27e2e3da3d9b512ab33a2108dd67bb98231ec69f55f069158da2` | 场地外侧 6 棵背景树。模型约 22 m 高、4736 三角面，运行时缩放到约 0.38。材质换成纯色，避免 KTX2 贴图颜色不稳定。几何仍要 meshopt 解码。 |
| `public/decoders/basis/*` | 依赖 `three@0.187.0` 自带的 `examples/jsm/libs/basis` | 随 Three.js MIT 发行，内含 Basis Universal 转码器 | wasm `6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a` | 离线 KTX2 转码。`postinstall` 会按当前 three 版本再复制一次。运行时路径是 `/decoders/basis/`，不访问 CDN。 |

沿路的圆冠行道树、路灯、道路、围栏、卡车和全部工艺设备都是代码生成的。

## 核对后没有放进场景

| 候选 | 核对结果 | 不用的原因 |
| --- | --- | --- |
| https://tevy.dev/models/refinery-unit/v2/lod0.glb | 已下载。1,396,816 字节。SHA256 `13e87cdacbc520af7ae6a3645af1279649724e3cc22b59f609036e461c129bae`。CC0。44×53.8×30 m，45,664 三角面，两座塔、管廊和火炬。需要 meshopt 与 KTX2。 | 只有两座塔，还带火炬和另一套总图，对不上已确认的四塔、双立式罐和冷却池。没有把整段模型塞进厂区。文件不进入仓库，避免被误当成默认装置。 |
| https://tevy.dev/models/four-lane-city-road-12-m/v1/lod0.glb | 元数据已读。16×12 m 城市四车道，CC0。 | 模块是城市道路，不是厂区环路。道路用参数化沥青。 |
| https://tevy.dev/models/gas-tanks | 页面说明是球罐。 | 定稿右侧是立式圆柱罐，不用球罐。 |
| https://tevy.dev/models/city-street-lamp/v1/lod0.glb | 元数据已读。9 m 城市路灯，CC0。 | 画面里是较低的厂区灯，用参数化灯杆。 |
| https://github.com/StefanJohnsen/FalconGasProcessingPlant | 许可可查，整厂约 1 GB / 数千万三角面。 | 没有下载。不适合作为首版默认资产。 |
| https://web.mit.edu/braatzgroup/TE_process.zip | 约 4.9 MB 的 Tennessee Eastman 基准，包内为 Illinois 1998–2002 许可。52 列测量，不是几何，也不是这座厂的遥测。 | 没有下载、没有映射。默认模拟是自写的确定性函数。若以后导入，必须保留该版权与免责声明，并标明“基准仿真，非本厂实况”。 |
| PRONTO Zenodo 1341583 | CC-BY 4.0，约 1.7 GB。 | 没有下载。 |
| Poly Haven asphalt | CC0 贴图。 | 没有下载。地面是程序色，不用站点预览图。 |

## 模型假设

- 1 unit = 1 m，Y 向上，X 向东，-Z 向北。
- 四座塔高 33–44 m，半径约 1.7–2.25 m。
- 管廊平面约 32×24 m，平台在 6.4 m、13 m、26 m。13 m 和 26 m 是工艺层。
- 两台立式罐高约 15–16.5 m，半径约 5.1–5.4 m。
- 管线半径 0.46 m，是为了在总览里能看见流向，比真实管径粗。

这些数字都在 `public/assets/manifest.json`，并写明不是工程设计。
