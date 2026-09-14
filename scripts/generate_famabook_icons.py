import os
import subprocess
import sys
from PIL import Image

# SVG design for famabook.com leafy green 'f' logo
SVG_CONTENT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background squircle gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="50%" stop-color="#043c2e"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>

    <!-- Leaf stem gradient -->
    <linearGradient id="stemGrad" x1="0%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" stop-color="#15803d"/>
      <stop offset="40%" stop-color="#16a34a"/>
      <stop offset="100%" stop-color="#22c55e"/>
    </linearGradient>

    <!-- Top leaf gradient -->
    <linearGradient id="topLeafGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#16a34a"/>
      <stop offset="60%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#86efac"/>
    </linearGradient>

    <!-- Crossbar leaf gradient -->
    <linearGradient id="crossLeafGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#15803d"/>
      <stop offset="50%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#4ade80"/>
    </linearGradient>

    <!-- Glow filter -->
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <!-- Shadow filter -->
    <filter id="dropShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#011812" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Background rounded squircle (superellipse) -->
  <rect x="24" y="24" width="464" height="464" rx="112" ry="112" fill="url(#bgGrad)" stroke="#10b981" stroke-width="6" stroke-opacity="0.35" filter="url(#dropShadow)"/>

  <!-- Decorative subtle background bio-rings / organic accounting ledger rings -->
  <circle cx="256" cy="256" r="190" fill="none" stroke="#10b981" stroke-width="1.5" stroke-opacity="0.15" stroke-dasharray="8 6"/>
  <circle cx="256" cy="256" r="215" fill="none" stroke="#34d399" stroke-width="1" stroke-opacity="0.08"/>

  <!-- Group for the 'f' letter combined with organic leaf -->
  <g filter="url(#dropShadow)">
    <!-- Back leaf aura / ambient glow -->
    <path d="M 230 420 Q 228 320 236 240 Q 242 160 300 110 Q 350 70 405 85 Q 400 135 345 165 Q 295 190 286 240 L 286 420 Z" fill="#22c55e" opacity="0.18" filter="url(#softGlow)"/>

    <!-- Main Stem of 'f' that roots at the bottom and gracefully arches upward -->
    <path d="M 205 420
             C 205 380, 218 310, 222 255
             C 225 210, 235 155, 275 115
             C 305 85, 345 75, 385 82
             C 365 105, 340 120, 310 135
             C 280 152, 268 180, 266 220
             C 264 250, 264 350, 264 420
             C 264 425, 255 428, 235 428
             C 215 428, 205 425, 205 420 Z"
          fill="url(#stemGrad)" />

    <!-- Top Sprouting Leaf crowning the top curve of 'f' -->
    <path d="M 285 125
             C 320 90, 370 70, 420 75
             C 415 120, 380 160, 330 170
             C 305 175, 290 150, 285 125 Z"
          fill="url(#topLeafGrad)" />

    <!-- Top leaf center vein -->
    <path d="M 292 135 Q 350 115 408 85" fill="none" stroke="#bbf7d0" stroke-width="3" stroke-linecap="round" opacity="0.75"/>

    <!-- Secondary small leaf bud on the top hook -->
    <path d="M 335 88 C 360 70, 390 68, 410 76 C 400 95, 375 108, 350 102 Z" fill="#86efac" opacity="0.85"/>

    <!-- Crossbar Leaf (The vibrant accounting growth leaf crossing the 'f') -->
    <path d="M 130 245
             C 170 215, 220 230, 260 240
             C 300 240, 355 205, 410 215
             C 400 255, 360 295, 300 290
             C 260 286, 225 272, 190 278
             C 155 284, 135 265, 130 245 Z"
          fill="url(#crossLeafGrad)" />

    <!-- Crossbar leaf delicate center vein -->
    <path d="M 145 250 Q 270 258 395 228" fill="none" stroke="#dcfce7" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>

    <!-- Side veins on crossbar leaf -->
    <path d="M 220 254 Q 240 242 255 238" fill="none" stroke="#dcfce7" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    <path d="M 280 257 Q 305 245 325 235" fill="none" stroke="#dcfce7" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    <path d="M 340 252 Q 365 240 380 230" fill="none" stroke="#dcfce7" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    <path d="M 250 262 Q 265 275 285 280" fill="none" stroke="#86efac" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    <path d="M 310 260 Q 330 274 350 276" fill="none" stroke="#86efac" stroke-width="2" stroke-linecap="round" opacity="0.5"/>

    <!-- Fresh morning dewdrop on leaf -->
    <circle cx="360" cy="235" r="7" fill="#f0fdf4" opacity="0.9"/>
    <circle cx="358" cy="233" r="2.5" fill="#ffffff"/>
  </g>
</svg>
"""

def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    svg_path = os.path.join(repo_root, 'resources', 'famabook.svg')
    html_path = os.path.join(repo_root, 'resources', 'icon_render.html')
    png_512_path = os.path.join(repo_root, 'resources', 'famabook_512.png')

    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(SVG_CONTENT.strip())
    print(f"Wrote SVG to {svg_path}")

    # Write HTML wrapper for crisp headless browser rendering
    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{
    margin: 0;
    padding: 0;
    background: transparent;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 512px;
    height: 512px;
  }}
  svg {{
    width: 512px;
    height: 512px;
  }}
</style>
</head>
<body>
{SVG_CONTENT}
</body>
</html>"""
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)

    edge_bin = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if not os.path.exists(edge_bin):
        edge_bin = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

    cmd = [
        edge_bin,
        "--headless=new",
        "--hide-scrollbars",
        "--disable-gpu",
        "--force-device-scale-factor=1",
        "--window-size=512,512",
        f"--screenshot={png_512_path}",
        html_path
    ]
    print("Rendering SVG with Edge headless...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not os.path.exists(png_512_path):
        print("Headless Edge error:", res.stderr)
        sys.exit(1)

    print(f"Generated base PNG at {png_512_path}")

    # Load image in Pillow
    base_img = Image.open(png_512_path).convert('RGBA')

    # Target destinations:
    # 1. resources/server/code-512.png
    # 2. resources/server/code-192.png
    # 3. resources/server/favicon.ico
    # 4. resources/win32/code.ico
    # 5. resources/win32/code_150x150.png
    # 6. resources/win32/code_70x70.png
    # 7. resources/linux/code.png
    # 8. extensions/famabook/media/logo.png

    targets = {
        os.path.join(repo_root, 'resources', 'server', 'code-512.png'): (512, 512),
        os.path.join(repo_root, 'resources', 'server', 'code-192.png'): (192, 192),
        os.path.join(repo_root, 'resources', 'win32', 'code_150x150.png'): (150, 150),
        os.path.join(repo_root, 'resources', 'win32', 'code_70x70.png'): (70, 70),
        os.path.join(repo_root, 'resources', 'linux', 'code.png'): (512, 512),
    }

    for path_dst, size in targets.items():
        os.makedirs(os.path.dirname(path_dst), exist_ok=True)
        resized = base_img.resize(size, Image.Resampling.LANCZOS)
        resized.save(path_dst, format='PNG')
        print(f"Saved {path_dst} ({size[0]}x{size[1]})")

    # Multi-resolution ICO for Windows and Web favicon
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    win32_ico_path = os.path.join(repo_root, 'resources', 'win32', 'code.ico')
    server_ico_path = os.path.join(repo_root, 'resources', 'server', 'favicon.ico')

    base_img.save(win32_ico_path, format='ICO', sizes=ico_sizes)
    print(f"Saved {win32_ico_path}")

    base_img.save(server_ico_path, format='ICO', sizes=ico_sizes)
    print(f"Saved {server_ico_path}")

    # Cleanup temp html
    if os.path.exists(html_path):
        os.remove(html_path)

    print("All famabook icons successfully generated!")

if __name__ == '__main__':
    main()
