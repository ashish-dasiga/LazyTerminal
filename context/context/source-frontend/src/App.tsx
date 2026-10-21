import React, { useState } from 'react';
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
import { ReconciliationModal } from './components/ReconciliationModal';
import { ProjectSwitchDrawer } from './components/ProjectSwitchDrawer';
import { Smartphone, Laptop } from 'lucide-react';

function AppContent() {
  const { 
    activeFrontend, 
    setActiveFrontend, 
    connectionStep, 
    isDrawerOpen, 
    setIsDrawerOpen, 
    mobileNav,
    setReconciliationPromptOpen
  } = useRelay();

  const [projectDrawerOpen, setProjectDrawerOpen] = useState(false);

  // Render Mobile Screen based on Flowchart Navigation
  const renderMobileContent = () => {
    // If not connected yet, enforce connection workflow
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

  return (
    <div className="h-screen h-[100dvh] bg-[#0f1115] text-zinc-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Top Application Bar: Restrained developer platform selector */}
      <header className="h-11 bg-[#15171d] border-b border-[#242731] px-4 flex items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-100 tracking-tight">Remote Development System</span>
          </div>

          <span className="text-zinc-600 text-xs hidden sm:inline">|</span>

          <span className="text-[11px] text-zinc-400 font-normal hidden sm:inline">
            Dual Frontend Architecture
          </span>
        </div>

        {/* View Switcher: Distinct Mobile (Android) vs Laptop (Windows) */}
        <div className="flex items-center p-0.5 bg-[#1b1e25] border border-[#2a2e38] rounded-md text-xs">
          <button
            onClick={() => setActiveFrontend('mobile')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeFrontend === 'mobile'
                ? 'bg-[#2a2e39] text-white font-medium border border-[#3c4150] shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile App (Android)</span>
          </button>

          <button
            onClick={() => setActiveFrontend('laptop')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeFrontend === 'laptop'
                ? 'bg-[#2a2e39] text-white font-medium border border-[#3c4150] shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Laptop App (Windows)</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center p-2 md:p-3 overflow-hidden bg-[#0f1115] min-h-0">
        {activeFrontend === 'laptop' ? (
          /* FRONTEND B: LAPTOP APP (WINDOWS DESKTOP) */
          <div className="w-full h-full max-w-7xl max-h-[96vh] rounded-none md:rounded-xl border border-[#272a33] shadow-2xl overflow-hidden flex flex-col bg-[#14161c]">
            <LaptopApp />
          </div>
        ) : (
          /* FRONTEND A: MOBILE APP (ANDROID PHONE) */
          <div className="w-full max-w-[430px] md:h-[860px] md:max-h-[96vh] h-[100dvh] bg-[#121419] md:rounded-2xl md:border border-[#272a33] shadow-xl flex flex-col overflow-hidden relative">
            {/* Mobile Header (Only shown when connected) */}
            {connectionStep === 'connected' && (
              <DevicePresenceBar
                onOpenProjectDrawer={() => setProjectDrawerOpen(true)}
                onOpenReconciliation={() => setReconciliationPromptOpen(true)}
                onOpenDrawer={() => setIsDrawerOpen(true)}
              />
            )}

            {/* Persistent Navigation Drawer (Flowchart Requirement 3) */}
            <NavigationDrawer />

            {/* Main Content Viewport */}
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[#121419]">
              {renderMobileContent()}
            </main>

            {/* Bottom Navigation (Only shown when connected) */}
            {connectionStep === 'connected' && <BottomNavigation />}

            {/* Global Modals */}
            <ReconciliationModal />
            <ProjectSwitchDrawer
              isOpen={projectDrawerOpen}
              onClose={() => setProjectDrawerOpen(false)}
              onManageWorkspaces={() => setProjectDrawerOpen(false)}
            />
          </div>
        )}
      </div>
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
