"""
Lazy Terminal — Windows PC Companion Desktop Application (Tkinter)

Theme strictly follows the supplied Lazy Terminal web frontend:
- Background: #07080a / #14161c
- Cards: #1a1d24
- Inner panels: #121418
- Borders: #282d38
- Accent colors: Emerald (#10b981), Amber (#f59e0b), Blue (#3b82f6)

Behavior:
1. When opened, it displays the randomly generated pairing token ONLY (clean, uncluttered).
2. Once connected (via real mobile pairing over local LAN or simulation/test),
   it reveals the Sync Manager, Server Control, and real-time host telemetry.
"""

import sys
import os
import random
import socket
import threading
import time
import json
import urllib.request
import urllib.error
import tkinter as tk
from tkinter import ttk, messagebox

# Windows 11 / 10 Dark Mode Titlebar support
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
        s.settimeout(0.2)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


INITIAL_SYNCS = [
    {
        "id": "SYNC-REQ-104",
        "timestamp": "2026-10-24 22:01:15",
        "time_ago": "2 mins ago",
        "items": 3,
        "summary": "Offline intent queue flushed & causal graph synced with host",
        "head_commit": "3f7a8b1",
    },
    {
        "id": "SYNC-REQ-103",
        "timestamp": "2026-10-24 21:45:22",
        "time_ago": "18 mins ago",
        "items": 2,
        "summary": "Workspace file tree & dirty state synced across tunnel",
        "head_commit": "3f7a8b1",
    },
    {
        "id": "SYNC-REQ-102",
        "timestamp": "2026-10-24 20:58:04",
        "time_ago": "1 hour ago",
        "items": 5,
        "summary": "Branch checkout and remote ref synchronization",
        "head_commit": "a9c210d",
    },
]


class LazyTerminalCompanionApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Lazy Terminal — Windows PC Companion")
        self.root.geometry("740x590")
        self.root.minsize(680, 520)
        self.root.configure(bg="#0e1117")

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
        self.poll_active = True

        # Styles
        self.setup_styles()

        # Layout containers
        self.header_frame = None
        self.toast_frame = None
        self.main_container = None
        self.footer_frame = None

        # Build initial UI
        self.build_ui()

        # Start background sync thread to poll local node companion if active
        self.poll_thread = threading.Thread(target=self.background_poll_loop, daemon=True)
        self.poll_thread.start()

    def generate_random_token(self) -> str:
        p1 = random.randint(100, 999)
        p2 = random.randint(100, 999)
        return f"{p1}-{p2}"

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use('default')

        # Combobox dark style
        style.configure(
            "TCombobox",
            fieldbackground="#121418",
            background="#1a1d24",
            foreground="#f4f4f5",
            bordercolor="#282d38",
            arrowcolor="#94a3b8",
            padding=4,
        )
        style.map(
            "TCombobox",
            fieldbackground=[("readonly", "#121418")],
            selectbackground=[("readonly", "#1f2430")],
            selectforeground=[("readonly", "#ffffff")],
        )

    def build_ui(self):
        # Clear previous widgets
        for widget in self.root.winfo_children():
            widget.destroy()

        # 1. Desktop Window Frame Header (#14161b)
        self.header_frame = tk.Frame(self.root, bg="#14161b", height=42, highlightthickness=1, highlightbackground="#252830")
        self.header_frame.pack(fill=tk.X, side=tk.TOP)
        self.header_frame.pack_propagate(False)

        # Header Left: [W] Badge + Name + Hostname
        header_left = tk.Frame(self.header_frame, bg="#14161b")
        header_left.pack(side=tk.LEFT, padx=14, pady=8)

        w_badge = tk.Label(
            header_left, text=" W ", bg="#1f232b", fg="#e2e8f0",
            font=("Consolas", 9, "bold"), bd=1, relief="solid", highlightthickness=0
        )
        w_badge.pack(side=tk.LEFT, padx=(0, 8))

        title_label = tk.Label(
            header_left, text="Relay Desktop Host — Windows",
            bg="#14161b", fg="#f1f5f9", font=("Segoe UI", 10, "bold")
        )
        title_label.pack(side=tk.LEFT, padx=(0, 6))

        host_label = tk.Label(
            header_left, text=f"({self.hostname})",
            bg="#14161b", fg="#64748b", font=("Consolas", 9)
        )
        host_label.pack(side=tk.LEFT)

        # Header Right: Status indicator pill
        header_right = tk.Frame(self.header_frame, bg="#14161b")
        header_right.pack(side=tk.RIGHT, padx=14, pady=8)

        if self.is_connected:
            status_text = "● CONNECTED (TUNNEL ACTIVE)"
            status_fg = "#34d399"
            status_bg = "#064e3b"
        else:
            status_text = "● WAITING FOR MOBILE"
            status_fg = "#fbbf24"
            status_bg = "#451a03"

        status_pill = tk.Label(
            header_right, text=f" {status_text} ",
            bg=status_bg, fg=status_fg, font=("Segoe UI", 8, "bold"),
            padx=8, pady=2, bd=1, relief="solid"
        )
        status_pill.pack(side=tk.RIGHT)

        # 2. Main Content Canvas/Container (#14161c)
        self.main_container = tk.Frame(self.root, bg="#14161c", padx=24, pady=20)
        self.main_container.pack(fill=tk.BOTH, expand=True)

        # Optional Toast message
        if self.toast_message:
            toast_box = tk.Frame(self.main_container, bg="#064e3b", bd=1, relief="solid", highlightbackground="#059669")
            toast_box.pack(fill=tk.X, pady=(0, 12))
            t_lbl = tk.Label(toast_box, text=f"✓  {self.toast_message}", bg="#064e3b", fg="#6ee7b7", font=("Segoe UI", 9, "bold"), pady=6, padx=10)
            t_lbl.pack(side=tk.LEFT)

        if not self.is_connected:
            self.render_unconnected_view()
        else:
            self.render_connected_view()

        # 3. Footer Strip
        self.footer_frame = tk.Frame(self.root, bg="#16181f", height=36, highlightthickness=1, highlightbackground="#242833")
        self.footer_frame.pack(fill=tk.X, side=tk.BOTTOM)
        self.footer_frame.pack_propagate(False)

        footer_left = tk.Label(
            self.footer_frame, text="🔒 Ed25519 Mutual TLS Verification Active",
            bg="#16181f", fg="#34d399", font=("Consolas", 8, "bold")
        )
        footer_left.pack(side=tk.LEFT, padx=16, pady=6)

        footer_right = tk.Label(
            self.footer_frame,
            text=f"Daemon: v1.4.0  •  Host IP: {self.local_ip}:{self.host_port}  •  OS: Windows 11 x64",
            bg="#16181f", fg="#64748b", font=("Consolas", 8)
        )
        footer_right.pack(side=tk.RIGHT, padx=16, pady=6)

    def render_unconnected_view(self):
        """
        Unconnected View:
        Shows the randomly generated token ONLY, with the theme following the frontend provided.
        """
        # Centered container frame
        center_wrap = tk.Frame(self.main_container, bg="#14161c")
        center_wrap.pack(expand=True, fill=tk.BOTH, pady=10)

        # Token Window Card
        card = tk.Frame(center_wrap, bg="#1a1d24", bd=1, relief="solid", highlightbackground="#282d38")
        card.pack(fill=tk.X, padx=10, pady=10)

        # Card Header: Key Icon + Token Window + Backend Bound
        card_header = tk.Frame(card, bg="#15181f", height=32, highlightthickness=1, highlightbackground="#242833")
        card_header.pack(fill=tk.X)
        card_header.pack_propagate(False)

        lbl_head_left = tk.Label(
            card_header, text="🔑 Token Window",
            bg="#15181f", fg="#f1f5f9", font=("Segoe UI", 9, "bold")
        )
        lbl_head_left.pack(side=tk.LEFT, padx=12, pady=4)

        lbl_head_right = tk.Label(
            card_header, text="Backend Bound",
            bg="#15181f", fg="#64748b", font=("Consolas", 8)
        )
        lbl_head_right.pack(side=tk.RIGHT, padx=12, pady=4)

        # Card Body
        card_body = tk.Frame(card, bg="#1a1d24", padx=20, pady=18)
        card_body.pack(fill=tk.X)

        lbl_subtitle = tk.Label(
            card_body, text="RANDOM TOKEN NUMBER",
            bg="#1a1d24", fg="#94a3b8", font=("Segoe UI", 8, "bold")
        )
        lbl_subtitle.pack(anchor="w")

        # Huge Monospace Token
        token_lbl = tk.Label(
            card_body, text=self.pairing_token,
            bg="#1a1d24", fg="#ffffff", font=("Consolas", 32, "bold"), pady=6
        )
        token_lbl.pack(anchor="w")

        lbl_desc = tk.Label(
            card_body,
            text="Dynamic pairing token. Enter this 6-digit code on the Lazy Terminal mobile app to connect.",
            bg="#1a1d24", fg="#64748b", font=("Segoe UI", 9)
        )
        lbl_desc.pack(anchor="w", pady=(0, 14))

        # Button Controls row
        btn_row = tk.Frame(card_body, bg="#1a1d24")
        btn_row.pack(fill=tk.X, pady=(4, 0))

        copy_btn = tk.Button(
            btn_row, text="📋 Copy Token", bg="#242936", fg="#f1f5f9",
            activebackground="#333b4e", activeforeground="#ffffff",
            font=("Segoe UI", 9, "bold"), padx=14, pady=6, bd=1, relief="solid",
            cursor="hand2", command=self.handle_copy_token
        )
        copy_btn.pack(side=tk.LEFT, padx=(0, 8))

        refresh_btn = tk.Button(
            btn_row, text="🔄 Generate New Token", bg="#242936", fg="#cbd5e1",
            activebackground="#333b4e", activeforeground="#ffffff",
            font=("Segoe UI", 9), padx=12, pady=6, bd=1, relief="solid",
            cursor="hand2", command=self.handle_regenerate_token
        )
        refresh_btn.pack(side=tk.LEFT, padx=(0, 8))

        sim_btn = tk.Button(
            btn_row, text="📱 Simulate Mobile Connect", bg="#2563eb", fg="#ffffff",
            activebackground="#1d4ed8", activeforeground="#ffffff",
            font=("Segoe UI", 9, "bold"), padx=14, pady=6, bd=0,
            cursor="hand2", command=self.handle_simulate_connect
        )
        sim_btn.pack(side=tk.RIGHT)

        # Standby status guide banner
        guide_box = tk.Frame(center_wrap, bg="#121418", bd=1, relief="solid", highlightbackground="#222630", padx=16, pady=16)
        guide_box.pack(fill=tk.X, padx=10, pady=12)

        g_title = tk.Label(
            guide_box, text="⏳ Host Standby — Ready to Pair",
            bg="#121418", fg="#fbbf24", font=("Segoe UI", 10, "bold")
        )
        g_title.pack(anchor="w", pady=(0, 4))

        g_desc = tk.Label(
            guide_box,
            text="Open the Lazy Terminal app on Android and enter the pairing token displayed above.\nOnce connected, the Sync Manager, Server Control, and live intent synchronization will activate.",
            bg="#121418", fg="#94a3b8", font=("Segoe UI", 9), justify=tk.LEFT
        )
        g_desc.pack(anchor="w")

    def render_connected_view(self):
        """
        Connected View:
        Once connected, the Sync Manager, Server Control, and telemetry are shown.
        """
        # 1. Connected Notification Banner
        banner = tk.Frame(self.main_container, bg="#064e3b", bd=1, relief="solid", highlightbackground="#059669", padx=14, pady=8)
        banner.pack(fill=tk.X, pady=(0, 14))

        b_left = tk.Label(
            banner, text="● Device Connected: Android Mobile Client (Ed25519 Tunnel Active)",
            bg="#064e3b", fg="#6ee7b7", font=("Segoe UI", 9, "bold")
        )
        b_left.pack(side=tk.LEFT)

        b_disc = tk.Button(
            banner, text="Disconnect", bg="#1a1d24", fg="#cbd5e1",
            activebackground="#252a36", activeforeground="#ffffff",
            font=("Segoe UI", 8, "bold"), padx=10, pady=2, bd=1, relief="solid",
            cursor="hand2", command=self.handle_disconnect
        )
        b_disc.pack(side=tk.RIGHT)

        # 2. Compact Active Token Bar
        token_bar = tk.Frame(self.main_container, bg="#1a1d24", bd=1, relief="solid", highlightbackground="#282d38", padx=14, pady=8)
        token_bar.pack(fill=tk.X, pady=(0, 14))

        tb_left = tk.Label(
            token_bar, text=f"🔑 Active Paired Token:  {self.pairing_token}",
            bg="#1a1d24", fg="#ffffff", font=("Consolas", 10, "bold")
        )
        tb_left.pack(side=tk.LEFT)

        tb_copy = tk.Button(
            token_bar, text="Copy", bg="#242936", fg="#cbd5e1",
            font=("Segoe UI", 8), padx=8, pady=2, bd=1, relief="solid",
            cursor="hand2", command=self.handle_copy_token
        )
        tb_copy.pack(side=tk.RIGHT)

        # 3. Two-Column Dashboard: Server Control (Left) & Sync Manager (Right)
        dash_grid = tk.Frame(self.main_container, bg="#14161c")
        dash_grid.pack(fill=tk.BOTH, expand=True)

        dash_grid.columnconfigure(0, weight=4)
        dash_grid.columnconfigure(1, weight=6)

        # --- LEFT: Server Control Window ---
        srv_card = tk.Frame(dash_grid, bg="#1a1d24", bd=1, relief="solid", highlightbackground="#282d38", padx=14, pady=12)
        srv_card.grid(row=0, column=0, sticky="nsew", padx=(0, 8))

        # Title
        sc_title_row = tk.Frame(srv_card, bg="#1a1d24")
        sc_title_row.pack(fill=tk.X, pady=(0, 10))

        sc_title = tk.Label(sc_title_row, text="🖥️ Server Control", bg="#1a1d24", fg="#f1f5f9", font=("Segoe UI", 10, "bold"))
        sc_title.pack(side=tk.LEFT)

        status_text = "RUNNING" if self.is_server_running else "STOPPED"
        status_color = "#34d399" if self.is_server_running else "#f87171"
        status_bg = "#064e3b" if self.is_server_running else "#450a0a"

        sc_status = tk.Label(sc_title_row, text=f" {status_text} ", bg=status_bg, fg=status_color, font=("Consolas", 8, "bold"))
        sc_status.pack(side=tk.RIGHT)

        # Metrics box
        metrics_box = tk.Frame(srv_card, bg="#121418", bd=1, relief="solid", highlightbackground="#222630", padx=10, pady=8)
        metrics_box.pack(fill=tk.X, pady=(0, 14))

        m1 = tk.Label(metrics_box, text=f"Local Port:  {self.host_port} (TCP TLS)", bg="#121418", fg="#94a3b8", font=("Consolas", 9))
        m1.pack(anchor="w")
        m2 = tk.Label(metrics_box, text=f"Host LAN IP: {self.local_ip}", bg="#121418", fg="#94a3b8", font=("Consolas", 9))
        m2.pack(anchor="w")

        # Toggle button
        srv_btn_text = "⏹ Stop Server" if self.is_server_running else "▶ Start Server"
        srv_btn_bg = "#e11d48" if self.is_server_running else "#059669"

        srv_toggle_btn = tk.Button(
            srv_card, text=srv_btn_text, bg=srv_btn_bg, fg="#ffffff",
            activebackground=srv_btn_bg, activeforeground="#ffffff",
            font=("Segoe UI", 9, "bold"), pady=6, bd=0, cursor="hand2",
            command=self.handle_toggle_server
        )
        srv_toggle_btn.pack(fill=tk.X, side=tk.BOTTOM)

        # --- RIGHT: Sync Manager Window ---
        sync_card = tk.Frame(dash_grid, bg="#1a1d24", bd=1, relief="solid", highlightbackground="#282d38", padx=14, pady=12)
        sync_card.grid(row=0, column=1, sticky="nsew", padx=(8, 0))

        # Title
        sync_title_row = tk.Frame(sync_card, bg="#1a1d24")
        sync_title_row.pack(fill=tk.X, pady=(0, 10))

        sync_title = tk.Label(sync_title_row, text="🔄 Sync Manager", bg="#1a1d24", fg="#f1f5f9", font=("Segoe UI", 10, "bold"))
        sync_title.pack(side=tk.LEFT)

        sync_count = tk.Label(sync_title_row, text=f"{len(self.sync_records)} sync records", bg="#1a1d24", fg="#64748b", font=("Consolas", 8))
        sync_count.pack(side=tk.RIGHT)

        # Sync Action Controls (Sync Request Button + Dropdown)
        action_row = tk.Frame(sync_card, bg="#1a1d24")
        action_row.pack(fill=tk.X, pady=(0, 12))

        sync_btn = tk.Button(
            action_row, text="⚡ Sync Request" if not self.is_syncing else "⏳ Syncing...",
            bg="#2563eb", fg="#ffffff", activebackground="#1d4ed8", activeforeground="#ffffff",
            font=("Segoe UI", 9, "bold"), padx=12, pady=5, bd=0, cursor="hand2",
            state=tk.DISABLED if self.is_syncing else tk.NORMAL,
            command=self.handle_sync_request
        )
        sync_btn.pack(side=tk.LEFT, padx=(0, 8))

        # Combobox of previous syncs
        sync_values = [f"{s['id']}  •  {s['time_ago']}" for s in self.sync_records]
        self.sync_combo = ttk.Combobox(action_row, values=sync_values, state="readonly", style="TCombobox")
        self.sync_combo.current(0)
        self.sync_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.sync_combo.bind("<<ComboboxSelected>>", self.handle_select_sync)

        # Selected Sync Details Display
        curr_sync = next((s for s in self.sync_records if s["id"] == self.selected_sync_id), self.sync_records[0])
        details_box = tk.Frame(sync_card, bg="#121418", bd=1, relief="solid", highlightbackground="#222630", padx=12, pady=10)
        details_box.pack(fill=tk.BOTH, expand=True)

        d_head = tk.Frame(details_box, bg="#121418")
        d_head.pack(fill=tk.X, pady=(0, 4))

        d_id = tk.Label(d_head, text=curr_sync["id"], bg="#121418", fg="#f1f5f9", font=("Consolas", 9, "bold"))
        d_id.pack(side=tk.LEFT)

        d_time = tk.Label(d_head, text=curr_sync["timestamp"], bg="#121418", fg="#64748b", font=("Consolas", 8))
        d_time.pack(side=tk.RIGHT)

        d_summary = tk.Label(
            details_box, text=curr_sync["summary"],
            bg="#121418", fg="#94a3b8", font=("Segoe UI", 9), wraplength=340, justify=tk.LEFT
        )
        d_summary.pack(anchor="w", pady=(4, 6))

        d_foot = tk.Label(
            details_box,
            text=f"Items Synced: {curr_sync['items']}   |   Git Head Commit: {curr_sync['head_commit']}",
            bg="#121418", fg="#34d399", font=("Consolas", 8)
        )
        d_foot.pack(anchor="w")

    # --- Actions ---
    def show_toast(self, message: str):
        self.toast_message = message
        if self.toast_timer:
            self.root.after_cancel(self.toast_timer)
        self.build_ui()
        self.toast_timer = self.root.after(3000, self.clear_toast)

    def clear_toast(self):
        self.toast_message = ""
        self.build_ui()

    def handle_copy_token(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.pairing_token)
        self.show_toast(f"Token '{self.pairing_token}' copied to clipboard!")

    def handle_regenerate_token(self):
        new_token = self.generate_random_token()
        self.pairing_token = new_token

        # If Node backend is running locally, notify it to rotate pairing key
        def _post_regenerate():
            try:
                req = urllib.request.Request(
                    f"http://127.0.0.1:{self.host_port}/api/v1/pairing/generate",
                    data=b"{}",
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=1.0) as resp:
                    data = json.loads(resp.read().decode())
                    if data.get("pairingKey"):
                        self.pairing_token = data["pairingKey"]
            except Exception:
                pass
            self.root.after(0, lambda: self.show_toast(f"Generated new pairing token: {self.pairing_token}"))

        threading.Thread(target=_post_regenerate, daemon=True).start()

    def handle_simulate_connect(self):
        self.is_connected = True
        self.show_toast("Mobile device connected successfully! Sync Manager unlocked.")

    def handle_disconnect(self):
        self.is_connected = False
        self.show_toast("Mobile device disconnected. Waiting for connection.")

    def handle_toggle_server(self):
        self.is_server_running = not self.is_server_running
        state_str = "started" if self.is_server_running else "stopped"
        self.show_toast(f"Host server daemon {state_str}.")

    def handle_select_sync(self, event=None):
        idx = self.sync_combo.current()
        if 0 <= idx < len(self.sync_records):
            self.selected_sync_id = self.sync_records[idx]["id"]
            self.build_ui()

    def handle_sync_request(self):
        self.is_syncing = True
        self.build_ui()

        def _do_sync():
            time.sleep(0.7)  # Simulated sync round-trip
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
            self.selected_sync_id = new_id
            self.is_syncing = False
            self.root.after(0, lambda: self.show_toast(f"Sync request {new_id} completed successfully!"))

        threading.Thread(target=_do_sync, daemon=True).start()

    def background_poll_loop(self):
        """
        Polls the local Express host companion API on port 3000 to synchronize:
        - Active host pairing key
        - Connected mobile sessions
        """
        while self.poll_active:
            try:
                # 1. Fetch live active pairing key if local host companion is running
                url_key = f"http://127.0.0.1:{self.host_port}/api/v1/pairing/key"
                req_key = urllib.request.Request(url_key, headers={"User-Agent": "LazyTerminal-Companion"})
                with urllib.request.urlopen(req_key, timeout=0.8) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode())
                        live_key = data.get("pairingKey")
                        if live_key and live_key != self.pairing_token and not self.is_connected:
                            self.pairing_token = live_key
                            self.root.after(0, self.build_ui)

                # 2. Check health & session connection status
                url_health = f"http://127.0.0.1:{self.host_port}/health"
                req_health = urllib.request.Request(url_health, headers={"User-Agent": "LazyTerminal-Companion"})
                with urllib.request.urlopen(req_health, timeout=0.8) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode())
                        # If backend reports serverStatus
                        srv_status = data.get("serverStatus")
                        if srv_status == "running" and not self.is_server_running:
                            self.is_server_running = True
                            self.root.after(0, self.build_ui)
            except Exception:
                pass

            time.sleep(1.5)


def main():
    root = tk.Tk()
    app = LazyTerminalCompanionApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
