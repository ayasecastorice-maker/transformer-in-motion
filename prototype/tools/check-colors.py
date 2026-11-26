"""Compare browser PNGs with decoded MP4 frames; requires an existing Pillow install."""
from pathlib import Path
import json
from PIL import Image, ImageChops, ImageStat


def main():
    root = Path(__file__).resolve().parent.parent
    results = []
    for frame in (192, 447, 750, 1005):
        source = Image.open(root / 'frames' / f'frame-{frame:04d}.png').convert('RGB')
        video = Image.open(root / 'frames' / f'video-{frame:04d}.png').convert('RGB')
        if source.size != video.size:
            raise ValueError(f'Frame {frame}: dimensions differ')
        difference = ImageStat.Stat(ImageChops.difference(source, video))
        dark_samples = [
            {'point': point, 'source': source.getpixel(point), 'decoded': video.getpixel(point)}
            for point in ((20, 20), (800, 150), (1000, 1000))
        ]
        results.append({'frame': frame, 'size': video.size,
                        'mean_absolute_rgb_error': round(sum(difference.mean) / 3, 4),
                        'dark_samples': dark_samples})
    (root / 'video-color-check.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
