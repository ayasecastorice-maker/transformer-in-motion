# 影片导出与复核

渲染器使用 Node.js、Playwright 和支持 WebCodecs H.264 High 5.1 与 AAC-LC 编码的近期 Chrome 或 Edge。成片使用系统中文字体，复现时请安装宋体、楷体或对应的中文衬线字体。原版导出使用 Node.js 24 和 Playwright 1.62.1。

在仓库根目录安装 Node 依赖。颜色比对和 WebP 动态预览还需要 Python 3 与 Pillow。

```console
npm install --prefix . --no-save --package-lock=false playwright-core
python -m pip install Pillow
```

在以 `python3` 提供解释器的系统上，把命令行里的 `python` 换成 `python3`。动态预览自动查找已安装 Pillow 的解释器，也可用 `PYTHON` 指定。渲染工具默认从本地 npm 模块和本机浏览器安装目录或 PATH 查找依赖；可用 `PLAYWRIGHT_MODULE_PATH` 指定 Playwright 模块目录，用 `BROWSER_PATH` 指定浏览器可执行文件。若本机已安装 Playwright 管理的 Chromium，工具也会尝试使用它，实际编码能力可通过样片核验。

在 `feature` 目录执行以下命令。

```powershell
node tools/make-score.cjs
node tools/probe-audio.cjs
node tools/render.cjs --all
node tools/check-player.cjs --complete
node tools/verify-video.cjs
node tools/verify-audio.cjs
python tools/check-colors.py
node tools/storyboard.cjs
node tools/motion-preview.cjs
```

`timeline.js` 中的 `filmSettings` 定义原生宽高、总时长、帧率与审片时间，`plates` 定义顺序及切点。网页、WAV 合成、MP4 封装和解码复核共享这些时间。正式 MP4 文件名为 `transformer-4min-1440p60.mp4`。当前版本为 4 分钟、60 fps、14400 帧，画幅为 2560 × 1440。`--frames` 单独导出审片 PNG，`--video` 单独导出 MP4，`--all` 同时生成两者。完整分镜图为每一镜保留一帧。

`score.js` 合成双声道声轨。四个分量的乘积由短簧音点出，矩阵行按四个列权重改变声部响度，多头分别在左右声道展开后归到中央，分块计算伴随擦纸音。`score.wav` 用于网页播放。MP4 使用同一合成程序生成 48 kHz 双声道 AAC-LC 声轨，视频为 H.264 High 5.1，编码目标码率为 25 Mbps。中途调整镜头要重新生成 WAV 和成片。

`render-manifest.json` 记录原生画布宽高、时长、分辨率、帧数、SPS、颜色与解码音量。`video-verification.json` 列出从正式 MP4 回读的审片帧、真实视频时基及运动镜头中六张相邻的 1/60 秒画面摘要，`video-color-check.json` 比较它们与对应网页帧的 RGB 误差。`audio-verification.json` 记录完整音轨的解码时长、起点延迟、各镜头与音源的相关度。检查本机是否能编码，可先运行 `node tools/render.cjs --sample` 与 `node tools/verify-audio.cjs --sample` 制作并检验 6 秒样片。

