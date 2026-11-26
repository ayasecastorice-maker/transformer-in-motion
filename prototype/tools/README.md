# 可重复的本地截图与视频导出

这些工具只使用已有的 Chrome/Edge、Node.js 和 Playwright，不自动下载或安装依赖。
浏览器通过 pipe 与 Playwright 通信，使用临时独立配置；读取本地 file URL，不开启 HTTP 服务或调试端口。

初次使用时，在仓库根目录运行 `npm install --prefix . --no-save --package-lock=false playwright-core`。播放和渲染所需的浏览器选择、环境变量、字体与可选的 Pillow 安装方式见[长片工具说明](../../feature/tools/README.md)。以下命令在 `prototype` 目录执行。

```powershell
node tools/render.cjs --probe   # 只探查浏览器和 H.264 WebCodecs 支持
node tools/render.cjs --frames  # 192、447、750、1005 帧，1920×1080 PNG
node tools/render.cjs --video   # 1080 帧，30fps，36 秒，H.264 MP4
node tools/check-player.cjs    # 正常页面播放、暂停、拖动和章节切换
node tools/verify-video.cjs    # 实际解码MP4的四处关键帧并截图
python tools/check-colors.py   # 可选：使用已有Pillow对比源PNG和MP4解码帧
```

`index.html?export=1` 必须提供 `window.seekFrame(frame)`，以及 `id="film"` 的 Canvas2D 元素。
工具等待页面资源和 `document.fonts.ready`，按帧号驱动画面。视频直接读取 canvas 并通过浏览器 WebCodecs 编码，避免截取 1080 张 PNG；此 MP4 没有音轨。

`mp4-mux.cjs` 是仅支持单条 H.264 视频轨的精简 MP4 封装器。它要求 AVCC NAL 单元、按时间排序的帧、首帧关键帧，并使用 90kHz 时间基准。`colr/nclx` 保留编码器报告的颜色基准、传递函数、矩阵与 full-range 标记，避免暗部因视频范围误判而被压黑。编码采用 realtime 模式，输出后通过浏览器检查宽高、时长和随机 seek 解码。

可以用环境变量指定已有工具位置：`PLAYWRIGHT_MODULE_PATH`、`BROWSER_PATH`、`FFMPEG_PATH`。此版本使用浏览器编码，因此无需 FFmpeg；探测信息会如实报告是否找到了它。

输出：`frames/frame-0192.png` 等静帧、`transformer-in-motion.mp4`、`render-manifest.json`。硬件加速选项是编码器偏好，不代表已经证明底层使用了 GPU。
