# Transformer 动画图解

双击 [index.html](index.html) 即可播放。网页内含绘图代码和中文字幕，可以离线打开。整片 36 秒，画幅 16∶9，无声。

| 时间 | 镜头 | 看什么 |
| --- | --- | --- |
| 0–10 秒 | 自注意力 | 选中「坐在」的查询 Q，与每个词块的键 K 匹配。蓝色线束把各位置的值 V 加权汇入新的表示。 |
| 10–19 秒 | 前馈网络 | 跟随同一位置，看特征从 512 维展开到 2048 维，经 ReLU 后投影回 512 维。所有位置共享这两层线性变换的参数。 |
| 19–28 秒 | 编码器层 | 从底部读起，多头自注意力和前馈网络前后相接。每个子层的输入通过残差支路与其输出相加，再经过层归一化。 |
| 28–36 秒 | 完整 Transformer | 蓝色编码器读入源序列，金色解码器对右移的目标序列做因果自注意力。交叉注意力使用解码器的 Q 和编码器的 K、V，最后由线性层和 softmax 给出下一个词的分布。 |

## 播放与审片

使用底部按钮播放、暂停或进入全屏。拖动进度条可以定格到单帧，章节菜单可以直达对应的镜头。焦点在画面背景时，空格切换播放，左右方向键各移动一秒。

[四帧总览](frames/overview.jpg) 汇集四个镜头。单帧原图分别位于 [6.4 秒](frames/frame-0192.png)、[14.9 秒](frames/frame-0447.png)、[25.0 秒](frames/frame-0750.png) 和 [33.5 秒](frames/frame-1005.png)。36 秒的 1080p MP4 位于完整项目包内的 `prototype/transformer-in-motion.mp4`。[下载完整项目包](https://github.com/ayasecastorice-maker/transformer-in-motion/releases/download/v1.0.0/transformer-in-motion-v1.0.0-full.zip)

## 教学设定

第一幕使用「小猫 / 坐在 / 垫子 / 上」四个示例词块。为让百分比可复算，取单头查询对应的四个点积为 `[2, 1, 3, 0]`，键的维度为 4。点积除以 √4，再做 softmax 并四舍五入，得到 27.6%、16.7%、45.5% 和 10.2%。这些数值用于演示加权过程。后两幕采用 2017 年论文中的编码器–解码器、ReLU 和 Post-LN 配置。[Attention Is All You Need](https://arxiv.org/abs/1706.03762)

画面参考 Apple 产品页的留白和明暗关系。动画用流动、展开和堆叠分别表达信息汇聚、维度变化和层级关系。图形均由浏览器 Canvas 2D 生成。[MacBook Air 产品页](https://www.apple.com/macbook-air/) · [Apple 动效设计指南](https://developer.apple.com/design/human-interface-guidelines/motion)

## 再次导出

播放网页只需浏览器。重新制作 PNG 和 MP4 使用 Node.js、Playwright 与支持 H.264 WebCodecs 编码的 Chromium 浏览器，命令和输出格式见[导出说明](tools/README.md)。

