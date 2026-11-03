"""
Lazy Terminal — Windows PC Companion Desktop Application (Tkinter Glass Effect Theme)

Delegates all HTTP / PTY / Filesystem / Git / AI CLI operations to the real
Windows Host Companion (`src/host/companionServer.ts`) so pairing, PowerShell,
Explorer, Git, and CLI sessions share one authenticated host runtime.
"""

import argparse
import atexit
import ctypes
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

try:
    import tkinter as tk
    from tkinter import ttk
except Exception:
    tk = None
    ttk = None

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageTk
except Exception:
    Image = None
    ImageDraw = None
    ImageFilter = None
    ImageTk = None


def get_repo_root():
    if "__file__" in globals():
        return os.path.dirname(os.path.abspath(__file__))
    return os.getcwd()


def get_resource_path(relative_path):
    if hasattr(sys, "_MEIPASS"):
        p = os.path.join(sys._MEIPASS, relative_path)
        if os.path.exists(p):
            return p
    candidate = os.path.join(get_repo_root(), relative_path)
    if os.path.exists(candidate):
        return candidate
    if os.path.exists(relative_path):
        return os.path.abspath(relative_path)
    return None


def enable_windows_dark_titlebar(window):
    try:
        window.update()
        hwnd = ctypes.windll.user32.GetParent(window.winfo_id()) or window.winfo_id()
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
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def is_port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


def local_api_json(port: int, path: str, method: str = "GET", payload: dict = None, timeout: float = 3.0):
    url = f"http://127.0.0.1:{port}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


class HostBackendProcessManager:
    """Starts and manages the real Node/TypeScript Windows Host Companion."""

    def __init__(self, preferred_port: int = 3000):
        self.preferred_port = preferred_port
        self.port = preferred_port
        self.proc = None
        self.owns_process = False
        atexit.register(self.stop)

    def start(self) -> int:
        # Reuse already-running Lazy Terminal host companion if listening on preferred_port
        try:
            health = local_api_json(self.preferred_port, "/health", timeout=1.0)
            if health.get("status") == "ok" and health.get("service") == "lazy-terminal-host-companion":
                self.port = self.preferred_port
                self.owns_process = False
                return self.port
        except Exception:
            pass

        candidate_ports = [self.preferred_port, 9871, 3000, 3001, 8080]
        chosen_port = None
        for p in dict.fromkeys(candidate_ports):
            if is_port_free(p):
                chosen_port = p
                break
        if chosen_port is None:
            raise RuntimeError("No available TCP port found for Lazy Terminal Host Companion.")

        self.port = chosen_port
        repo_root = get_repo_root()
        node_bin = shutil.which("node") or "node"
        companion_entry = os.path.join(repo_root, "src", "host", "companionServer.ts")

        env = os.environ.copy()
        env["LAZY_TERMINAL_HOST_PORT"] = str(self.port)
        env["LAZY_TERMINAL_HOST_BIND"] = env.get("LAZY_TERMINAL_HOST_BIND", "0.0.0.0")

        creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" and hasattr(subprocess, "CREATE_NO_WINDOW") else 0

        self.proc = subprocess.Popen(
            [node_bin, "--import", "tsx", companion_entry],
            cwd=repo_root,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            creationflags=creationflags,
        )
        self.owns_process = True

        # Drain stdout in background so pipe never blocks
        def _drain():
            if not self.proc or not self.proc.stdout:
                return
            for line in self.proc.stdout:
                sys.stdout.write(line)
                sys.stdout.flush()

        threading.Thread(target=_drain, daemon=True).start()

        # Wait until /health responds
        deadline = time.time() + 15.0
        while time.time() < deadline:
            if self.proc.poll() is not None:
                raise RuntimeError(f"Host companion exited prematurely with code {self.proc.returncode}")
            try:
                health = local_api_json(self.port, "/health", timeout=1.0)
                if health.get("status") == "ok":
                    return self.port
            except Exception:
                time.sleep(0.25)

        raise RuntimeError(f"Timed out waiting for Windows Host Companion on port {self.port}")

    def stop(self):
        if not self.owns_process or not self.proc:
            return
        proc = self.proc
        self.proc = None
        if proc.poll() is None:
            try:
                if os.name == "nt":
                    subprocess.run(
                        ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        check=False,
                    )
                else:
                    proc.terminate()
            except Exception:
                pass


class LazyTerminalCompanionApp:
    def __init__(self, root, backend_manager: HostBackendProcessManager):
        self.root = root
        self.backend = backend_manager
        self.root.title("Lazy Terminal — Windows PC Host Companion")
        self.root.geometry("820x620")
        self.root.minsize(760, 560)
        self.root.configure(bg="#090d16")
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        enable_windows_dark_titlebar(self.root)

        self.hostname = socket.gethostname()
        self.local_ip = get_local_ip()
        self.host_port = self.backend.port
        self.pairing_token = "--- ---"
        self.active_workspace = os.getcwd()
        self.is_connected = False
        self.is_server_running = True
        self.intents_processed = 0
        self.toast_message = ""
        self.toast_timer = None

        self.icon_photo = None
        self.bg_photo = None
        self.prepare_images()
        self.setup_styles()

        self.main_container = None
        self.header_frame = None
        self.toast_frame = None
        self.content_frame = None
        self.footer_frame = None

        self.refresh_from_backend(initial=True)
        self.build_ui()
        self.schedule_poll()

    def on_close(self):
        self.backend.stop()
        self.root.destroy()

    def prepare_images(self):
        if Image is None or ImageTk is None:
            return
        icon_path = get_resource_path("icon.jpeg") or get_resource_path("public/downloads/icon.jpeg")
        raw_icon = None
        if icon_path and os.path.exists(icon_path):
            try:
                raw_icon = Image.open(icon_path).convert("RGBA")
            except Exception:
                raw_icon = None

        if raw_icon is None:
            raw_icon = Image.new("RGBA", (192, 192), (37, 99, 235, 255))
            d = ImageDraw.Draw(raw_icon)
            d.rectangle([(20, 20), (172, 172)], fill=(56, 189, 248, 255))

        icon_size = (72, 72)
        resized_icon = raw_icon.resize(icon_size, Image.Resampling.LANCZOS)
        mask = Image.new("L", icon_size, 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle([(0, 0), icon_size], radius=16, fill=255)
        resized_icon.putalpha(mask)

        icon_with_border = Image.new("RGBA", (76, 76), (0, 0, 0, 0))
        border_draw = ImageDraw.Draw(icon_with_border)
        border_draw.rounded_rectangle(
            [(0, 0), (75, 75)],
            radius=18,
            fill=(30, 41, 59, 220),
            outline=(56, 189, 248, 200),
            width=2,
        )
        icon_with_border.paste(resized_icon, (2, 2), resized_icon)
        self.icon_photo = ImageTk.PhotoImage(icon_with_border)

        W, H = 840, 640
        bg = Image.new("RGBA", (W, H), (9, 13, 22, 255))
        try:
            watermark = raw_icon.resize((380, 380), Image.Resampling.LANCZOS)
            watermark = watermark.filter(ImageFilter.GaussianBlur(32))
            r, g, b, a = watermark.split()
            a = a.point(lambda p: int(p * 0.14))
            watermark.putalpha(a)
            bg.paste(watermark, (W - 320, -60), watermark)

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

    def refresh_from_backend(self, initial: bool = False):
        changed = False
        try:
            status = local_api_json(self.host_port, "/api/v1/host/local-status", timeout=1.5)
            new_token = status.get("pairingToken") or self.pairing_token
            new_running = status.get("backendServerStatus") == "running"
            new_connected = status.get("tunnelStatus") == "active"
            new_ws = status.get("activeWorkspaceRoot") or self.active_workspace
            new_count = int(status.get("totalIntentsProcessed") or 0)

            if (
                new_token != self.pairing_token
                or new_running != self.is_server_running
                or new_connected != self.is_connected
                or new_ws != self.active_workspace
                or new_count != self.intents_processed
            ):
                changed = True
                self.pairing_token = new_token
                self.is_server_running = new_running
                self.is_connected = new_connected
                self.active_workspace = new_ws
                self.intents_processed = new_count
        except Exception:
            pass

        if changed and not initial:
            self.build_ui()

    def schedule_poll(self):
        self.refresh_from_backend()
        self.root.after(1500, self.schedule_poll)

    def build_ui(self):
        for w in self.root.winfo_children():
            w.destroy()

        bg_canvas = tk.Canvas(self.root, width=820, height=620, highlightthickness=0, bg="#090d16")
        bg_canvas.pack(fill=tk.BOTH, expand=True)
        if self.bg_photo:
            bg_canvas.create_image(0, 0, image=self.bg_photo, anchor="nw")
        bg_canvas.create_line(0, 0, 1200, 0, fill="#38bdf8", width=3)

        self.main_container = tk.Frame(bg_canvas, bg="#090d16", bd=0)
        self.main_container.place(relx=0.5, rely=0.5, anchor="center", width=780, height=580)

        self.header_frame = tk.Frame(
            self.main_container, bg="#0e131f", bd=1, relief="solid", highlightbackground="#1e293b", padx=16, pady=12
        )
        self.header_frame.pack(fill=tk.X, pady=(0, 10))

        if self.icon_photo:
            icon_lbl = tk.Label(self.header_frame, image=self.icon_photo, bg="#0e131f")
            icon_lbl.pack(side=tk.LEFT, padx=(0, 14))

        title_box = tk.Frame(self.header_frame, bg="#0e131f")
        title_box.pack(side=tk.LEFT, fill=tk.Y)

        tk.Label(
            title_box, text="LAZY TERMINAL", bg="#0e131f", fg="#ffffff", font=("Segoe UI", 16, "bold")
        ).pack(anchor="w")
        tk.Label(
            title_box,
            text="Windows PC Host Companion • Local-First Authenticated Dev Host",
            bg="#0e131f",
            fg="#38bdf8",
            font=("Segoe UI", 9),
        ).pack(anchor="w", pady=(1, 0))

        h_right = tk.Frame(self.header_frame, bg="#0e131f")
        h_right.pack(side=tk.RIGHT, fill=tk.Y)

        status_text = "● CONNECTED" if self.is_connected else "● STANDBY"
        status_fg = "#34d399" if self.is_connected else "#fbbf24"
        status_bg = "#064e3b" if self.is_connected else "#2b1e06"

        tk.Label(
            h_right,
            text=f" {status_text} ",
            bg=status_bg,
            fg=status_fg,
            font=("Consolas", 9, "bold"),
            bd=1,
            relief="solid",
            highlightbackground=status_fg,
        ).pack(anchor="e", pady=(2, 4))

        tk.Label(
            h_right,
            text=f"Host: {self.local_ip}:{self.host_port}",
            bg="#0e131f",
            fg="#94a3b8",
            font=("Consolas", 8),
        ).pack(anchor="e")

        if self.toast_message:
            self.toast_frame = tk.Frame(
                self.main_container, bg="#064e3b", bd=1, relief="solid", highlightbackground="#059669", padx=12, pady=6
            )
            self.toast_frame.pack(fill=tk.X, pady=(0, 8))
            tk.Label(
                self.toast_frame,
                text=f"✓  {self.toast_message}",
                bg="#064e3b",
                fg="#ecfdf5",
                font=("Segoe UI", 9, "bold"),
            ).pack(side=tk.LEFT)

        self.content_frame = tk.Frame(self.main_container, bg="#090d16")
        self.content_frame.pack(fill=tk.BOTH, expand=True)

        if not self.is_connected:
            self.render_token_standby_view()
        else:
            self.render_connected_view()

        self.footer_frame = tk.Frame(
            self.main_container, bg="#0c1018", bd=1, relief="solid", highlightbackground="#1b2434", padx=12, pady=6
        )
        self.footer_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=(8, 0))

        tk.Label(
            self.footer_frame,
            text=f"Workspace: {self.active_workspace}",
            bg="#0c1018",
            fg="#64748b",
            font=("Consolas", 8),
        ).pack(side=tk.LEFT)

        tk.Label(
            self.footer_frame,
            text=f"LAN: {self.local_ip}:{self.host_port}  •  Host: {self.hostname}",
            bg="#0c1018",
            fg="#64748b",
            font=("Consolas", 8),
        ).pack(side=tk.RIGHT)

    def render_token_standby_view(self):
        card = tk.Frame(
            self.content_frame, bg="#121724", bd=1, relief="solid", highlightbackground="#243147", padx=28, pady=24
        )
        card.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)

        c_top = tk.Frame(card, bg="#121724")
        c_top.pack(fill=tk.X, pady=(0, 16))

        tk.Label(
            c_top, text="AUTHENTICATION KEY", bg="#121724", fg="#38bdf8", font=("Segoe UI", 9, "bold")
        ).pack(side=tk.LEFT)

        tk.Label(
            c_top,
            text="● WAITING FOR MOBILE PAIRING",
            bg="#2a1e06",
            fg="#fbbf24",
            font=("Consolas", 8, "bold"),
            padx=8,
            pady=2,
            bd=1,
            relief="solid",
        ).pack(side=tk.RIGHT)

        token_container = tk.Frame(
            card, bg="#080c14", bd=1, relief="solid", highlightbackground="#1c273b", padx=24, pady=20
        )
        token_container.pack(fill=tk.X, pady=(0, 16))

        tk.Label(
            token_container, text="Active Pairing Code", bg="#080c14", fg="#94a3b8", font=("Segoe UI", 10)
        ).pack(anchor="center", pady=(0, 6))

        tk.Label(
            token_container,
            text=self.pairing_token,
            bg="#080c14",
            fg="#38bdf8",
            font=("Consolas", 34, "bold"),
        ).pack(anchor="center", pady=(2, 6))

        actions_bar = tk.Frame(token_container, bg="#080c14")
        actions_bar.pack(anchor="center", pady=(6, 0))

        tk.Button(
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
            command=self.handle_copy_token,
        ).pack(side=tk.LEFT, padx=(0, 8))

        tk.Button(
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
            command=self.handle_regenerate_token,
        ).pack(side=tk.LEFT)

        lan_card = tk.Frame(
            card, bg="#0c111c", bd=1, relief="solid", highlightbackground="#1c273b", padx=16, pady=12
        )
        lan_card.pack(fill=tk.X, pady=(6, 0))

        tk.Label(
            lan_card,
            text="📱 Connecting Your Phone Over Local Wi-Fi:",
            bg="#0c111c",
            fg="#e2e8f0",
            font=("Segoe UI", 9, "bold"),
        ).pack(anchor="w", pady=(0, 4))

        tk.Label(
            lan_card,
            text=(
                "1. Ensure your Android phone is on the same Wi-Fi.\n"
                "2. Open Lazy Terminal on Android, set Host URL below, and enter the pairing code.\n"
                f"3. Host LAN URL: http://{self.local_ip}:{self.host_port}"
            ),
            bg="#0c111c",
            fg="#94a3b8",
            font=("Segoe UI", 9),
            justify=tk.LEFT,
        ).pack(anchor="w", pady=(0, 6))

        tk.Button(
            lan_card,
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
            command=self.handle_copy_host_url,
        ).pack(anchor="w")

    def render_connected_view(self):
        banner = tk.Frame(
            self.content_frame, bg="#064e3b", bd=1, relief="solid", highlightbackground="#059669", padx=14, pady=10
        )
        banner.pack(fill=tk.X, pady=(0, 10))

        tk.Label(
            banner,
            text=f"✓  MOBILE DEVICE PAIRED OVER LOCAL LAN — Port {self.host_port}",
            bg="#064e3b",
            fg="#ecfdf5",
            font=("Segoe UI", 9, "bold"),
        ).pack(side=tk.LEFT)

        tk.Button(
            banner,
            text="Rotate Key & Disconnect",
            bg="#991b1b",
            fg="#fee2e2",
            activebackground="#b91c1c",
            font=("Segoe UI", 8, "bold"),
            bd=0,
            padx=10,
            pady=3,
            cursor="hand2",
            command=self.handle_disconnect,
        ).pack(side=tk.RIGHT)

        srv_card = tk.Frame(
            self.content_frame, bg="#101522", bd=1, relief="solid", highlightbackground="#1f2a3d", padx=16, pady=14
        )
        srv_card.pack(fill=tk.BOTH, expand=True)

        sc_title_row = tk.Frame(srv_card, bg="#101522")
        sc_title_row.pack(fill=tk.X, pady=(0, 10))

        tk.Label(
            sc_title_row, text="⚡ Live Host Runtime Status", bg="#101522", fg="#ffffff", font=("Segoe UI", 10, "bold")
        ).pack(side=tk.LEFT)

        status_text = "RUNNING" if self.is_server_running else "STOPPED"
        status_color = "#34d399" if self.is_server_running else "#f87171"
        status_bg = "#064e3b" if self.is_server_running else "#450a0a"

        tk.Label(
            sc_title_row,
            text=f" {status_text} ",
            bg=status_bg,
            fg=status_color,
            font=("Consolas", 8, "bold"),
            bd=1,
            relief="solid",
        ).pack(side=tk.RIGHT)

        metrics_box = tk.Frame(
            srv_card, bg="#080c14", bd=1, relief="solid", highlightbackground="#1b2436", padx=12, pady=10
        )
        metrics_box.pack(fill=tk.X, pady=(0, 12))

        tk.Label(
            metrics_box,
            text=f"Host Endpoint:     http://{self.local_ip}:{self.host_port}",
            bg="#080c14",
            fg="#94a3b8",
            font=("Consolas", 9),
        ).pack(anchor="w")
        tk.Label(
            metrics_box,
            text=f"Active Workspace:  {self.active_workspace}",
            bg="#080c14",
            fg="#38bdf8",
            font=("Consolas", 9),
        ).pack(anchor="w")
        tk.Label(
            metrics_box,
            text=f"Commands Executed: {self.intents_processed}",
            bg="#080c14",
            fg="#34d399",
            font=("Consolas", 9),
        ).pack(anchor="w")

        srv_btn_text = "⏹ Stop Host Service" if self.is_server_running else "▶ Start Host Service"
        srv_btn_bg = "#b91c1c" if self.is_server_running else "#059669"

        tk.Button(
            srv_card,
            text=srv_btn_text,
            bg=srv_btn_bg,
            fg="#ffffff",
            activebackground=srv_btn_bg,
            font=("Segoe UI", 9, "bold"),
            pady=6,
            bd=0,
            cursor="hand2",
            command=self.handle_toggle_server,
        ).pack(fill=tk.X, side=tk.BOTTOM)

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
        self.show_toast(f"Copied pairing code {self.pairing_token} to clipboard!")

    def handle_copy_host_url(self):
        url = f"http://{self.local_ip}:{self.host_port}"
        self.root.clipboard_clear()
        self.root.clipboard_append(url)
        self.show_toast(f"Copied Host URL {url} to clipboard!")

    def handle_regenerate_token(self):
        try:
            res = local_api_json(self.host_port, "/api/v1/pairing/generate", method="POST", payload={})
            self.pairing_token = res.get("pairingKey") or self.pairing_token
            self.show_toast(f"Rotated pairing key: {self.pairing_token}")
        except Exception as err:
            self.show_toast(f"Failed to rotate key: {err}")

    def handle_disconnect(self):
        try:
            local_api_json(
                self.host_port, "/api/v1/host/daemon/control", method="POST", payload={"status": "restart"}
            )
            self.refresh_from_backend()
            self.show_toast("Disconnected active session and rotated pairing code.")
        except Exception as err:
            self.show_toast(f"Failed to disconnect session: {err}")

    def handle_toggle_server(self):
        action = "stop" if self.is_server_running else "start"
        try:
            local_api_json(
                self.host_port, "/api/v1/host/daemon/control", method="POST", payload={"status": action}
            )
            self.refresh_from_backend()
            self.show_toast(f"Host companion service {action}ped.")
        except Exception as err:
            self.show_toast(f"Control error: {err}")


def main():
    parser = argparse.ArgumentParser(description="Lazy Terminal Windows PC Companion")
    parser.add_argument("--headless", action="store_true", help="Run without Tkinter desktop window")
    parser.add_argument("--port", type=int, default=int(os.environ.get("LAZY_TERMINAL_HOST_PORT", "3000")), help="Host port")
    args = parser.parse_args()

    backend = HostBackendProcessManager(preferred_port=args.port)
    port = backend.start()

    if args.headless or tk is None:
        key_info = local_api_json(port, "/api/v1/pairing/key")
        print(
            f"[LazyTerminalCompanion] Headless mode active on http://0.0.0.0:{port} "
            f"(LAN: http://{get_local_ip()}:{port}, Pairing Key: {key_info.get('pairingKey')})",
            flush=True,
        )
        stop_event = threading.Event()

        def _sig_handler(_signum, _frame):
            stop_event.set()

        signal.signal(signal.SIGINT, _sig_handler)
        signal.signal(signal.SIGTERM, _sig_handler)
        try:
            while not stop_event.is_set():
                time.sleep(0.5)
        finally:
            backend.stop()
        return

    root = tk.Tk()
    LazyTerminalCompanionApp(root, backend)
    root.mainloop()


if __name__ == "__main__":
    main()
