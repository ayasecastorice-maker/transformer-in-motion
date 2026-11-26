"""Compare actual Canvas screenshots with frames decoded from the final MP4."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat


def main():
    root = Path(__file__).resolve().parent.parent
    results = []
    verification = json.loads((root / 'video-verification.json').read_text(encoding='utf-8'))
    decoded_frames = verification['decodedFrames']
    if not decoded_frames:
        raise ValueError('No decoded frames available to inspect')
    sheet = Image.new('RGB', (1920, 540 * ((len(decoded_frames) + 1) // 2)), '#aaa79c')
    for index, item in enumerate(decoded_frames):
        frame = item['frame']
        source = Image.open(root / 'frames' / f'frame-{frame:04d}.png').convert('RGB')
        video = Image.open(root / 'frames' / f'video-{frame:04d}.png').convert('RGB')
        if source.size != video.size:
            raise ValueError(f'Frame {frame}: dimensions differ')
        difference = ImageStat.Stat(ImageChops.difference(source, video))
        tile = video.resize((957, 538), Image.Resampling.LANCZOS)
        sheet.paste(tile, (960 * (index % 2), 540 * (index // 2)))
        results.append({'frame': frame, 'size': video.size,
                        'mean_absolute_rgb_error': round(sum(difference.mean) / 3, 4),
                        'reference_points': [{'point': p, 'source': source.getpixel(p),
                                              'decoded': video.getpixel(p)}
                                             for p in ((20, 20), (960, 80), (1800, 1000))]})
    (root / 'video-color-check.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(results, indent=2))
    if any(row['mean_absolute_rgb_error'] > 8 for row in results):
        raise ValueError('Color difference requires review; see video-color-check.json')
    sheet.save(root / 'frames' / 'preview.jpg', quality=93, subsampling=0, optimize=True)


if __name__ == '__main__':
    main()
