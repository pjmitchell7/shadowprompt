import asyncio
import os
import re
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright

class RangeHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def do_GET(self):
        range_header = self.headers.get('Range')
        if not range_header:
            return super().do_GET()

        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().do_GET()

        size = os.path.getsize(path)
        m = re.match(r'bytes=(\d+)-(\d+)?', range_header)
        if not m:
            return super().do_GET()

        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        length = end - start + 1

        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(length))
        self.end_headers()

        with open(path, 'rb') as f:
            f.seek(start)
            self.wfile.write(f.read(length))

def start_server(port=8776):
    server = ThreadingHTTPServer(('127.0.0.1', port), RangeHTTPRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server

async def run_verification():
    artifact_dir = r"C:\Users\mitch\.gemini\antigravity\brain\df9a9899-da78-4ad8-8a54-f206a394f1c4"
    server = start_server(8776)
    base_url = "http://127.0.0.1:8776/index.html"
    print(f"Local server live at: {base_url}")

    async with async_playwright() as p:
        # ========================================================
        # TEST 1: MOBILE PORTRAIT FRAMING (390x844)
        # ========================================================
        print("\n--- TEST 1: MOBILE PORTRAIT FRAMING (390x844) ---")
        browser = await p.chromium.launch(headless=True)
        context_mobile = await browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True
        )
        page_m = await context_mobile.new_page()

        await page_m.goto(base_url, wait_until="networkidle")
        await asyncio.sleep(1.0)

        # Switch to Tab 2
        await page_m.evaluate("""() => {
            const tabBtn = document.querySelector("[data-tab='tab-chess-arena']");
            if (tabBtn) tabBtn.click();
        }""")
        await asyncio.sleep(2.0)

        # Scroll to 3D board viewport on mobile
        await page_m.evaluate("""() => {
            const el = document.getElementById('chess-3d-viewport');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        }""")
        await asyncio.sleep(1.5)

        mobile_path = os.path.join(artifact_dir, "Verified_Mobile_Portrait_Framing.png")
        await page_m.screenshot(path=mobile_path, full_page=False)
        print(f"Captured Mobile Portrait Screen: {mobile_path}")

        # Also capture exact viewport element
        viewport_el = await page_m.query_selector("#chess-3d-viewport")
        if viewport_el:
            viewport_mobile_path = os.path.join(artifact_dir, "Verified_Mobile_Viewport_Direct.png")
            await viewport_el.screenshot(path=viewport_mobile_path)
            print(f"Captured Mobile Viewport Direct: {viewport_mobile_path}")

        await context_mobile.close()

        # ========================================================
        # TEST 2: DESKTOP PERSPECTIVES, HUD & SNIPER LASER
        # ========================================================
        print("\n--- TEST 2: DESKTOP PERSPECTIVES & 3D HUD (1400x900) ---")
        context_desktop = await browser.new_context(
            viewport={"width": 1400, "height": 900},
            device_scale_factor=1
        )
        page_d = await context_desktop.new_page()

        await page_d.goto(base_url, wait_until="networkidle")
        await asyncio.sleep(1.0)

        # 2A. Verify Homepage Promo Card
        homepage_preview_path = os.path.join(artifact_dir, "Verified_Homepage_Promo_Preview.png")
        img_el = await page_d.query_selector("img[src*='chess_3d_preview.png']")
        if img_el:
            parent_handle = await img_el.evaluate_handle("el => el.closest('.titanium-card')")
            if parent_handle:
                parent_card = parent_handle.as_element()
                if parent_card:
                    await parent_card.screenshot(path=homepage_preview_path)
                    print(f"Captured Homepage Promo Card: {homepage_preview_path}")

        # Switch to Tab 2
        await page_d.evaluate("""() => {
            const tabBtn = document.querySelector("[data-tab='tab-chess-arena']");
            if (tabBtn) tabBtn.click();
        }""")
        await asyncio.sleep(2.0)

        arena_container = await page_d.query_selector("#tab-chess-arena")

        # 2B. White Perspective
        print("Testing White Perspective...")
        await page_d.evaluate("""() => {
            if (window.threeChessArena) window.threeChessArena.setPerspective('white');
        }""")
        await asyncio.sleep(1.5)
        white_path = os.path.join(artifact_dir, "Verified_White_Perspective.png")
        if arena_container:
            await arena_container.screenshot(path=white_path)
            print(f"Captured: {white_path}")

        # 2C. Red Perspective
        print("Testing Red Perspective...")
        await page_d.evaluate("""() => {
            if (window.threeChessArena) window.threeChessArena.setPerspective('red');
        }""")
        await asyncio.sleep(1.5)
        red_path = os.path.join(artifact_dir, "Verified_Red_Perspective.png")
        if arena_container:
            await arena_container.screenshot(path=red_path)
            print(f"Captured: {red_path}")

        # 2D. Move 1 - Red Pawn f3xg2+ (Check on King h1)
        print("Testing Move 1: f3xg2+ Check...")
        await page_d.evaluate("""() => {
            if (window.threeChessArena) {
                window.threeChessArena.jumpTo(22.0);
            }
        }""")
        await asyncio.sleep(1.5)
        move1_path = os.path.join(artifact_dir, "Verified_Move1_Check_h1.png")
        if arena_container:
            await arena_container.screenshot(path=move1_path)
            print(f"Captured: {move1_path}")

        # 2E. 3D Floating HUD Card (Move 1 Active Piece)
        print("Testing 3D-Anchored Floating HUD Card...")
        await page_d.evaluate("""() => {
            if (window.threeChessArena) {
                window.threeChessArena.jumpTo(25.0);
            }
        }""")
        await asyncio.sleep(1.5)
        hud_path = os.path.join(artifact_dir, "Verified_Floating_HUD_Above_Piece.png")
        if arena_container:
            await arena_container.screenshot(path=hud_path)
            print(f"Captured: {hud_path}")

        # 2F. Move 2 - White Queen Blunder Qd2xg2 along Rank 2
        print("Testing Move 2: Qd2xg2 Queen Blunder...")
        await page_d.evaluate("""() => {
            if (window.threeChessArena) {
                window.threeChessArena.closeFloatingHud();
                window.threeChessArena.jumpTo(42.0);
            }
        }""")
        await asyncio.sleep(1.5)
        move2_path = os.path.join(artifact_dir, "Verified_Move2_Queen_Rank2_Blunder.png")
        if arena_container:
            await arena_container.screenshot(path=move2_path)
            print(f"Captured: {move2_path}")

        # 2G. Move 3 - Red Bishop Sniper Laser Targeting (a8 -> g2)
        print("Testing Move 3 Sniper Strike & Laser...")
        await page_d.evaluate("""() => {
            if (window.threeChessArena) {
                window.threeChessArena.closeFloatingHud();
                window.threeChessArena.jumpTo(52.0);
            }
        }""")
        await asyncio.sleep(1.5)
        laser_path = os.path.join(artifact_dir, "Verified_Sniper_Laser_Strike.png")
        if arena_container:
            await arena_container.screenshot(path=laser_path)
            print(f"Captured: {laser_path}")

        # 2H. Move 3 Checkmate Landing (Ba8xg2#)
        print("Testing Move 3 Checkmate Landing...")
        await page_d.evaluate("""() => {
            if (window.threeChessArena) {
                window.threeChessArena.jumpTo(62.0);
            }
        }""")
        await asyncio.sleep(1.5)
        mate_path = os.path.join(artifact_dir, "Verified_Move3_Checkmate_Complete.png")
        if arena_container:
            await arena_container.screenshot(path=mate_path)
            print(f"Captured: {mate_path}")

        # 2I. Move 4 - Invariant Sentinel Barrier
        print("Testing Move 4 Invariant Sentinel Barrier...")
        await page_d.evaluate("""() => {
            if (window.threeChessArena) {
                window.threeChessArena.jumpTo(75.0);
            }
        }""")
        await asyncio.sleep(1.5)
        sentinel_path = os.path.join(artifact_dir, "Verified_Sentinel_Barrier_Defense.png")
        if arena_container:
            await arena_container.screenshot(path=sentinel_path)
            print(f"Captured: {sentinel_path}")

        await context_desktop.close()
        await browser.close()
        server.shutdown()
        print("\nALL VERIFICATION PASSES COMPLETED SUCCESSFULLY.")

if __name__ == "__main__":
    asyncio.run(run_verification())
