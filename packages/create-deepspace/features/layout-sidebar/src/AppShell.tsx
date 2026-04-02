import React, { useState, createContext, useContext, ReactNode } from 'react';
import { Menu, X, ChevronLeft } from 'lucide-react';

// ============================================================================
// Context for sidebar state
// ============================================================================

interface SidebarContextValue {
  isOpen: boolean;
  isCollapsed: boolean;
  setIsOpen: (open: boolean) => void;
  setIsCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  toggleCollapse: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within AppShell');
  return ctx;
}

// ============================================================================
// AppShell - Main layout wrapper
// ============================================================================

interface AppShellProps {
  children: ReactNode;
  defaultCollapsed?: boolean;
}

export function AppShell({ children, defaultCollapsed = false }: AppShellProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false); // Mobile menu open
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleSidebar = (): void => setIsOpen(!isOpen);
  const toggleCollapse = (): void => setIsCollapsed(!isCollapsed);

  return (
    <SidebarContext.Provider
      value={{ isOpen, isCollapsed, setIsOpen, setIsCollapsed, toggleSidebar, toggleCollapse }}
    >
      <div className="flex h-screen bg-background overflow-hidden">
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

// ============================================================================
// AppShell.Sidebar - Collapsible sidebar
// ============================================================================

interface SidebarProps {
  children: ReactNode;
  className?: string;
}

function Sidebar({ children, className = '' }: SidebarProps): JSX.Element {
  const { isOpen, isCollapsed, setIsOpen } = useSidebar();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
          ${isCollapsed ? 'md:w-16' : 'md:w-64'}
          ${className}
        `}
        style={{ width: isCollapsed ? undefined : '16rem' }}
      >
        {children}
      </aside>
    </>
  );
}

// ============================================================================
// AppShell.SidebarHeader
// ============================================================================

interface SidebarHeaderProps {
  children: ReactNode;
  className?: string;
}

function SidebarHeader({ children, className = '' }: SidebarHeaderProps): JSX.Element {
  const { isCollapsed, setIsOpen } = useSidebar();

  return (
    <div className={`flex items-center h-14 px-4 border-b border-border ${className}`}>
      <div className={`flex-1 ${isCollapsed ? 'hidden' : ''}`}>{children}</div>
      <button
        onClick={() => setIsOpen(false)}
        className="p-2 rounded-lg hover:bg-muted md:hidden"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// ============================================================================
// AppShell.SidebarContent - Scrollable nav area
// ============================================================================

interface SidebarContentProps {
  children: ReactNode;
  className?: string;
}

function SidebarContent({ children, className = '' }: SidebarContentProps): JSX.Element {
  return (
    <nav className={`flex-1 overflow-y-auto p-2 ${className}`}>
      {children}
    </nav>
  );
}

// ============================================================================
// AppShell.SidebarFooter
// ============================================================================

interface SidebarFooterProps {
  children: ReactNode;
  className?: string;
}

function SidebarFooter({ children, className = '' }: SidebarFooterProps): JSX.Element {
  return (
    <div className={`p-2 border-t border-border ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// AppShell.SidebarToggle - Collapse button
// ============================================================================

function SidebarToggle(): JSX.Element {
  const { isCollapsed, toggleCollapse } = useSidebar();

  return (
    <button
      onClick={toggleCollapse}
      className="hidden md:flex items-center justify-center w-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
      title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <ChevronLeft className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
    </button>
  );
}

// ============================================================================
// AppShell.Main - Main content area
// ============================================================================

interface MainProps {
  children: ReactNode;
  className?: string;
}

function Main({ children, className = '' }: MainProps): JSX.Element {
  return (
    <main className={`flex-1 flex flex-col overflow-hidden ${className}`}>
      {children}
    </main>
  );
}

// ============================================================================
// AppShell.Header - Top header bar
// ============================================================================

interface HeaderProps {
  children: ReactNode;
  className?: string;
}

function Header({ children, className = '' }: HeaderProps): JSX.Element {
  const { toggleSidebar } = useSidebar();

  return (
    <header className={`flex items-center h-14 px-4 border-b border-border bg-card ${className}`}>
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:bg-muted md:hidden mr-2"
      >
        <Menu className="w-5 h-5" />
      </button>
      {children}
    </header>
  );
}

// ============================================================================
// AppShell.Content - Scrollable content area
// ============================================================================

interface ContentProps {
  children: ReactNode;
  className?: string;
}

function Content({ children, className = '' }: ContentProps): JSX.Element {
  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-6 ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// NavItem - Navigation item component
// ============================================================================

interface NavItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: number | string;
  onClick?: () => void;
}

export function NavItem({ icon, label, active, badge, onClick }: NavItemProps): JSX.Element {
  const { isCollapsed } = useSidebar();

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium
        transition-colors
        ${active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }
      `}
      title={isCollapsed ? label : undefined}
    >
      <span className="shrink-0">{icon}</span>
      {!isCollapsed && (
        <>
          <span className="flex-1 text-left truncate">{label}</span>
          {badge !== undefined && (
            <span className={`
              px-2 py-0.5 text-xs rounded-full
              ${active ? 'bg-primary-foreground/20' : 'bg-muted'}
            `}>
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ============================================================================
// Attach sub-components
// ============================================================================

AppShell.Sidebar = Sidebar;
AppShell.SidebarHeader = SidebarHeader;
AppShell.SidebarContent = SidebarContent;
AppShell.SidebarFooter = SidebarFooter;
AppShell.SidebarToggle = SidebarToggle;
AppShell.Main = Main;
AppShell.Header = Header;
AppShell.Content = Content;

export default AppShell;
