import React, { useState, useEffect } from 'react';
import { RelayProvider, useRelay } from './context/RelayContext';
import { DevicePresenceBar } from './components/DevicePresenceBar';
import { NavigationDrawer } from './components/NavigationDrawer';
import { BottomNavigation } from './components/BottomNavigation';
import { MobileConnectionFlow } from './components/MobileConnectionFlow';
import { TerminalScreen } from './screens/TerminalScreen';
import { ExplorerScreen } from './screens/ExplorerScreen';
import { SourceControlScreen } from './screens/SourceControlScreen';
import { RunDebugScreen } from './screens/RunDebugScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { MoreScreen } from './screens/MoreScreen';
import { LaptopApp } from './screens/LaptopApp';
import { SimpleDownloadPortal } from './screens/SimpleDownloadPortal';
import { ReconciliationModal } from './components/ReconciliationModal';
import { ProjectSwitchDrawer } from './components/ProjectSwitchDrawer';
import { Smartphone, Laptop, Download } from 'lucide-react';

function AppContent() {
  const { 
    activeFrontend, 
    setActiveFrontend, 
    connectionStep, 
    setIsDrawerOpen, 
    mobileNav,
    setReconciliationPromptOpen
  } = useRelay();

  const [projectDrawerOpen, setProjectDrawerOpen] = useState(false);

  // Check URL query parameters for view overrides (e.g. ?view=mobile or ?view=laptop for E2E tests)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'mobile' || view === 'laptop' || view === 'portal') {
      setActiveFrontend(view as any);
    }
  }, [setActiveFrontend]);

  // Render Mobile Screen based on Flowchart Navigation
  const renderMobileContent = () => {
    if (connectionStep !== 'connected') {
      return <MobileConnectionFlow />;
    }

    switch (mobileNav) {
      case 'explorer':
        return <ExplorerScreen />;
      case 'terminal':
        return <TerminalScreen />;
      case 'git':
        return <SourceControlScreen />;
      case 'run':
        return <RunDebugScreen />;
      case 'preview':
        return <PreviewScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'more':
        return <MoreScreen onSwitchToTerminal={() => {}} />;
      default:
        return <TerminalScreen />;
    }
  };

  // Check if developer view parameter is set
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isDevMode = params?.has('view') || params?.has('dev');

  // Default view is the pure 2-option download portal
  if (!isDevMode && activeFrontend === 'portal') {
    return <SimpleDownloadPortal />;
  }

  return (
    <div className="h-screen h-[100dvh] bg-[#07080a] text-zinc-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Main Viewport */}
      {activeFrontend === 'portal' ? (
        <SimpleDownloadPortal />
      ) : (
        <div className="flex-1 flex items-center justify-center p-0 md:p-3 overflow-hidden bg-[#07080a] min-h-0">
          {activeFrontend === 'laptop' ? (
            <div className="w-full h-full max-w-7xl max-h-[96vh] rounded-none md:rounded-xl border border-[#272a33] shadow-2xl overflow-hidden flex flex-col bg-[#14161c]">
              <LaptopApp />
            </div>
          ) : (
            <div className="w-full max-w-[430px] md:h-[860px] md:max-h-[96vh] h-[100dvh] bg-[#121419] md:rounded-2xl md:border border-[#272a33] shadow-xl flex flex-col overflow-hidden relative">
              {connectionStep === 'connected' && (
                <DevicePresenceBar
                  onOpenProjectDrawer={() => setProjectDrawerOpen(true)}
                  onOpenReconciliation={() => setReconciliationPromptOpen(true)}
                  onOpenDrawer={() => setIsDrawerOpen(true)}
                />
              )}

              <NavigationDrawer />

              <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[#121419]">
                {renderMobileContent()}
              </main>

              {connectionStep === 'connected' && <BottomNavigation />}

              <ReconciliationModal />
              <ProjectSwitchDrawer
                isOpen={projectDrawerOpen}
                onClose={() => setProjectDrawerOpen(false)}
                onManageWorkspaces={() => setProjectDrawerOpen(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <RelayProvider>
      <AppContent />
    </RelayProvider>
  );
}

export default App;
