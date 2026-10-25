import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Files,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Trash2,
  X,
  Pin,
  Archive,
  Search,
  PanelLeftClose,
  MoreHorizontal,
  Edit2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSidebar } from '../../context/SidebarContext';
import { chatApi } from '../../api/chat';
import ArchivedModal from '../chat/ArchivedModal';
import ConfirmationModal from '../common/ConfirmationModal';
import Modal from '../common/Modal';
import Button from '../common/Button';

const navItems = [
  { name: 'Playground', path: '/chat', icon: MessageSquare },
  { name: 'Documents', path: '/documents', icon: Files },
  { name: 'Dashboard', path: '/', icon: BarChart3 },
];

export default function Sidebar({ isMobileOpen = false, onCloseMobile = () => {} }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    conversations,
    activeConvId,
    startNewChat,
    selectConversation,
    deleteConversation,
    pinConversation,
    archiveConversation,
    renameConversation,
  } = useChat();
  const { isSidebarCollapsed, toggleSidebarCollapse } = useSidebar();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [deleteTargetConv, setDeleteTargetConv] = useState(null);
  const [isDeletingConv, setIsDeletingConv] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);

  // Conversation 3-dots options menu & Rename states (matching Reference Image 3)
  const [activeMenuConvId, setActiveMenuConvId] = useState(null);
  const [renameTargetConv, setRenameTargetConv] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const convMenuRef = useRef(null);

  // Close conversation 3-dots menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!activeMenuConvId) return;
    const handleOutside = (e) => {
      if (convMenuRef.current && !convMenuRef.current.contains(e.target)) {
        setActiveMenuConvId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveMenuConvId(null);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuConvId]);

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameTargetConv || !renameTitle.trim()) return;
    try {
      await renameConversation(renameTargetConv.id, renameTitle.trim());
      setRenameTargetConv(null);
    } catch (err) {
      setAlertInfo({ title: 'Rename Error', message: 'Failed to rename conversation.' });
    }
  };

  const handleNewChat = () => {
    startNewChat(navigate);
    onCloseMobile();
  };

  // Keyboard shortcut Ctrl+K / Cmd+K to start New Chat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewChat]);

  // Debounced conversation search
  useEffect(() => {
    const term = searchQuery.trim();
    if (!term) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await chatApi.searchConversations(term);
        setSearchResults(results || []);
      } catch (err) {
        console.error('Conversation search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const confirmDeleteConversation = async () => {
    if (!deleteTargetConv) return;
    setIsDeletingConv(true);
    try {
      await deleteConversation(deleteTargetConv.id);
      setDeleteTargetConv(null);
    } catch (err) {
      setAlertInfo({ title: 'Delete Error', message: 'Failed to delete conversation. Please try again.' });
    } finally {
      setIsDeletingConv(false);
    }
  };

  const handleTogglePin = async (e, conv) => {
    e.stopPropagation();
    try {
      await pinConversation(conv.id, !conv.is_pinned);
    } catch (err) {
      setAlertInfo({ title: 'Pin Error', message: 'Failed to update conversation pin status.' });
    }
  };

  const handleArchive = async (e, convId) => {
    e.stopPropagation();
    try {
      await archiveConversation(convId);
    } catch (err) {
      setAlertInfo({ title: 'Archive Error', message: 'Failed to archive conversation.' });
    }
  };

  // Separate pinned and recent conversations
  const pinnedConvs = useMemo(
    () => conversations.filter((c) => c.is_pinned),
    [conversations]
  );
  const recentConvs = useMemo(
    () => conversations.filter((c) => !c.is_pinned),
    [conversations]
  );

  const renderConversationItem = (conv) => {
    const isActive = conv.id === activeConvId;
    const isMenuOpen = activeMenuConvId === conv.id;

    return (
      <div
        key={conv.id}
        onClick={() => {
          selectConversation(conv.id, navigate);
          onCloseMobile();
        }}
        className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-normal cursor-pointer transition ${
          isActive
            ? 'bg-[#242423] text-[#f5f5f5] font-medium'
            : 'text-[#c7c7c7] hover:text-white hover:bg-[#252524]'
        }`}
      >
        <div className="flex items-center min-w-0 pr-2">
          <span className="truncate">{conv.title || 'Untitled chat'}</span>
        </div>

        {/* Action icons / Three Dots Button */}
        <div className="shrink-0 flex items-center gap-1">
          {conv.is_pinned && (
            <Pin className="w-3 h-3 text-[#666666] shrink-0 fill-current opacity-70 group-hover:opacity-100 transition" />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuConvId(isMenuOpen ? null : conv.id);
            }}
            className={`p-1 rounded-md transition cursor-pointer ${
              isMenuOpen
                ? 'opacity-100 text-white bg-[#2f2f2e]'
                : 'opacity-0 group-hover:opacity-100 text-[#8a8a8a] hover:text-white hover:bg-[#282827]'
            }`}
            title="More options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Three Dots Dropdown Popover Menu (matching Reference Image 3) */}
        {isMenuOpen && (
          <div
            ref={convMenuRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-full mt-1 w-44 bg-[#212121] border border-[#333333] rounded-xl shadow-2xl p-1 z-50 animate-slide-up select-none"
          >
            {/* Edit chat name */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRenameTitle(conv.title || '');
                setRenameTargetConv(conv);
                setActiveMenuConvId(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-normal text-[#d4d4d4] hover:text-white hover:bg-[#2a2a2a] transition cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#9e9e9e]" />
              <span>Edit chat name</span>
            </button>

            {/* Pin to top / Unpin */}
            <button
              type="button"
              onClick={(e) => {
                handleTogglePin(e, conv);
                setActiveMenuConvId(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-normal text-[#d4d4d4] hover:text-white hover:bg-[#2a2a2a] transition cursor-pointer"
            >
              <Pin
                className={`w-3.5 h-3.5 ${
                  conv.is_pinned ? 'text-white fill-current' : 'text-[#9e9e9e]'
                }`}
              />
              <span>{conv.is_pinned ? 'Unpin' : 'Pin to top'}</span>
            </button>

            {/* Archive */}
            <button
              type="button"
              onClick={(e) => {
                handleArchive(e, conv.id);
                setActiveMenuConvId(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-normal text-[#d4d4d4] hover:text-amber-300 hover:bg-[#2a2a2a] transition cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-[#9e9e9e]" />
              <span>Archive</span>
            </button>

            {/* Delete (Red text matching Reference Image 3) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTargetConv(conv);
                setActiveMenuConvId(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-normal text-rose-500 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const content = (
    <div className="h-full flex flex-col justify-between p-3 select-none bg-[#181817] font-sans">
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Top Header Row with Favicon2 Logo & Sidebar Retract Toggle like Kimi */}
        <div className="flex items-center justify-between px-1 shrink-0">
          <Link
            to="/"
            onClick={onCloseMobile}
            className="flex items-center gap-2 group cursor-pointer"
            title="docvyn"
          >
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-[#1c1c1e] flex items-center justify-center border border-[#2d2d2b] shadow-sm group-hover:border-[#424240] transition">
              <img
                src="/favicon2.svg"
                alt="docvyn"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          {/* Desktop Retract / Collapse button */}
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            className="hidden md:flex p-1.5 rounded-lg text-[#757575] hover:text-[#d4d4d4] hover:bg-[#222221] transition cursor-pointer"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="flex md:hidden p-1 text-[#757575] hover:text-[#d4d4d4]"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Gap 1: Header to New Chat Button */}
        <div className="mt-3.5 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full px-3.5 py-2.5 bg-[#1f1f1f] hover:bg-[#252524] border border-white/15 hover:border-white/25 text-[#d4d4d4] hover:text-white rounded-[12px] text-[13px] font-normal flex items-center justify-between transition-all duration-150 group cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Plus className="w-4 h-4 text-[#b0b0b0] group-hover:scale-110 group-hover:text-white transition" />
              <span>New chat</span>
            </div>
            <span className="text-[10px] text-[#707070] px-1.5 py-0.5 rounded font-mono border border-[#383838] bg-[#262626]/50">
              Ctrl K
            </span>
          </button>
        </div>

        {/* Section Gap 2: New Chat to Nav Items */}
        <div className="mt-4 space-y-1.5 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-normal transition-all duration-150 ${
                    isActive
                      ? 'text-[#f5f5f5] bg-[#242423] font-medium'
                      : 'text-[#c7c7c7] hover:text-white hover:bg-[#252524]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0 text-[#b0b0b0]" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}

          {/* Archived Chats Tab */}
          <button
            onClick={() => {
              setShowArchivedModal(true);
              onCloseMobile();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-normal text-[#c7c7c7] hover:text-white hover:bg-[#252524] transition-all duration-150 cursor-pointer"
          >
            <Archive className="w-4 h-4 shrink-0 text-[#b0b0b0]" />
            <span>Archived Chats</span>
          </button>
        </div>

        {/* Section Gap 3: Nav Items to History & Search (generous 24px top margin matching Kimi) */}
        <div className="mt-6 flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Search Box */}
          <div className="px-1 pb-2 shrink-0">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[#666666] absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full bg-[#1f1f1f] border border-[#2d2d2d] focus:border-[#404040] rounded-lg pl-8 pr-6 py-2 text-[12px] font-normal text-[#d4d4d4] placeholder-[#666666] outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[#707070] hover:text-white text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {searchQuery.trim() ? (
              /* Search Results View */
              <div>
                <div className="px-2.5 pt-1 pb-1.5 text-[11px] font-normal text-[#666666]">
                  Search Results {isSearching ? '...' : `(${searchResults.length})`}
                </div>
                {searchResults.length === 0 && !isSearching ? (
                  <p className="px-2.5 py-3 text-[12px] text-[#666666]">No matching conversations</p>
                ) : (
                  searchResults.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        selectConversation(res.id, navigate);
                        onCloseMobile();
                      }}
                      className="group p-2.5 rounded-lg text-[13px] font-normal cursor-pointer hover:bg-[#252524] transition border border-transparent hover:border-[#2d2d2d]"
                    >
                      <p className="text-[#d4d4d4] truncate">{res.title}</p>
                      {res.snippet && (
                        <p className="text-[11px] text-[#707070] mt-0.5 line-clamp-2">
                          {res.snippet}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Normal View: Pinned & Recent */
              <>
                {pinnedConvs.length > 0 && (
                  <div>
                    <div className="px-2.5 pt-2 pb-1.5 text-[11px] font-normal text-[#666666] flex items-center justify-between select-none">
                      <span>Pinned</span>
                      <span className="text-[10px] text-[#555555] font-mono">
                        {pinnedConvs.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {pinnedConvs.map(renderConversationItem)}
                    </div>
                  </div>
                )}

                <div className={pinnedConvs.length > 0 ? 'mt-5' : ''}>
                  <div className="px-2.5 pt-2 pb-1.5 text-[11px] font-normal text-[#666666] flex items-center justify-between select-none">
                    <span>Chats</span>
                    {recentConvs.length > 0 && (
                      <span className="text-[10px] text-[#555555] font-mono">
                        {recentConvs.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {recentConvs.length === 0 && pinnedConvs.length === 0 ? (
                      <p className="px-2.5 py-2 text-[12px] text-[#666666]">No chats yet</p>
                    ) : (
                      recentConvs.map(renderConversationItem)
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Section Gap 4: History to User Profile Footer (16px with border separator) */}
      {user && (
        <div className="mt-4 pt-3.5 border-t border-[#262625] shrink-0">
          <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#1e1e1e] transition group">
            {/* User Avatar & Name */}
            <Link
              to="/profile"
              onClick={onCloseMobile}
              className="flex items-center gap-2.5 min-w-0 flex-1 select-none pr-1 cursor-pointer"
              title="Account settings"
            >
              <div className="w-6 h-6 rounded-full bg-[#262625] text-[#d4d4d4] font-medium text-[11px] flex items-center justify-center border border-[#333333] shrink-0 select-none">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  (user.full_name || user.email || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-normal text-[#c4c4c4] truncate leading-tight">
                  {user.full_name || user.email?.split('@')[0] || 'User'}
                </p>
              </div>
            </Link>

            {/* Settings & Logout Quick Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <Link
                to="/profile"
                onClick={onCloseMobile}
                title="Settings"
                className="p-1 text-[#666666] hover:text-[#d4d4d4] rounded transition"
              >
                <Settings className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1 text-[#666666] hover:text-rose-400 rounded transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archived Conversations Modal */}
      {showArchivedModal && (
        <ArchivedModal
          isOpen={showArchivedModal}
          onClose={() => setShowArchivedModal(false)}
          onSelectConversation={(id) => selectConversation(id, navigate)}
        />
      )}

      {/* Rename Conversation Modal */}
      {renameTargetConv && (
        <Modal
          isOpen={Boolean(renameTargetConv)}
          onClose={() => setRenameTargetConv(null)}
          title="Edit Chat Name"
        >
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-[#555555] outline-none"
              placeholder="Conversation title"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenameTargetConv(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Conversation Confirmation Modal */}
      {deleteTargetConv && (
        <ConfirmationModal
          isOpen={Boolean(deleteTargetConv)}
          onClose={() => !isDeletingConv && setDeleteTargetConv(null)}
          onConfirm={confirmDeleteConversation}
          title="Delete Conversation"
          message={`Are you sure you want to delete "${deleteTargetConv.title || 'this conversation'}"? This will permanently remove its entire message history.`}
          confirmText="Delete"
          variant="danger"
          isLoading={isDeletingConv}
        />
      )}

      {/* Alert Modal for Errors */}
      {alertInfo && (
        <ConfirmationModal
          isOpen={Boolean(alertInfo)}
          onClose={() => setAlertInfo(null)}
          title={alertInfo.title}
          message={alertInfo.message}
          type="error"
        />
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent / Retractable Sidebar */}
      <aside
        className={`shrink-0 hidden md:flex flex-col bg-[#181817] h-full overflow-hidden transition-all duration-200 ease-in-out ${
          isSidebarCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-60 opacity-100'
        }`}
      >
        <div className="w-60 h-full flex flex-col justify-between">
          {content}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          {/* Drawer content */}
          <div className="relative w-72 max-w-[80vw] bg-[#181817] h-full shadow-2xl border-r border-[#262626] z-10 animate-slide-up">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
