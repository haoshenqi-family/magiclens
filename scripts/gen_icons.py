#!/usr/bin/env python3
"""生成 MagicLens 扩展图标（放大镜透镜造型），纯标准库实现，无第三方依赖。

用法：python3 scripts/gen_icons.py
输出：extension/icons/icon{16,48,128}.png
"""
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'extension', 'icons')

RING = (79, 70, 229)      # indigo-600 放大镜外圈与手柄
GLASS = (224, 231, 255)   # indigo-100 镜片
GLASS_EDGE = (199, 210, 254)  # indigo-200 镜片靠边渐深
HIGHLIGHT = (255, 255, 255)


def dist_segment(px, py, ax, ay, bx, by):
    """点到线段的最短距离（手柄是圆头粗线）。"""
    abx, aby = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)))
    dx, dy = px - (ax + abx * t), py - (ay + aby * t)
    return (dx * dx + dy * dy) ** 0.5


def render(size, ss=4):
    """size 为目标边长，ss 为超采样倍数（抗锯齿）。返回 RGBA 像素行列表。"""
    n = size * ss
    # 单位坐标系（0..1）下的几何参数
    cx, cy, r_out = 0.40, 0.40, 0.345
    r_in = 0.345 - 0.075  # 外圈厚度
    hx0, hy0, hx1, hy1 = 0.615, 0.615, 0.895, 0.895
    half_w = 0.058        # 手柄半宽
    hlx, hly, hlr = 0.31, 0.31, 0.085  # 高光

    rows = []
    for y in range(n):
        row = []
        for x in range(n):
            px, py = (x + 0.5) / n, (y + 0.5) / n
            r, g, b, a = 0, 0, 0, 0
            d_ring = ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5
            d_handle = dist_segment(px, py, hx0, hy0, hx1, hy1)
            if d_handle <= half_w:
                r, g, b, a = *RING, 255
            if d_ring <= r_out:
                if d_ring >= r_in:
                    r, g, b, a = *RING, 255
                else:
                    # 镜片由边缘向中心渐浅
                    t = d_ring / max(r_in, 1e-6)
                    base = tuple(int(GLASS[i] + (HIGHLIGHT[i] - GLASS[i]) * (1 - t) * 0.6) for i in range(3))
                    r, g, b, a = *base, 255
                    d_hl = ((px - hlx) ** 2 + (py - hly) ** 2) ** 0.5
                    if d_hl <= hlr:  # 左上高光叠白
                        fade = 1 - d_hl / hlr
                        r = int(r + (HIGHLIGHT[0] - r) * fade)
                        g = int(g + (HIGHLIGHT[1] - g) * fade)
                        b = int(b + (HIGHLIGHT[2] - b) * fade)
            row.append((r, g, b, a))
        rows.append(row)

    # 盒式降采样
    out = []
    for oy in range(size):
        outline = []
        for ox in range(size):
            acc = [0, 0, 0, 0]
            for dy in range(ss):
                for dx in range(ss):
                    p = rows[oy * ss + dy][ox * ss + dx]
                    for i in range(4):
                        acc[i] += p[i]
            outline.append(tuple(v // (ss * ss) for v in acc))
        out.append(outline)
    return out


def write_png(path, pixels):
    h, w = len(pixels), len(pixels[0])
    raw = b''.join(b'\x00' + bytes(v for px in row for v in px) for row in pixels)

    def chunk(tag, data):
        return (
            struct.pack('>I', len(data)) + tag + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (16, 48, 128):
        path = os.path.join(OUT_DIR, f'icon{size}.png')
        write_png(path, render(size))
        print(f'written {path}')


if __name__ == '__main__':
    main()
