import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsApi } from '../api/stats';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Badge from '../components/common/Badge';
import { useSidebar } from '../context/SidebarContext';
import {
  FileText,
  MessageSquare,
  HardDrive,
  Layers,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Plus,
  AlertCircle,
  Calendar,
  PanelLeftOpen,
} from 'lucide-react';

export default function DashboardPage() {
  const { isSidebarCollapsed, toggleSidebarCollapse } = useSidebar();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timelineMetric, setTimelineMetric] = useState('both'); // 'docs', 'messages', 'both'

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await statsApi.getDashboardStats();
      setStats(data);
      setError('');
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setError('Unable to load workspace statistics. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#0a0a0a] text-white">
        <Spinner size="lg" />
        <p className="mt-4 text-xs font-medium text-[#a1a1aa]">
          Loading workspace statistics...
        </p>
      </div>
    );
  }

  const totalDocs = stats?.total_documents ?? 0;
  const totalChunks = stats?.total_chunks ?? 0;
  const totalConvs = stats?.total_conversations ?? 0;
  const totalMessages = stats?.total_messages ?? 0;
  const storageUsed = stats?.storage_used_bytes ?? 0;
  const statusCounts = stats?.status_counts || {};
  const recentDocs = stats?.recent_documents || [];
  const ingestionHistory = stats?.daily_ingestion_history || [];
  const messageHistory = stats?.daily_message_history || [];

  // Calculate timeline peak for proportional chart rendering
  const maxDocCount = Math.max(...ingestionHistory.map((d) => d.count), 1);
  const maxMsgCount = Math.max(...messageHistory.map((d) => d.count), 1);
  const chartPeak = Math.max(maxDocCount, maxMsgCount, 4);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 space-y-6 pb-16 animate-fade-in bg-[#0a0a0a] text-white">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden md:flex p-2 rounded-xl text-[#a1a1aa] hover:text-white hover:bg-white/[0.05] border border-white/[0.06] transition cursor-pointer shrink-0"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Dashboard
            </h1>
            <p className="font-sans text-xs sm:text-sm text-[#a1a1aa] mt-1 leading-relaxed">
              Real-time activity and document overview for your workspace.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={fetchStats}
          >
            Refresh
          </Button>
          <Link to="/documents">
            <Button variant="primary" size="sm" icon={Plus}>
              Upload document
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-[#251717] border border-[#3e2222] rounded-xl flex items-center gap-2 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Documents */}
        <div className="p-5 rounded-2xl bg-[#161618] border border-white/[0.05] transition duration-150 hover:bg-[#1a1a1d] hover:border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[11px] font-medium text-[#a1a1aa]">
              Documents
            </span>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-heading text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              {totalDocs}
            </span>
          </div>
          <p className="font-sans text-xs text-[#a1a1aa] mt-1">
            {stats?.total_pages ?? 0} total pages
          </p>
        </div>

        {/* Document Sections */}
        <div className="p-5 rounded-2xl bg-[#161618] border border-white/[0.05] transition duration-150 hover:bg-[#1a1a1d] hover:border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[11px] font-medium text-[#a1a1aa]">
              Document Sections
            </span>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-heading text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              {totalChunks}
            </span>
          </div>
          <p className="font-sans text-xs text-[#a1a1aa] mt-1">
            Searchable sections extracted
          </p>
        </div>

        {/* Conversations */}
        <div className="p-5 rounded-2xl bg-[#161618] border border-white/[0.05] transition duration-150 hover:bg-[#1a1a1d] hover:border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[11px] font-medium text-[#a1a1aa]">
              Conversations
            </span>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-heading text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              {totalConvs}
            </span>
          </div>
          <p className="font-sans text-xs text-[#a1a1aa] mt-1">
            {totalMessages} total questions asked
          </p>
        </div>

        {/* Storage Used */}
        <div className="p-5 rounded-2xl bg-[#161618] border border-white/[0.05] transition duration-150 hover:bg-[#1a1a1d] hover:border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[11px] font-medium text-[#a1a1aa]">
              Storage Used
            </span>
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="font-heading text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              {formatBytes(storageUsed)}
            </span>
          </div>
          <p className="font-sans text-xs text-[#a1a1aa] mt-1">
            Total file storage in workspace
          </p>
        </div>
      </div>

      {/* Main Charts & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 14-Day Activity Timeline (8 cols) */}
        <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-[#161618] border border-white/[0.05] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-heading text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span>Workspace Activity</span>
                </h2>
                <p className="font-sans text-xs text-[#a1a1aa] mt-0.5">
                  Daily uploads and questions asked over the last 14 days.
                </p>
              </div>

              {/* Filter toggle */}
              <div className="flex items-center gap-1 bg-[#101010] p-1 rounded-xl border border-white/[0.05] text-xs">
                <button
                  onClick={() => setTimelineMetric('both')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    timelineMetric === 'both'
                      ? 'bg-white/[0.08] text-white font-semibold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTimelineMetric('docs')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    timelineMetric === 'docs'
                      ? 'bg-white/[0.08] text-white font-semibold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  Documents
                </button>
                <button
                  onClick={() => setTimelineMetric('messages')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    timelineMetric === 'messages'
                      ? 'bg-white/[0.08] text-white font-semibold'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  Questions
                </button>
              </div>
            </div>

            {/* Timeline Bars Chart Container */}
            <div className="mt-8 pt-4">
              <div className="h-44 flex items-end justify-between gap-2 px-1 border-b border-white/[0.06] pb-2">
                {ingestionHistory.map((item, idx) => {
                  const docCount = item.count;
                  const msgCount = messageHistory[idx]?.count || 0;
                  const docHeight = Math.max((docCount / chartPeak) * 100, docCount > 0 ? 10 : 3);
                  const msgHeight = Math.max((msgCount / chartPeak) * 100, msgCount > 0 ? 10 : 3);
                  const dayLabel = item.date.slice(5);

                  return (
                    <div
                      key={item.date}
                      className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none bg-[#111111] border border-white/[0.08] text-white text-[11px] rounded-lg px-2.5 py-1 shadow-xl whitespace-nowrap z-20 font-sans">
                        <div className="font-semibold text-white">{item.date}</div>
                        <div className="text-[#a1a1aa]">
                          {docCount} docs • {msgCount} questions
                        </div>
                      </div>

                      {/* Side-by-side or stacked bars */}
                      <div className="w-full max-w-[24px] flex items-end justify-center gap-1 h-full pb-1">
                        {(timelineMetric === 'both' || timelineMetric === 'docs') && (
                          <div
                            className={`w-full rounded-t transition-all duration-300 ${
                              docCount > 0
                                ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.35)]'
                                : 'bg-white/[0.06]'
                            }`}
                            style={{ height: `${docHeight}%` }}
                          />
                        )}
                        {(timelineMetric === 'both' || timelineMetric === 'messages') && (
                          <div
                            className={`w-full rounded-t transition-all duration-300 ${
                              msgCount > 0 ? 'bg-white' : 'bg-white/[0.03]'
                            }`}
                            style={{ height: `${msgHeight}%` }}
                          />
                        )}
                      </div>

                      {/* Day Label */}
                      <span className="text-[10px] text-[#71717a] font-sans mt-1">
                        {idx % 2 === 0 ? dayLabel : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend */}
              <div className="flex items-center justify-between text-xs text-[#a1a1aa] mt-3 pt-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
                    <span className="text-[#e0e0e0]">Documents Uploaded</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                    <span className="text-[#e0e0e0]">Questions Asked</span>
                  </div>
                </div>
                <div className="text-[11px] text-[#71717a]">
                  Peak: {chartPeak} items / day
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Document Status Breakdown (4 cols) */}
        <div className="lg:col-span-4 p-5 sm:p-6 rounded-2xl bg-[#161618] border border-white/[0.05] shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-heading text-base font-semibold text-white tracking-tight">
              Document Status
            </h2>
            <p className="font-sans text-xs text-[#a1a1aa] mt-0.5">
              Current state across uploaded files.
            </p>

            {/* Status breakdown bars */}
            <div className="space-y-3.5 mt-5">
              {/* Ready to use */}
              <div>
                <div className="flex items-center justify-between text-xs font-sans mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
                    <span className="text-[#e0e0e0]">Ready to use</span>
                  </div>
                  <span className="font-mono text-white font-semibold">{statusCounts.completed || 0}</span>
                </div>
                <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)] h-full rounded-full transition-all duration-200"
                    style={{ width: `${totalDocs > 0 ? ((statusCounts.completed || 0) / totalDocs) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Processing */}
              <div>
                <div className="flex items-center justify-between text-xs font-sans mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-[#e0e0e0]">Processing</span>
                  </div>
                  <span className="font-mono text-white font-semibold">{statusCounts.processing || 0}</span>
                </div>
                <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-white h-full rounded-full transition-all duration-200"
                    style={{ width: `${totalDocs > 0 ? ((statusCounts.processing || 0) / totalDocs) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Waiting to process */}
              <div>
                <div className="flex items-center justify-between text-xs font-sans mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#a1a1aa]" />
                    <span className="text-[#e0e0e0]">Waiting to process</span>
                  </div>
                  <span className="font-mono text-white font-semibold">
                    {(statusCounts.queued || 0) + (statusCounts.uploaded || 0)}
                  </span>
                </div>
                <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#a1a1aa] h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${
                        totalDocs > 0
                          ? (((statusCounts.queued || 0) + (statusCounts.uploaded || 0)) / totalDocs) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Couldn't process */}
              <div>
                <div className="flex items-center justify-between text-xs font-sans mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span className="text-[#e0e0e0]">Couldn't process</span>
                  </div>
                  <span className="font-mono text-white font-semibold">{statusCounts.failed || 0}</span>
                </div>
                <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-400 h-full rounded-full transition-all duration-200"
                    style={{ width: `${totalDocs > 0 ? ((statusCounts.failed || 0) / totalDocs) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick link to library */}
          <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-sans">
            <span className="text-[#a1a1aa]">Total: {totalDocs} docs</span>
            <Link to="/documents" className="text-white hover:text-cyan-400 font-semibold inline-flex items-center gap-1 transition-colors">
              <span>View all documents</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Documents Table Feed */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#161618] border border-white/[0.05] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-base font-semibold text-white tracking-tight">
              Recent Documents
            </h2>
            <p className="font-sans text-xs text-[#a1a1aa] mt-0.5">
              Latest files added to your workspace.
            </p>
          </div>
          <Link
            to="/documents"
            className="text-xs font-sans font-semibold text-white hover:text-cyan-400 inline-flex items-center gap-1 transition-colors"
          >
            <span>All Documents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentDocs.length === 0 ? (
          <div className="py-10 text-center text-[#a1a1aa] font-sans text-xs">
            <FileText className="w-8 h-8 text-[#555555] mx-auto mb-2" />
            <p>No documents uploaded yet in this workspace.</p>
            <Link to="/documents" className="mt-3 inline-block">
              <Button variant="primary" size="sm" icon={Plus}>
                Upload document
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs text-[#ededed]">
                <thead className="bg-[#101010] text-[#a1a1aa] text-[11px] font-semibold border-b border-white/[0.06]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Document</th>
                    <th className="px-4 py-3 font-semibold">Size</th>
                    <th className="px-4 py-3 font-semibold">Pages</th>
                    <th className="px-4 py-3 font-semibold">Sections</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {recentDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-white/[0.02] transition duration-150">
                      <td className="px-4 py-3 font-semibold text-white truncate max-w-xs">
                        {doc.title || doc.filename}
                      </td>
                      <td className="px-4 py-3 text-[#a1a1aa]">
                        {formatBytes(doc.file_size)}
                      </td>
                      <td className="px-4 py-3 text-[#e0e0e0]">
                        {doc.page_count > 0 ? doc.page_count : 1}
                      </td>
                      <td className="px-4 py-3 text-[#e0e0e0]">
                        {doc.chunk_count > 0 ? `${doc.chunk_count} sections` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={doc.status} />
                      </td>
                      <td className="px-4 py-3 text-[#a1a1aa]">
                        {doc.created_at ? doc.created_at.slice(0, 10) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden divide-y divide-white/[0.04]">
              {recentDocs.map((doc) => (
                <div key={doc.id} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading font-semibold text-white text-xs truncate max-w-[200px]">
                      {doc.title || doc.filename}
                    </p>
                    <Badge status={doc.status} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#a1a1aa]">
                    <span>{formatBytes(doc.file_size)}</span>
                    <span>•</span>
                    <span>{doc.page_count > 0 ? `${doc.page_count}p` : '1p'}</span>
                    <span>•</span>
                    <span>{doc.chunk_count > 0 ? `${doc.chunk_count} sections` : '0 sections'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
