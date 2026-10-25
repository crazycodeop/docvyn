import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { useSidebar } from '../context/SidebarContext';
import { User, Mail, CheckCircle2, AlertCircle, Check, PanelLeftOpen } from 'lucide-react';

export default function ProfilePage() {
  const { isSidebarCollapsed, toggleSidebarCollapse } = useSidebar();
  const { user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await authApi.updateMe({ full_name: fullName });
      await refreshProfile();
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError('Unable to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 max-w-4xl space-y-6 pb-16 animate-fade-in bg-[#121212] text-white">
      <div className="flex items-center gap-3">
        {isSidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            className="hidden md:flex p-2 rounded-xl text-[#8e8e8e] hover:text-white hover:bg-[#202020] border border-[#2c2c2b] transition cursor-pointer shrink-0"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-white">
            Settings
          </h1>
          <p className="font-sans text-xs sm:text-sm text-[#8e8e8e] mt-1 leading-relaxed">
            Manage your account profile and workspace preferences.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3.5 bg-[#16211a] border border-[#223929] rounded-xl text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-[#251717] border border-[#3e2222] rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Workspace Status Card */}
      <Card title="Workspace Status">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-[#141414] border border-[#282828] flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-white mb-0.5">Document Search</div>
              <p className="text-[11px] text-[#8e8e8e]">Ready to answer questions from your uploaded files</p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#16211a] border border-[#223929] text-emerald-400 text-[11px] font-medium shrink-0">
              <Check className="w-3 h-3" />
              <span>Active</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#141414] border border-[#282828] flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-white mb-0.5">AI Assistant</div>
              <p className="text-[11px] text-[#8e8e8e]">High-accuracy responses with source citations</p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#16211a] border border-[#223929] text-emerald-400 text-[11px] font-medium shrink-0">
              <Check className="w-3 h-3" />
              <span>Ready</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Personal Information */}
      <Card title="Personal Information">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={User}
            required
          />

          <Input
            label="Email Address"
            value={user?.email || ''}
            disabled
            helperText="Your email address is your account login."
            icon={Mail}
          />

          <div className="pt-2">
            <Button type="submit" variant="primary" size="sm" isLoading={loading}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Account Details */}
      <Card title="Account Details">
        <div className="space-y-3 text-xs text-[#a0a0a0]">
          <div className="flex justify-between py-2 border-b border-[#242424]">
            <span className="text-[#8e8e8e]">Account Role</span>
            <span className="font-medium text-white capitalize">
              {user?.role || 'user'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#242424]">
            <span className="text-[#8e8e8e]">Sign-in Method</span>
            <span className="font-medium text-white capitalize">
              {user?.auth_provider || 'Email & Password'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[#8e8e8e]">Account ID</span>
            <span className="font-mono text-[#707070]">{user?.id}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
