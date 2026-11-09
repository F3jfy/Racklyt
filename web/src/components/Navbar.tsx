import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Server,
  Users,
  Settings,
  Bell,
  LogOut,
  Edit3,
  Check,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../api/client';
import { AccentColorPicker } from './AccentColorPicker';

interface NavbarProps {
  currentView: 'dashboard' | 'nodes' | 'users' | 'settings';
  setCurrentView: (view: 'dashboard' | 'nodes' | 'users' | 'settings') => void;
  isEditingDashboard: boolean;
  setIsEditingDashboard: (val: boolean) => void;
  onSaveDashboard?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  isEditingDashboard,
  setIsEditingDashboard,
  onSaveDashboard,
}) => {
  const { user, logout, hasPermission } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const data = await ApiClient.getUnreadCount();
        setUnreadCount(data.unread_count);
      } catch {}
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-surface/90 border-b border-subtle px-6 py-2.5 flex items-center justify-between sticky top-0 z-40 w-full transition-colors">
      {/* Left: Brand & Navigation */}
      <div className="flex items-center space-x-8">
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => setCurrentView('dashboard')}
        >
          <div className="w-8 h-8 rounded-md bg-elevated border border-subtle flex items-center justify-center font-mono font-bold text-accent transition shadow-solid group-hover:border-accent/50">
            R
          </div>
          <div>
            <div className="font-bold tracking-tight text-primaryText text-sm flex items-center space-x-2">
              <span>Racklyt</span>
              <span className="text-[10px] bg-emerald/15 text-emerald font-mono px-1.5 py-0.5 rounded border border-emerald/30 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
                <span>Live Hub</span>
              </span>
            </div>
            <div className="text-[10px] text-mutedText font-mono">Infrastructure Observability</div>
          </div>
        </div>

        <nav className="flex items-center space-x-1.5 text-xs">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`px-3.5 py-1.5 rounded-md flex items-center space-x-1.5 transition ${
              currentView === 'dashboard'
                ? 'bg-elevated text-primaryText font-semibold border border-subtle shadow-solid'
                : 'text-mutedText hover:text-primaryText hover:bg-elevated/40'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-accent" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentView('nodes')}
            className={`px-3.5 py-1.5 rounded-md flex items-center space-x-1.5 transition ${
              currentView === 'nodes'
                ? 'bg-elevated text-primaryText font-semibold border border-subtle shadow-solid'
                : 'text-mutedText hover:text-primaryText hover:bg-elevated/40'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-accent" />
            <span>Infrastructure Fleet</span>
          </button>

          {hasPermission('users:manage') && (
            <button
              onClick={() => setCurrentView('users')}
              className={`px-3.5 py-1.5 rounded-md flex items-center space-x-1.5 transition ${
                currentView === 'users'
                  ? 'bg-elevated text-primaryText font-semibold border border-subtle shadow-solid'
                  : 'text-mutedText hover:text-primaryText hover:bg-elevated/40'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-accent" />
              <span>Users & RBAC</span>
            </button>
          )}

          <button
            onClick={() => setCurrentView('settings')}
            className={`px-3.5 py-1.5 rounded-md flex items-center space-x-1.5 transition ${
              currentView === 'settings'
                ? 'bg-elevated text-primaryText font-semibold border border-subtle shadow-solid'
                : 'text-mutedText hover:text-primaryText hover:bg-elevated/40'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-accent" />
            <span>Settings & Ingress</span>
          </button>
        </nav>
      </div>

      {/* Right: Actions, Custom Accent, Notifications & Profile */}
      <div className="flex items-center space-x-3 text-xs">
        {currentView === 'dashboard' && (
          <div className="flex items-center space-x-2 mr-2">
            {!isEditingDashboard ? (
              <button
                onClick={() => setIsEditingDashboard(true)}
                className="px-3 py-1.5 bg-elevated hover:bg-subtle text-mutedText hover:text-primaryText border border-subtle rounded-md flex items-center space-x-1.5 transition shadow-solid"
              >
                <Edit3 className="w-3.5 h-3.5 text-accent" />
                <span>Customize Layout</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsEditingDashboard(false)}
                  className="px-2.5 py-1.5 bg-elevated hover:bg-subtle text-mutedText hover:text-primaryText border border-subtle rounded-md text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (onSaveDashboard) onSaveDashboard();
                    setIsEditingDashboard(false);
                  }}
                  className="px-3 py-1.5 bg-accent text-white font-medium rounded-md flex items-center space-x-1.5 hover:opacity-90 transition shadow-solid"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Layout</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Custom Accent Color Palette Trigger */}
        <AccentColorPicker />

        {/* Notifications Popover Trigger */}
        <div className="relative">
          <button
            className="p-1.5 rounded-md hover:bg-elevated text-mutedText hover:text-primaryText border border-transparent hover:border-subtle relative transition"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-coral text-white font-mono font-bold text-[9px] px-1 rounded-full animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="h-4 w-px bg-subtle" />

        {/* User Pill */}
        <div className="flex items-center space-x-2.5 bg-elevated/70 border border-subtle px-3 py-1 rounded-md shadow-solid">
          <Shield className="w-3.5 h-3.5 text-accent" />
          <div className="flex flex-col text-left">
            <span className="font-semibold text-primaryText leading-none text-[11px]">{user?.username}</span>
            <span className="text-[9px] text-mutedText font-mono uppercase leading-none mt-0.5">
              {user?.role_id.replace('role_', '')}
            </span>
          </div>
          <button
            onClick={logout}
            className="ml-1 p-1 hover:text-coral text-mutedText transition"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
