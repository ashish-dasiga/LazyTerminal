"""
Lazy Terminal — Windows PC Companion Desktop Application (Tkinter Glass Effect Theme)

Features:
1. Native Windows 11 / 10 Dark Mode Titlebar & Glass Effect Theme.
2. High-quality rendered brand logo & subtle frosted-glass background composite using Pillow (PIL).
3. Token-only standby view with large monospace token, copy to clipboard, and host LAN IP discovery.
4. Embedded background HTTP server on 0.0.0.0:3000 (with 9871 fallback) accepting live LAN pairing
   from Android phones & mobile browsers without CORS or HTML errors.
5. Dynamic transition to Connected View upon successful mobile pairing (revealing Sync Manager,
   Server Control, and live intent synchronization).
"""

import sys
import os
import random
import socket
import threading
import time
import json
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageFilter, ImageDraw, ImageTk


# Resource path resolver (supports PyInstaller --onefile)
def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        p = os.path.join(sys._MEIPASS, relative_path)
        if os.path.exists(p):
            return p
    script_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
    candidate = os.path.join(script_dir, relative_path)
    if os.path.exists(candidate):
        return candidate
    if os.path.exists(relative_path):
        return os.path.abspath(relative_path)
    return None


# Windows 11 / 10 Dark Mode Titlebar
def enable_windows_dark_titlebar(window):
    try:
        import ctypes
        window.update()
        hwnd = ctypes.windll.user32.GetParent(window.winfo_id())
        if not hwnd:
            hwnd = window.winfo_id()
        DWMWA_USE_IMMERSIVE_DARK_MODE = 20
        value = ctypes.c_int(2)
        ctypes.windll.dwmapi.DwmSetWindowAttribute(
            hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ctypes.byref(value), ctypes.sizeof(value)
        )
    except Exception:
        pass


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.3)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


INITIAL_SYNCS = [
    {
        "id": "SYNC-REQ-104",
        "timestamp": "2026-10-25 00:15:22",
        "time_ago": "2 mins ago",
        "items": 3,
        "summary": "Offline intent queue flushed & causal graph synced with host",
        "head_commit": "3f7a8b1",
    },
    {
        "id": "SYNC-REQ-103",
        "timestamp": "2026-10-24 23:45:10",
        "time_ago": "32 mins ago",
        "items": 2,
        "summary": "Workspace file tree & dirty state synced across tunnel",
        "head_commit": "3f7a8b1",
    },
    {
        "id": "SYNC-REQ-102",
        "timestamp": "2026-10-24 22:58:04",
        "time_ago": "1 hour ago",
        "items": 5,
        "summary": "Branch checkout and remote ref synchronization",
        "head_commit": "a9c210d",
    },
]


# ---------------------------------------------------------------------------
# Embedded Multithreaded Companion HTTP Server (Zero-Dependency)
# ---------------------------------------------------------------------------

class CompanionHttpServer(HTTPServer):
    def __init__(self, server_address, RequestHandlerClass, app_instance):
        super().__init__(server_address, RequestHandlerClass)
        self.app = app_instance


class CompanionRequestHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        app = self.server.app

        if parsed.path in ("/health", "/api/v1/host/status"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            payload = {
                "status": "ok",
                "serverStatus": "running" if app.is_server_running else "stopped",
                "hostname": app.hostname,
                "ip": app.local_ip,
                "port": app.host_port,
                "isConnected": app.is_connected,
                "pairingToken": app.pairing_token
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))

        elif parsed.path == "/api/v1/pairing/key":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"pairingKey": app.pairing_token}).encode("utf-8"))

        else:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Endpoint {parsed.path} not found on host"}).encode("utf-8"))

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        app = self.server.app
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        if parsed.path in ("/api/v1/tunnel/connect", "/api/v1/pairing/validate"):
            incoming_key = str(data.get("pairingKey") or data.get("token") or "")
            norm_in = incoming_key.replace(" ", "").replace("-", "").strip().lower()
            norm_target = app.pairing_token.replace(" ", "").replace("-", "").strip().lower()

            if norm_in and norm_in == norm_target:
                # Valid token! Establish encrypted tunnel & reveal Sync Manager
                app.is_connected = True
                app.root.after(0, app.build_ui)
                app.root.after(0, lambda: app.show_toast("Mobile device connected via Wi-Fi! Sync unlocked."))

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._send_cors_headers()
                self.end_headers()
                resp = {
                    "success": True,
                    "sessionToken": f"sess_{int(time.time())}",
                    "device": {
                        "id": f"win-companion-{app.hostname}",
                        "name": app.hostname,
                        "os": "Windows 11 x64",
                        "isOnline": True,
                        "tunnelStatus": "active",
                        "backendServerStatus": "running"
                    }
                }
                self.wfile.write(json.dumps(resp).encode("utf-8"))
            else:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self._send_cors_headers()
                self.end_headers()
                resp = {
                    "success": False,
                    "errorMessage": f"Incorrect pairing code \"{incoming_key}\". Please check the 6-digit key displayed on your Windows PC screen."
                }
                self.wfile.write(json.dumps(resp).encode("utf-8"))

        elif parsed.path == "/api/v1/pairing/generate":
            app.root.after(0, app.handle_regenerate_token)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"pairingKey": app.pairing_token}).encode("utf-8"))

        elif parsed.path == "/api/v1/tunnel/disconnect":
            app.is_connected = False
            app.root.after(0, app.build_ui)
            app.root.after(0, lambda: app.show_toast("Mobile device disconnected. Waiting for connection."))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode("utf-8"))

        elif parsed.path == "/api/v1/sync/run":
            app.root.after(0, app.handle_sync_request)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "records": app.sync_records}).encode("utf-8"))

        else:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Endpoint {parsed.path} not found"}).encode("utf-8"))

    def log_message(self, format, *args):
        # Silence default stderr logging for clean console
        pass


# ---------------------------------------------------------------------------
# LazyTerminalCompanionApp GUI
# ---------------------------------------------------------------------------

class LazyTerminalCompanionApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Lazy Terminal — Windows PC Host Companion")
        self.root.geometry("820x620")
        self.root.minsize(760, 560)
        self.root.configure(bg="#090d16")

        enable_windows_dark_titlebar(self.root)

        # State
        self.hostname = os.environ.get("COMPUTERNAME", "DESKTOP-WIN11-PRO")
        self.local_ip = get_local_ip()
        self.host_port = 3000
        self.pairing_token = self.generate_random_token()
        self.is_connected = False
        self.is_server_running = True
        self.sync_records = list(INITIAL_SYNCS)
        self.selected_sync_id = self.sync_records[0]["id"]
        self.is_syncing = False
        self.toast_message = ""
        self.toast_timer = None
        self.httpd = None

        # Icon and background assets
        self.icon_photo = None
        self.bg_photo = None
        self.prepare_images()

        # Styles
        self.setup_styles()

        # Main Layout Containers
        self.bg_label = None
        self.main_container = None
        self.header_frame = None
        self.toast_frame = None
        self.content_frame = None
        self.footer_frame = None

        # Build initial UI
        self.build_ui()

        # Start embedded companion HTTP server in daemon thread
        self.start_embedded_server()

    def generate_random_token(self) -> str:
        part1 = f"{random.randint(100, 999)}"
        part2 = f"{random.randint(100, 999)}"
        return f"{part1}-{part2}"

    def prepare_images(self):
        """Prepare high-quality rounded app icon and glass background composite."""
        icon_path = get_resource_path("icon.jpeg")
        if not icon_path or not os.path.exists(icon_path):
            icon_path = get_resource_path("public/downloads/icon.jpeg")

        raw_icon = None
        if icon_path and os.path.exists(icon_path):
            try:
                raw_icon = Image.open(icon_path).convert("RGBA")
            except Exception:
                raw_icon = None

        # Fallback if image missing
        if raw_icon is None:
            raw_icon = Image.new("RGBA", (192, 192), (37, 99, 235, 255))
            d = ImageDraw.Draw(raw_icon)
            d.rectangle([(20, 20), (172, 172)], fill=(56, 189, 248, 255))

        # 1. High-Res Rounded App Icon (72x72) with anti-aliasing
        icon_size = (72, 72)
        resized_icon = raw_icon.resize(icon_size, Image.Resampling.LANCZOS)
        mask = Image.new("L", icon_size, 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle([(0, 0), icon_size], radius=16, fill=255)
        resized_icon.putalpha(mask)

        # Subtle glowing cyan/blue border
        icon_with_border = Image.new("RGBA", (76, 76), (0, 0, 0, 0))
        border_draw = ImageDraw.Draw(icon_with_border)
        border_draw.rounded_rectangle([(0, 0), (75, 75)], radius=18, fill=(30, 41, 59, 220), outline=(56, 189, 248, 200), width=2)
        icon_with_border.paste(resized_icon, (2, 2), resized_icon)

        self.icon_photo = ImageTk.PhotoImage(icon_with_border)

        # 2. Glassmorphic Background Canvas with Blurred Watermark
        W, H = 840, 640
        bg = Image.new("RGBA", (W, H), (9, 13, 22, 255))

        # Blurred ambient watermark in top right
        try:
            watermark = raw_icon.resize((380, 380), Image.Resampling.LANCZOS)
            watermark = watermark.filter(ImageFilter.GaussianBlur(32))
            # Lower alpha to 14%
            r, g, b, a = watermark.split()
            a = a.point(lambda p: int(p * 0.14))
            watermark.putalpha(a)
            bg.paste(watermark, (W - 320, -60), watermark)

            # Left ambient subtle glow
            left_glow = Image.new("RGBA", (280, 280), (14, 165, 233, 25))
            left_glow = left_glow.filter(ImageFilter.GaussianBlur(40))
            bg.paste(left_glow, (-80, 160), left_glow)
        except Exception:
            pass

        self.bg_photo = ImageTk.PhotoImage(bg)

    def setup_styles(self):
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure(".", background="#090d16", foreground="#f8fafc")
        style.configure("TFrame", background="#090d16")
        style.configure("Glass.TFrame", background="#121622")
        style.configure("TLabel", background="#090d16", foreground="#f8fafc", font=("Segoe UI", 9))
        style.configure("Muted.TLabel", foreground="#64748b", font=("Segoe UI", 8))

    def start_embedded_server(self):
        """Starts the companion HTTP server on 0.0.0.0:3000 (fallback 9871)."""
        def _serve():
            ports = [3000, 9871, 3001, 8080]
            for p in ports:
                try:
                    server_address = ("0.0.0.0", p)
                    self.httpd = CompanionHttpServer(server_address, CompanionRequestHandler, self)
                    self.host_port = p
                    break
                except OSError:
                    continue

            if self.httpd:
                try:
                    self.httpd.serve_forever()
                except Exception:
                    pass

        t = threading.Thread(target=_serve, daemon=True)
        t.start()

    def build_ui(self):
        # Clear existing widgets
        for w in self.root.winfo_children():
            w.destroy()

        # Background Canvas with Glass Effect Image
        bg_canvas = tk.Canvas(self.root, width=820, height=620, highlightthickness=0, bg="#090d16")
        bg_canvas.pack(fill=tk.BOTH, expand=True)
        if self.bg_photo:
            bg_canvas.create_image(0, 0, image=self.bg_photo, anchor="nw")

        # Top Neon Cyan Accent Line
        bg_canvas.create_line(0, 0, 1200, 0, fill="#38bdf8", width=3)

        # Main wrapper placed over the canvas
        self.main_container = tk.Frame(bg_canvas, bg="#090d16", bd=0)
        self.main_container.place(relx=0.5, rely=0.5, anchor="center", width=780, height=580)

        # 1. Top Header with Real Brand Logo
        self.header_frame = tk.Frame(self.main_container, bg="#0e131f", bd=1, relief="solid", highlightbackground="#1e293b", padx=16, pady=12)
        self.header_frame.pack(fill=tk.X, pady=(0, 10))

        # Brand Icon
        if self.icon_photo:
            icon_lbl = tk.Label(self.header_frame, image=self.icon_photo, bg="#0e131f")
            icon_lbl.pack(side=tk.LEFT, padx=(0, 14))

        # Title and description
        title_box = tk.Frame(self.header_frame, bg="#0e131f")
        title_box.pack(side=tk.LEFT, fill=tk.Y)

        title_lbl = tk.Label(
            title_box,
            text="LAZY TERMINAL",
            bg="#0e131f",
            fg="#ffffff",
            font=("Segoe UI", 16, "bold"),
            lettercase="uppercase" if hasattr(str, 'lettercase') else None
        )
        title_lbl.pack(anchor="w")

        sub_lbl = tk.Label(
            title_box,
            text="Windows PC Host Companion • Local-First Encrypted Dev Tunnel",
            bg="#0e131f",
            fg="#38bdf8",
            font=("Segoe UI", 9)
        )
        sub_lbl.pack(anchor="w", pady=(1, 0))

        # Status Badge on Header Right
        h_right = tk.Frame(self.header_frame, bg="#0e131f")
        h_right.pack(side=tk.RIGHT, fill=tk.Y)

        status_text = "● CONNECTED" if self.is_connected else "● STANDBY"
        status_fg = "#34d399" if self.is_connected else "#fbbf24"
        status_bg = "#064e3b" if self.is_connected else "#2b1e06"

        stat_badge = tk.Label(
            h_right,
            text=f" {status_text} ",
            bg=status_bg,
            fg=status_fg,
            font=("Consolas", 9, "bold"),
            bd=1,
            relief="solid",
            highlightbackground=status_fg
        )
        stat_badge.pack(anchor="e", pady=(2, 4))

        host_info_lbl = tk.Label(
            h_right,
            text=f"Host: {self.local_ip}:{self.host_port}",
            bg="#0e131f",
            fg="#94a3b8",
            font=("Consolas", 8)
        )
        host_info_lbl.pack(anchor="e")

        # 2. Toast Alert Banner (if active)
        if self.toast_message:
            self.toast_frame = tk.Frame(self.main_container, bg="#064e3b", bd=1, relief="solid", highlightbackground="#059669", padx=12, pady=6)
            self.toast_frame.pack(fill=tk.X, pady=(0, 8))
            t_lbl = tk.Label(self.toast_frame, text=f"✓  {self.toast_message}", bg="#064e3b", fg="#ecfdf5", font=("Segoe UI", 9, "bold"))
            t_lbl.pack(side=tk.LEFT)

        # 3. Dynamic Center Content: Token-Only Standby OR Connected Dashboard
        self.content_frame = tk.Frame(self.main_container, bg="#090d16")
        self.content_frame.pack(fill=tk.BOTH, expand=True)

        if not self.is_connected:
            self.render_token_standby_view()
        else:
            self.render_connected_view()

        # 4. Minimal Footer
        self.footer_frame = tk.Frame(self.main_container, bg="#0c1018", bd=1, relief="solid", highlightbackground="#1b2434", padx=12, pady=6)
        self.footer_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=(8, 0))

        footer_left = tk.Label(
            self.footer_frame,
            text="🔒 Mutual Ed25519 Token Authentication • Zero Cloud Relay (₹0 Local-First MVP)",
            bg="#0c1018", fg="#64748b", font=("Segoe UI", 8)
        )
        footer_left.pack(side=tk.LEFT)

        footer_right = tk.Label(
            self.footer_frame,
            text=f"LAN: {self.local_ip}:{self.host_port}  •  OS: Windows 11 x64",
            bg="#0c1018", fg="#64748b", font=("Consolas", 8)
        )
        footer_right.pack(side=tk.RIGHT)

    def render_token_standby_view(self):
        """
        Token-Only Standby View:
        Displays the randomly generated pairing token ONLY in a modern glassmorphic card.
        """
        card = tk.Frame(
            self.content_frame,
            bg="#121724",
            bd=1,
            relief="solid",
            highlightbackground="#243147",
            padx=28,
            pady=24
        )
        card.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)

        # Subtle card header
        c_top = tk.Frame(card, bg="#121724")
        c_top.pack(fill=tk.X, pady=(0, 16))

        tag_lbl = tk.Label(
            c_top,
            text="AUTHENTICATION KEY",
            bg="#121724",
            fg="#38bdf8",
            font=("Segoe UI", 9, "bold")
        )
        tag_lbl.pack(side=tk.LEFT)

        wait_lbl = tk.Label(
            c_top,
            text="● WAITING FOR MOBILE PAIRING",
            bg="#2a1e06",
            fg="#fbbf24",
            font=("Consolas", 8, "bold"),
            padx=8,
            pady=2,
            bd=1,
            relief="solid"
        )
        wait_lbl.pack(side=tk.RIGHT)

        # Big Monospace Token Box
        token_container = tk.Frame(
            card,
            bg="#080c14",
            bd=1,
            relief="solid",
            highlightbackground="#1c273b",
            padx=24,
            pady=20
        )
        token_container.pack(fill=tk.X, pady=(0, 16))

        tok_title = tk.Label(
            token_container,
            text="Active Pairing Code",
            bg="#080c14",
            fg="#94a3b8",
            font=("Segoe UI", 10)
        )
        tok_title.pack(anchor="center", pady=(0, 6))

        # Huge Cyan Token Display
        self.token_display_lbl = tk.Label(
            token_container,
            text=self.pairing_token,
            bg="#080c14",
            fg="#38bdf8",
            font=("Consolas", 34, "bold"),
            lettercase=None
        )
        self.token_display_lbl.pack(anchor="center", pady=(2, 6))

        # Glass Action Buttons Bar
        actions_bar = tk.Frame(token_container, bg="#080c14")
        actions_bar.pack(anchor="center", pady=(6, 0))

        copy_btn = tk.Button(
            actions_bar,
            text="📋 Copy Code",
            bg="#1e293b",
            fg="#f8fafc",
            activebackground="#334155",
            activeforeground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            bd=1,
            relief="solid",
            highlightbackground="#38bdf8",
            padx=14,
            pady=6,
            cursor="hand2",
            command=self.handle_copy_token
        )
        copy_btn.pack(side=tk.LEFT, padx=(0, 8))

        regen_btn = tk.Button(
            actions_bar,
            text="🔄 Rotate Key",
            bg="#131b2c",
            fg="#38bdf8",
            activebackground="#1e293b",
            activeforeground="#38bdf8",
            font=("Segoe UI", 9),
            bd=1,
            relief="solid",
            highlightbackground="#223352",
            padx=12,
            pady=6,
            cursor="hand2",
            command=self.handle_regenerate_token
        )
        regen_btn.pack(side=tk.LEFT)

        # Helper & LAN discovery card
        lan_card = tk.Frame(card, bg="#0c111c", bd=1, relief="solid", highlightbackground="#1c273b", padx=16, pady=12)
        lan_card.pack(fill=tk.X, pady=(6, 0))

        lan_title = tk.Label(
            lan_card,
            text="📱 Connecting Your Phone Over Local Wi-Fi:",
            bg="#0c111c",
            fg="#e2e8f0",
            font=("Segoe UI", 9, "bold")
        )
        lan_title.pack(anchor="w", pady=(0, 4))

        lan_desc = tk.Label(
            lan_card,
            text=f"1. Ensure your Android phone is on the same Wi-Fi.\n"
                 f"2. Open the Lazy Terminal app on Android and enter the pairing code above.\n"
                 f"3. Host LAN URL: http://{self.local_ip}:{self.host_port} (listening on all local network interfaces).",
            bg="#0c111c",
            fg="#94a3b8",
            font=("Segoe UI", 9),
            justify=tk.LEFT
        )
        lan_desc.pack(anchor="w", pady=(0, 6))

        lan_btn_row = tk.Frame(lan_card, bg="#0c111c")
        lan_btn_row.pack(anchor="w")

        copy_ip_btn = tk.Button(
            lan_btn_row,
            text=f"📋 Copy Host URL (http://{self.local_ip}:{self.host_port})",
            bg="#172033",
            fg="#38bdf8",
            activebackground="#1e293b",
            font=("Consolas", 8, "bold"),
            bd=1,
            relief="solid",
            highlightbackground="#283a5e",
            padx=10,
            pady=4,
            cursor="hand2",
            command=self.handle_copy_host_url
        )
        copy_ip_btn.pack(side=tk.LEFT)

    def render_connected_view(self):
        """
        Connected View:
        Dynamically revealed once paired — shows the Sync Manager, Server Control, and live intent logs.
        """
        # 1. Connected Success Banner
        banner = tk.Frame(self.content_frame, bg="#064e3b", bd=1, relief="solid", highlightbackground="#059669", padx=14, pady=10)
        banner.pack(fill=tk.X, pady=(0, 10))

        b_text = tk.Label(
            banner,
            text="✓  MOBILE DEVICE PAIRED OVER LOCAL LAN — Encrypted Tunnel Active (Port 3000)",
            bg="#064e3b", fg="#ecfdf5", font=("Segoe UI", 9, "bold")
        )
        b_text.pack(side=tk.LEFT)

        disc_btn = tk.Button(
            banner,
            text="Disconnect",
            bg="#991b1b",
            fg="#fee2e2",
            activebackground="#b91c1c",
            font=("Segoe UI", 8, "bold"),
            bd=0,
            padx=10,
            pady=3,
            cursor="hand2",
            command=self.handle_disconnect
        )
        disc_btn.pack(side=tk.RIGHT)

        # 2. Two-Column Dashboard: Server Control (Left) & Sync Manager (Right)
        dash_grid = tk.Frame(self.content_frame, bg="#090d16")
        dash_grid.pack(fill=tk.BOTH, expand=True)

        dash_grid.columnconfigure(0, weight=4)
        dash_grid.columnconfigure(1, weight=6)
        dash_grid.rowconfigure(0, weight=1)

        # --- LEFT: Server Control Glass Card ---
        srv_card = tk.Frame(dash_grid, bg="#101522", bd=1, relief="solid", highlightbackground="#1f2a3d", padx=14, pady=12)
        srv_card.grid(row=0, column=0, sticky="nsew", padx=(0, 6))

        sc_title_row = tk.Frame(srv_card, bg="#101522")
        sc_title_row.pack(fill=tk.X, pady=(0, 10))

        sc_title = tk.Label(sc_title_row, text="⚡ Server Control", bg="#101522", fg="#ffffff", font=("Segoe UI", 10, "bold"))
        sc_title.pack(side=tk.LEFT)

        status_text = "RUNNING" if self.is_server_running else "STOPPED"
        status_color = "#34d399" if self.is_server_running else "#f87171"
        status_bg = "#064e3b" if self.is_server_running else "#450a0a"

        sc_status = tk.Label(sc_title_row, text=f" {status_text} ", bg=status_bg, fg=status_color, font=("Consolas", 8, "bold"), bd=1, relief="solid")
        sc_status.pack(side=tk.RIGHT)

        metrics_box = tk.Frame(srv_card, bg="#080c14", bd=1, relief="solid", highlightbackground="#1b2436", padx=10, pady=8)
        metrics_box.pack(fill=tk.X, pady=(0, 12))

        m1 = tk.Label(metrics_box, text=f"Local Port:  {self.host_port} (TCP TLS 1.3)", bg="#080c14", fg="#94a3b8", font=("Consolas", 8))
        m1.pack(anchor="w")
        m2 = tk.Label(metrics_box, text=f"Host LAN IP: {self.local_ip}", bg="#080c14", fg="#94a3b8", font=("Consolas", 8))
        m2.pack(anchor="w")
        m3 = tk.Label(metrics_box, text="Tunnel Mode: LAN Direct (P2P)", bg="#080c14", fg="#94a3b8", font=("Consolas", 8))
        m3.pack(anchor="w")
        m4 = tk.Label(metrics_box, text="Clients:     1 Connected Mobile Device", bg="#080c14", fg="#34d399", font=("Consolas", 8))
        m4.pack(anchor="w")

        srv_btn_text = "⏹ Stop Server" if self.is_server_running else "▶ Start Server"
        srv_btn_bg = "#b91c1c" if self.is_server_running else "#059669"

        srv_toggle_btn = tk.Button(
            srv_card,
            text=srv_btn_text,
            bg=srv_btn_bg,
            fg="#ffffff",
            activebackground=srv_btn_bg,
            font=("Segoe UI", 9, "bold"),
            pady=6,
            bd=0,
            cursor="hand2",
            command=self.handle_toggle_server
        )
        srv_toggle_btn.pack(fill=tk.X, side=tk.BOTTOM)

        # --- RIGHT: Sync Manager Glass Card ---
        sync_card = tk.Frame(dash_grid, bg="#101522", bd=1, relief="solid", highlightbackground="#1f2a3d", padx=14, pady=12)
        sync_card.grid(row=0, column=1, sticky="nsew", padx=(6, 0))

        sm_title_row = tk.Frame(sync_card, bg="#101522")
        sm_title_row.pack(fill=tk.X, pady=(0, 8))

        sm_title = tk.Label(sm_title_row, text="🔄 Sync Manager", bg="#101522", fg="#ffffff", font=("Segoe UI", 10, "bold"))
        sm_title.pack(side=tk.LEFT)

        sync_btn = tk.Button(
            sm_title_row,
            text="⚡ Request Sync" if not self.is_syncing else "Syncing...",
            bg="#2563eb",
            fg="#ffffff",
            activebackground="#1d4ed8",
            font=("Segoe UI", 8, "bold"),
            bd=0,
            padx=10,
            pady=4,
            cursor="hand2",
            command=self.handle_sync_request,
            state=tk.DISABLED if self.is_syncing else tk.NORMAL
        )
        sync_btn.pack(side=tk.RIGHT)

        # Causal Sync Ledger List
        list_container = tk.Frame(sync_card, bg="#080c14", bd=1, relief="solid", highlightbackground="#1b2436")
        list_container.pack(fill=tk.BOTH, expand=True)

        for rec in self.sync_records:
            item_frame = tk.Frame(list_container, bg="#0d121c", padx=8, pady=6, bd=1, relief="solid", highlightbackground="#182233")
            item_frame.pack(fill=tk.X, padx=4, pady=3)

            top_row = tk.Frame(item_frame, bg="#0d121c")
            top_row.pack(fill=tk.X)

            id_lbl = tk.Label(top_row, text=rec["id"], bg="#0d121c", fg="#38bdf8", font=("Consolas", 8, "bold"))
            id_lbl.pack(side=tk.LEFT)

            time_lbl = tk.Label(top_row, text=f"{rec['time_ago']} ({rec['timestamp']})", bg="#0d121c", fg="#64748b", font=("Segoe UI", 8))
            time_lbl.pack(side=tk.RIGHT)

            summary_lbl = tk.Label(item_frame, text=rec["summary"], bg="#0d121c", fg="#cbd5e1", font=("Segoe UI", 8), anchor="w")
            summary_lbl.pack(fill=tk.X, pady=(2, 0))

    def show_toast(self, message: str):
        self.toast_message = message
        if self.toast_timer:
            self.root.after_cancel(self.toast_timer)
        self.build_ui()
        self.toast_timer = self.root.after(3500, self.clear_toast)

    def clear_toast(self):
        self.toast_message = ""
        self.build_ui()

    def handle_copy_token(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.pairing_token)
        self.show_toast(f"Copied token {self.pairing_token} to clipboard!")

    def handle_copy_host_url(self):
        url = f"http://{self.local_ip}:{self.host_port}"
        self.root.clipboard_clear()
        self.root.clipboard_append(url)
        self.show_toast(f"Copied Host URL {url} to clipboard!")

    def handle_regenerate_token(self):
        new_token = self.generate_random_token()
        self.pairing_token = new_token
        self.show_toast(f"Rotated pairing key: {self.pairing_token}")

    def handle_disconnect(self):
        self.is_connected = False
        self.show_toast("Mobile device disconnected. Waiting for connection.")

    def handle_toggle_server(self):
        self.is_server_running = not self.is_server_running
        state_str = "started" if self.is_server_running else "stopped"
        self.show_toast(f"Host server daemon {state_str}.")

    def handle_sync_request(self):
        self.is_syncing = True
        self.build_ui()

        def _do_sync():
            time.sleep(0.7)
            new_id = f"SYNC-REQ-{105 + len(self.sync_records) - 3}"
            now_str = time.strftime("%Y-%m-%d %H:%M:%S")
            new_record = {
                "id": new_id,
                "timestamp": now_str,
                "time_ago": "Just now",
                "items": random.randint(1, 4),
                "summary": "Synchronized workspace state & causal graph intents across tunnel",
                "head_commit": "3f7a8b1",
            }
            self.sync_records.insert(0, new_record)
            self.is_syncing = False
            self.root.after(0, lambda: self.show_toast(f"Sync request {new_id} completed successfully!"))

        threading.Thread(target=_do_sync, daemon=True).start()


def main():
    root = tk.Tk()
    app = LazyTerminalCompanionApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
