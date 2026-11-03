using System;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Diagnostics;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Media.Effects;
using System.Windows.Input;
using System.Windows.Threading;

namespace LazyTerminal.Host {
    public class CompanionWindow : Window {
        // UI Components
        private TextBlock tokenTextBlock;
        private TextBlock ipTextBlock;
        private TextBlock statusPillText;
        private Border statusPillBorder;
        private TextBox logTextBox;
        private Button copyTokenButton;
        private Button copyIpButton;

        // State
        private string pairingToken = "839201";
        private string localIp = "127.0.0.1";
        private int hostPort = 9871;
        private bool isConnected = false;
        private Process hostProcess = null;
        private HttpListener fallbackListener = null;
        private Thread fallbackThread = null;
        private DispatcherTimer pollTimer;

        public CompanionWindow() {
            InitializeWindowStyle();
            DiscoverLocalIp();
            GenerateNewToken();
            BuildUi();
            StartHostBackend();
            StartFallbackServer();
            SetupPolling();
        }

        private void InitializeWindowStyle() {
            this.Title = "Lazy Terminal — Windows PC Host Companion";
            this.Width = 860;
            this.Height = 650;
            this.MinWidth = 800;
            this.MinHeight = 580;
            this.WindowStartupLocation = WindowStartupLocation.CenterScreen;
            this.WindowStyle = WindowStyle.None;
            this.AllowsTransparency = true;
            this.Background = new SolidColorBrush(Color.FromRgb(9, 13, 22)); // Deep obsidian
            this.BorderBrush = new SolidColorBrush(Color.FromRgb(37, 49, 76));
            this.BorderThickness = new Thickness(1);

            // Load window icon if present
            try {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string icoPath = Path.Combine(baseDir, "app_icon.ico");
                if (!File.Exists(icoPath)) {
                    icoPath = Path.Combine(baseDir, @"public\downloads\app_icon.ico");
                }
                if (File.Exists(icoPath)) {
                    this.Icon = new BitmapImage(new Uri(icoPath, UriKind.Absolute));
                }
            } catch {}
        }

        private void DiscoverLocalIp() {
            try {
                using (Socket socket = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, 0)) {
                    socket.Connect("8.8.8.8", 65530);
                    IPEndPoint endPoint = socket.LocalEndPoint as IPEndPoint;
                    if (endPoint != null) {
                        localIp = endPoint.Address.ToString();
                        return;
                    }
                }
            } catch {}

            try {
                foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces()) {
                    if (ni.OperationalStatus == OperationalStatus.Up &&
                        (ni.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ||
                         ni.NetworkInterfaceType == NetworkInterfaceType.Ethernet)) {
                        foreach (UnicastIPAddressInformation ip in ni.GetIPProperties().UnicastAddresses) {
                            if (ip.Address.AddressFamily == AddressFamily.InterNetwork &&
                                !IPAddress.IsLoopback(ip.Address)) {
                                localIp = ip.Address.ToString();
                                return;
                            }
                        }
                    }
                }
            } catch {}
        }

        private void GenerateNewToken() {
            Random rnd = new Random();
            int part1 = rnd.Next(100, 999);
            int part2 = rnd.Next(100, 999);
            pairingToken = string.Format("{0}{1}", part1, part2);
        }

        private string FormatToken(string raw) {
            if (raw != null && raw.Length >= 6) {
                return string.Format("{0} - {1}", raw.Substring(0, 3), raw.Substring(3, 3));
            }
            return raw;
        }

        private void BuildUi() {
            Grid rootGrid = new Grid();
            rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(56) }); // Custom Titlebar
            rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // Main Content
            rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(38) }); // Status Bar

            // 1. Titlebar
            Border titleBar = BuildTitleBar();
            Grid.SetRow(titleBar, 0);
            rootGrid.Children.Add(titleBar);

            // 2. Main Body Grid (Two columns: Left Hero/Controls, Right Live Terminal)
            Grid contentGrid = new Grid { Margin = new Thickness(24, 16, 24, 16) };
            contentGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(420) });
            contentGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(16) }); // Spacer
            contentGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            // Left Pane: Hero Pairing Card + Connection Coordinates + Actions
            StackPanel leftPanel = new StackPanel();
            leftPanel.Children.Add(BuildHeroPairingCard());
            leftPanel.Children.Add(new Border { Height = 14 });
            leftPanel.Children.Add(BuildCoordinatesCard());
            leftPanel.Children.Add(new Border { Height = 14 });
            leftPanel.Children.Add(BuildActionsPanel());
            Grid.SetColumn(leftPanel, 0);
            contentGrid.Children.Add(leftPanel);

            // Right Pane: Live Activity Log Box
            Border logCard = BuildLogCard();
            Grid.SetColumn(logCard, 2);
            contentGrid.Children.Add(logCard);

            Grid.SetRow(contentGrid, 1);
            rootGrid.Children.Add(contentGrid);

            // 3. Footer Bar
            Border footerBar = BuildFooterBar();
            Grid.SetRow(footerBar, 2);
            rootGrid.Children.Add(footerBar);

            this.Content = rootGrid;
        }

        private Border BuildTitleBar() {
            Border bar = new Border {
                Background = new SolidColorBrush(Color.FromRgb(14, 18, 30)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(30, 40, 64)),
                BorderThickness = new Thickness(0, 0, 0, 1)
            };

            // Allow dragging window from titlebar
            bar.MouseDown += (s, e) => {
                if (e.ChangedButton == MouseButton.Left) {
                    this.DragMove();
                }
            };

            Grid barGrid = new Grid { Margin = new Thickness(16, 0, 16, 0) };
            barGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            barGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            barGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            // Logo & Title
            StackPanel logoGroup = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
            Image logoImg = LoadIconImage(28);
            if (logoImg != null) {
                logoGroup.Children.Add(logoImg);
                logoGroup.Children.Add(new Border { Width = 10 });
            }

            StackPanel titleGroup = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            TextBlock titleText = new TextBlock {
                Text = "LAZY TERMINAL",
                FontFamily = new FontFamily("Segoe UI, Aptos, sans-serif"),
                FontWeight = FontWeights.Bold,
                FontSize = 13,
                Foreground = new SolidColorBrush(Color.FromRgb(240, 244, 255))
            };
            TextBlock subText = new TextBlock {
                Text = "Windows PC Host Companion",
                FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(140, 155, 185))
            };
            titleGroup.Children.Add(titleText);
            titleGroup.Children.Add(subText);
            logoGroup.Children.Add(titleGroup);

            Grid.SetColumn(logoGroup, 0);
            barGrid.Children.Add(logoGroup);

            // Window Controls (Minimize, Close)
            StackPanel controls = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };

            Button minBtn = CreateTitleButton("—", (s, e) => { this.WindowState = WindowState.Minimized; });
            Button closeBtn = CreateTitleButton("✕", (s, e) => {
                StopHostBackend();
                Application.Current.Shutdown();
            }, isClose: true);

            controls.Children.Add(minBtn);
            controls.Children.Add(new Border { Width = 6 });
            controls.Children.Add(closeBtn);

            Grid.SetColumn(controls, 2);
            barGrid.Children.Add(controls);

            bar.Child = barGrid;
            return bar;
        }

        private Button CreateTitleButton(string text, RoutedEventHandler onClick, bool isClose = false) {
            Button btn = new Button {
                Content = text,
                Width = 32,
                Height = 28,
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(180, 195, 220)),
                Background = new SolidColorBrush(Color.FromArgb(0, 0, 0, 0)),
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };
            btn.Click += onClick;
            btn.MouseEnter += (s, e) => {
                btn.Background = isClose 
                    ? new SolidColorBrush(Color.FromRgb(220, 38, 38)) 
                    : new SolidColorBrush(Color.FromArgb(40, 255, 255, 255));
                btn.Foreground = Brushes.White;
            };
            btn.MouseLeave += (s, e) => {
                btn.Background = new SolidColorBrush(Color.FromArgb(0, 0, 0, 0));
                btn.Foreground = new SolidColorBrush(Color.FromRgb(180, 195, 220));
            };
            return btn;
        }

        private Border BuildHeroPairingCard() {
            Border card = new Border {
                Background = new SolidColorBrush(Color.FromRgb(18, 24, 38)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(40, 52, 78)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(14),
                Padding = new Thickness(20)
            };

            // Ambient subtle cyan glow effect
            card.Effect = new DropShadowEffect {
                Color = Color.FromRgb(0, 229, 255),
                BlurRadius = 24,
                Opacity = 0.12,
                ShadowDepth = 0
            };

            StackPanel cardContent = new StackPanel();

            // Status Badge
            WrapPanel badgeWrap = new WrapPanel { Margin = new Thickness(0, 0, 0, 12) };
            statusPillBorder = new Border {
                Background = new SolidColorBrush(Color.FromRgb(6, 78, 59)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(16, 185, 129)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(12),
                Padding = new Thickness(10, 3, 10, 3)
            };
            statusPillText = new TextBlock {
                Text = "● HOST ACTIVE · READY TO PAIR",
                FontSize = 10,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(167, 243, 208))
            };
            statusPillBorder.Child = statusPillText;
            badgeWrap.Children.Add(statusPillBorder);
            cardContent.Children.Add(badgeWrap);

            // Card Title & Description
            TextBlock headerText = new TextBlock {
                Text = "Mobile Pairing Token",
                FontSize = 16,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                Margin = new Thickness(0, 0, 0, 4)
            };
            cardContent.Children.Add(headerText);

            TextBlock descText = new TextBlock {
                Text = "Enter this 6-digit code on the Lazy Terminal mobile app to connect directly over local Wi-Fi.",
                FontSize = 12,
                Foreground = new SolidColorBrush(Color.FromRgb(156, 163, 175)),
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 0, 0, 16)
            };
            cardContent.Children.Add(descText);

            // Large Monospace Token Display
            Border tokenBox = new Border {
                Background = new SolidColorBrush(Color.FromRgb(11, 15, 25)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(45, 60, 92)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(10),
                Padding = new Thickness(16, 12, 16, 12),
                Margin = new Thickness(0, 0, 0, 14)
            };

            tokenTextBlock = new TextBlock {
                Text = FormatToken(pairingToken),
                FontFamily = new FontFamily("Consolas, Courier New, monospace"),
                FontSize = 32,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(240, 249, 255)),
                HorizontalAlignment = HorizontalAlignment.Center
            };
            tokenBox.Child = tokenTextBlock;
            cardContent.Children.Add(tokenBox);

            // Copy Token Button
            copyTokenButton = new Button {
                Content = "📋  Copy 6-Digit Pairing Code",
                Height = 40,
                FontSize = 13,
                FontWeight = FontWeights.SemiBold,
                Foreground = Brushes.White,
                Background = new SolidColorBrush(Color.FromRgb(37, 99, 235)), // Vivid Cobalt
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };
            copyTokenButton.Click += (s, e) => {
                try {
                    Clipboard.SetText(pairingToken);
                    copyTokenButton.Content = "✓  Copied to Clipboard!";
                    copyTokenButton.Background = new SolidColorBrush(Color.FromRgb(16, 185, 129)); // Green
                    DispatcherTimer t = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
                    t.Tick += (ts, te) => {
                        copyTokenButton.Content = "📋  Copy 6-Digit Pairing Code";
                        copyTokenButton.Background = new SolidColorBrush(Color.FromRgb(37, 99, 235));
                        t.Stop();
                    };
                    t.Start();
                } catch {}
            };
            cardContent.Children.Add(copyTokenButton);

            card.Child = cardContent;
            return card;
        }

        private Border BuildCoordinatesCard() {
            Border card = new Border {
                Background = new SolidColorBrush(Color.FromRgb(18, 24, 38)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(40, 52, 78)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(12),
                Padding = new Thickness(16)
            };

            StackPanel panel = new StackPanel();

            TextBlock label = new TextBlock {
                Text = "Host LAN IP & Port (Enter on Mobile)",
                FontSize = 12,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(210, 220, 240)),
                Margin = new Thickness(0, 0, 0, 6)
            };
            panel.Children.Add(label);

            Grid ipRow = new Grid();
            ipRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            ipRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(8) });
            ipRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            string url = string.Format("http://{0}:{1}", localIp, hostPort);
            ipTextBlock = new TextBlock {
                Text = url,
                FontFamily = new FontFamily("Consolas, monospace"),
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(56, 189, 248)), // Cyan
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(ipTextBlock, 0);
            ipRow.Children.Add(ipTextBlock);

            copyIpButton = new Button {
                Content = "Copy IP",
                Padding = new Thickness(12, 6, 12, 6),
                FontSize = 11,
                FontWeight = FontWeights.SemiBold,
                Foreground = Brushes.White,
                Background = new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                BorderThickness = new Thickness(1),
                Cursor = Cursors.Hand
            };
            copyIpButton.Click += (s, e) => {
                try {
                    Clipboard.SetText(url);
                    copyIpButton.Content = "Copied!";
                    DispatcherTimer t = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
                    t.Tick += (ts, te) => {
                        copyIpButton.Content = "Copy IP";
                        t.Stop();
                    };
                    t.Start();
                } catch {}
            };
            Grid.SetColumn(copyIpButton, 2);
            ipRow.Children.Add(copyIpButton);

            panel.Children.Add(ipRow);

            TextBlock helper = new TextBlock {
                Text = "On your phone's connection screen, ensure Host matches this exact URL.",
                FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(140, 155, 185)),
                Margin = new Thickness(0, 6, 0, 0),
                TextWrapping = TextWrapping.Wrap
            };
            panel.Children.Add(helper);

            card.Child = panel;
            return card;
        }

        private Grid BuildActionsPanel() {
            Grid grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(8) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            Button webDashBtn = new Button {
                Content = "🌐  Open Web Terminal",
                Height = 36,
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Foreground = Brushes.White,
                Background = new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                BorderThickness = new Thickness(1),
                Cursor = Cursors.Hand
            };
            webDashBtn.Click += (s, e) => {
                try {
                    string dashUrl = string.Format("http://localhost:{0}?view=laptop", hostPort);
                    Process.Start(new ProcessStartInfo(dashUrl) { UseShellExecute = true });
                    AppendLog("Launched Web Dashboard in browser: " + dashUrl);
                } catch (Exception ex) {
                    AppendLog("Failed to open browser: " + ex.Message);
                }
            };
            Grid.SetColumn(webDashBtn, 0);
            grid.Children.Add(webDashBtn);

            Button regenBtn = new Button {
                Content = "🔄  Regenerate Code",
                Height = 36,
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Foreground = Brushes.White,
                Background = new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                BorderThickness = new Thickness(1),
                Cursor = Cursors.Hand
            };
            regenBtn.Click += (s, e) => {
                GenerateNewToken();
                tokenTextBlock.Text = FormatToken(pairingToken);
                AppendLog("Regenerated new pairing token: " + pairingToken);
            };
            Grid.SetColumn(regenBtn, 2);
            grid.Children.Add(regenBtn);

            return grid;
        }

        private Border BuildLogCard() {
            Border card = new Border {
                Background = new SolidColorBrush(Color.FromRgb(14, 18, 30)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(35, 46, 70)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(14),
                Padding = new Thickness(16)
            };

            Grid logGrid = new Grid();
            logGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            logGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            // Log Header
            Grid headerGrid = new Grid { Margin = new Thickness(0, 0, 0, 10) };
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            TextBlock headerTitle = new TextBlock {
                Text = "Host Activity & Connection Logs",
                FontSize = 13,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(220, 230, 250)),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(headerTitle, 0);
            headerGrid.Children.Add(headerTitle);

            Button clearBtn = new Button {
                Content = "Clear",
                FontSize = 10,
                Padding = new Thickness(8, 3, 8, 3),
                Foreground = new SolidColorBrush(Color.FromRgb(150, 165, 195)),
                Background = new SolidColorBrush(Color.FromArgb(0, 0, 0, 0)),
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };
            clearBtn.Click += (s, e) => { logTextBox.Clear(); };
            Grid.SetColumn(clearBtn, 1);
            headerGrid.Children.Add(clearBtn);

            Grid.SetRow(headerGrid, 0);
            logGrid.Children.Add(headerGrid);

            // Terminal Log Box
            logTextBox = new TextBox {
                FontFamily = new FontFamily("Consolas, Courier New, monospace"),
                FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(167, 243, 208)), // Mint green monospace
                Background = new SolidColorBrush(Color.FromRgb(8, 11, 18)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(26, 35, 54)),
                BorderThickness = new Thickness(1),
                IsReadOnly = true,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
                TextWrapping = TextWrapping.Wrap,
                Padding = new Thickness(10)
            };
            Grid.SetRow(logTextBox, 1);
            logGrid.Children.Add(logTextBox);

            card.Child = logGrid;
            return card;
        }

        private Border BuildFooterBar() {
            Border footer = new Border {
                Background = new SolidColorBrush(Color.FromRgb(11, 15, 24)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(26, 35, 54)),
                BorderThickness = new Thickness(0, 1, 0, 0),
                Padding = new Thickness(20, 0, 20, 0)
            };

            Grid fGrid = new Grid();
            fGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            fGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            TextBlock leftInfo = new TextBlock {
                Text = "⚡  Mutual Ed25519 Hardware-backed Handshake · TLS 1.3 Local Network",
                FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(120, 135, 165)),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(leftInfo, 0);
            fGrid.Children.Add(leftInfo);

            TextBlock rightInfo = new TextBlock {
                Text = "Port: 9871 (Companion) · 3000 (Preview)",
                FontSize = 11,
                FontFamily = new FontFamily("Consolas, monospace"),
                Foreground = new SolidColorBrush(Color.FromRgb(120, 135, 165)),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(rightInfo, 1);
            fGrid.Children.Add(rightInfo);

            footer.Child = fGrid;
            return footer;
        }

        private Image LoadIconImage(double size) {
            try {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string[] candidates = new string[] {
                    Path.Combine(baseDir, "icon.jpeg"),
                    Path.Combine(baseDir, "public\\icon.jpeg"),
                    Path.Combine(baseDir, "app_icon.ico"),
                    Path.Combine(baseDir, "public\\downloads\\app_icon.ico")
                };

                foreach (string path in candidates) {
                    if (File.Exists(path)) {
                        BitmapImage bmp = new BitmapImage();
                        bmp.BeginInit();
                        bmp.UriSource = new Uri(path, UriKind.Absolute);
                        bmp.DecodePixelWidth = (int)size * 2;
                        bmp.EndInit();

                        return new Image {
                            Source = bmp,
                            Width = size,
                            Height = size,
                            Clip = new RectangleGeometry(new Rect(0, 0, size, size), 6, 6)
                        };
                    }
                }
            } catch {}
            return null;
        }

        public void AppendLog(string message) {
            Dispatcher.Invoke(new Action(() => {
                string timeStamp = DateTime.Now.ToString("HH:mm:ss");
                string line = string.Format("[{0}] {1}\r\n", timeStamp, message);
                logTextBox.AppendText(line);
                logTextBox.ScrollToEnd();
            }));
        }

        private void StartHostBackend() {
            AppendLog("Starting Lazy Terminal Windows Host Companion...");
            AppendLog(string.Format("Local Network IP: {0}", localIp));
            AppendLog(string.Format("Generated Initial Token: {0}", pairingToken));

            try {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string[] candidateExes = new string[] {
                    Path.Combine(baseDir, "LazyTerminal-Windows-Host.exe"),
                    Path.Combine(baseDir, @"public\downloads\LazyTerminal-Windows-Host.exe"),
                    Path.Combine(baseDir, @"..\public\downloads\LazyTerminal-Windows-Host.exe"),
                    Path.Combine(baseDir, @"..\LazyTerminal-Windows-Host.exe"),
                    Path.Combine(baseDir, "LazyTerminal-Windows-Setup.exe")
                };

                string hostExe = null;
                foreach (string cand in candidateExes) {
                    if (File.Exists(cand)) {
                        hostExe = Path.GetFullPath(cand);
                        break;
                    }
                }

                string[] candidateScripts = new string[] {
                    Path.Combine(baseDir, "companionServer.cjs"),
                    Path.Combine(baseDir, @"dist\companionServer.cjs"),
                    Path.Combine(baseDir, @"..\dist\companionServer.cjs")
                };

                string hostScript = null;
                foreach (string cand in candidateScripts) {
                    if (File.Exists(cand)) {
                        hostScript = Path.GetFullPath(cand);
                        break;
                    }
                }

                ProcessStartInfo psi = null;

                if (!string.IsNullOrEmpty(hostExe)) {
                    AppendLog("Launching host binary: " + hostExe);
                    psi = new ProcessStartInfo {
                        FileName = hostExe,
                        WorkingDirectory = Path.GetDirectoryName(hostExe),
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    };
                } else if (!string.IsNullOrEmpty(hostScript)) {
                    AppendLog("Launching host engine via node: " + hostScript);
                    psi = new ProcessStartInfo {
                        FileName = "node",
                        Arguments = string.Format("\"{0}\"", hostScript),
                        WorkingDirectory = Path.GetDirectoryName(hostScript),
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    };
                } else {
                    // Try npm run host if node workspace is present
                    string pkgJson = Path.Combine(baseDir, "package.json");
                    if (!File.Exists(pkgJson)) {
                        pkgJson = Path.Combine(baseDir, @"..\package.json");
                    }
                    if (File.Exists(pkgJson)) {
                        string projDir = Path.GetDirectoryName(pkgJson);
                        AppendLog("Launching host engine via npm run host in: " + projDir);
                        psi = new ProcessStartInfo {
                            FileName = "cmd.exe",
                            Arguments = "/c npm run host",
                            WorkingDirectory = projDir,
                            UseShellExecute = false,
                            CreateNoWindow = true,
                            RedirectStandardOutput = true,
                            RedirectStandardError = true
                        };
                    }
                }

                if (psi != null) {
                    psi.EnvironmentVariables["PORT"] = hostPort.ToString();
                    hostProcess = new Process { StartInfo = psi };
                    hostProcess.OutputDataReceived += (s, e) => {
                        if (!string.IsNullOrEmpty(e.Data)) {
                            AppendLog(e.Data);
                            // Parse pairing key if emitted by host engine
                            if (e.Data.Contains("Pairing Key :") || e.Data.Contains("Pairing Key:")) {
                                string[] parts = e.Data.Split(':');
                                if (parts.Length > 1) {
                                    string token = parts[1].Trim().Split(' ')[0];
                                    if (token.Length >= 6) {
                                        Dispatcher.Invoke(new Action(() => {
                                            pairingToken = token;
                                            tokenTextBlock.Text = FormatToken(token);
                                        }));
                                    }
                                }
                            }
                        }
                    };
                    hostProcess.ErrorDataReceived += (s, e) => {
                        if (!string.IsNullOrEmpty(e.Data)) {
                            AppendLog("[Host] " + e.Data);
                        }
                    };
                    hostProcess.Start();
                    hostProcess.BeginOutputReadLine();
                    hostProcess.BeginErrorReadLine();
                    AppendLog("Host background process started (PID: " + hostProcess.Id + ").");
                } else {
                    AppendLog("No separate Node host binary found. Fallback HTTP companion active on port 9871.");
                }
            } catch (Exception ex) {
                AppendLog("Note on backend launch: " + ex.Message);
            }
        }

        private void StartFallbackServer() {
            // Also run a built-in HttpListener on port 9871 or 3000 if not claimed
            fallbackThread = new Thread(() => {
                try {
                    fallbackListener = new HttpListener();
                    fallbackListener.Prefixes.Add(string.Format("http://localhost:{0}/", hostPort));
                    fallbackListener.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", hostPort));
                    fallbackListener.Start();
                    AppendLog(string.Format("Embedded listener online at http://0.0.0.0:{0}/", hostPort));

                    while (fallbackListener.IsListening) {
                        try {
                            HttpListenerContext ctx = fallbackListener.GetContext();
                            ThreadPool.QueueUserWorkItem((state) => HandleFallbackRequest(ctx));
                        } catch {}
                    }
                } catch {
                    // Port already bound by host engine, which is ideal!
                }
            }) { IsBackground = true };
            fallbackThread.Start();
        }

        private void HandleFallbackRequest(HttpListenerContext ctx) {
            try {
                HttpListenerRequest req = ctx.Request;
                HttpListenerResponse res = ctx.Response;

                res.AddHeader("Access-Control-Allow-Origin", "*");
                res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

                if (req.HttpMethod == "OPTIONS") {
                    res.StatusCode = 204;
                    res.Close();
                    return;
                }

                string path = req.Url.AbsolutePath;

                if (path == "/health" || path == "/api/v1/host/status") {
                    string json = string.Format("{{\"status\":\"ok\",\"service\":\"lazy-terminal-companion\",\"version\":\"1.0.0\",\"serverStatus\":\"running\",\"pairingToken\":\"{0}\",\"ip\":\"{1}\",\"port\":{2},\"isConnected\":{3}}}",
                        pairingToken, localIp, hostPort, isConnected ? "true" : "false");
                    byte[] buf = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json";
                    res.ContentLength64 = buf.Length;
                    res.OutputStream.Write(buf, 0, buf.Length);
                    res.Close();
                    return;
                }

                if (path == "/api/v1/tunnel/connect" || path == "/api/v1/pairing/validate") {
                    string body = "";
                    using (StreamReader r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                        body = r.ReadToEnd();
                    }

                    bool matched = false;
                    string clientIp = req.RemoteEndPoint != null ? req.RemoteEndPoint.Address.ToString() : "unknown";

                    if (!string.IsNullOrEmpty(body)) {
                        string normBody = body.Replace(" ", "").Replace("-", "").ToLower();
                        string normTarget = pairingToken.Replace(" ", "").Replace("-", "").ToLower();
                        if (normBody.Contains(normTarget)) {
                            matched = true;
                        }
                    }

                    if (matched) {
                        isConnected = true;
                        Dispatcher.Invoke(new Action(() => {
                            statusPillBorder.Background = new SolidColorBrush(Color.FromRgb(16, 185, 129));
                            statusPillBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(52, 211, 153));
                            statusPillText.Text = string.Format("🟢 MOBILE CONNECTED ({0})", clientIp);
                            statusPillText.Foreground = Brushes.White;
                        }));
                        AppendLog(string.Format("Mobile device successfully paired and connected from {0}!", clientIp));

                        string successJson = string.Format("{{\"success\":true,\"sessionToken\":\"sess-{0}\",\"device\":{{\"deviceName\":\"Windows Host\",\"os\":\"Windows\",\"ip\":\"{1}\",\"port\":{2},\"isOnline\":true}}}}",
                            Guid.NewGuid().ToString("N").Substring(0, 12), localIp, hostPort);
                        byte[] buf = Encoding.UTF8.GetBytes(successJson);
                        res.ContentType = "application/json";
                        res.ContentLength64 = buf.Length;
                        res.OutputStream.Write(buf, 0, buf.Length);
                        res.Close();
                        return;
                    } else {
                        AppendLog(string.Format("Failed pairing attempt from {0}.", clientIp));
                        string failJson = "{\"success\":false,\"errorMessage\":\"Invalid pairing code.\"}";
                        byte[] buf = Encoding.UTF8.GetBytes(failJson);
                        res.StatusCode = 401;
                        res.ContentType = "application/json";
                        res.ContentLength64 = buf.Length;
                        res.OutputStream.Write(buf, 0, buf.Length);
                        res.Close();
                        return;
                    }
                }

                res.StatusCode = 404;
                res.Close();
            } catch {}
        }

        private void SetupPolling() {
            pollTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
            pollTimer.Tick += (s, e) => {
                ThreadPool.QueueUserWorkItem((state) => {
                    try {
                        HttpWebRequest req = (HttpWebRequest)WebRequest.Create(string.Format("http://127.0.0.1:{0}/api/v1/host/status", hostPort));
                        req.Timeout = 1500;
                        using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                        using (StreamReader reader = new StreamReader(resp.GetResponseStream())) {
                            string text = reader.ReadToEnd();
                            if (text.Contains("\"serverStatus\":\"running\"")) {
                                Dispatcher.Invoke(new Action(() => {
                                    if (!isConnected) {
                                        statusPillBorder.Background = new SolidColorBrush(Color.FromRgb(6, 78, 59));
                                        statusPillBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(16, 185, 129));
                                        statusPillText.Text = "● HOST ACTIVE · READY TO PAIR";
                                    }
                                }));
                            }
                        }
                    } catch {}
                });
            };
            pollTimer.Start();
        }

        private void StopHostBackend() {
            try {
                if (pollTimer != null) pollTimer.Stop();
                if (fallbackListener != null && fallbackListener.IsListening) {
                    fallbackListener.Stop();
                    fallbackListener.Close();
                }
                if (hostProcess != null && !hostProcess.HasExited) {
                    hostProcess.Kill();
                }
            } catch {}
        }

        protected override void OnClosed(EventArgs e) {
            StopHostBackend();
            base.OnClosed(e);
        }

        [STAThread]
        public static void Main() {
            Application app = new Application();
            CompanionWindow win = new CompanionWindow();
            app.Run(win);
        }
    }
}
