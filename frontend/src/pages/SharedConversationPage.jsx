import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bookmark, User, ShieldCheck, AlertCircle } from 'lucide-react';
import { chatApi } from '../api/chat';
import MarkdownRenderer from '../components/chat/MarkdownRenderer';
import DocvynLogo from '../components/common/DocvynLogo';
import Spinner from '../components/common/Spinner';

export default function SharedConversationPage() {
  const { shareToken } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadShared() {
      setLoading(true);
      setError(null);
      try {
        const res = await chatApi.getSharedConversation(shareToken);
        setData(res);
      } catch (err) {
        setError(
          err.response?.status === 404
            ? 'This shared conversation does not exist or its access link was revoked by the creator.'
            : 'Could not load shared conversation. Please check your connection and try again.'
        );
      } finally {
        setLoading(false);
      }
    }
    if (shareToken) {
      loadShared();
    }
  }, [shareToken]);

  return (
    <div className="min-h-screen bg-[#141414] text-[#ededed] flex flex-col font-sans select-text">
      {/* Top Navbar */}
      <header className="h-14 border-b border-[#242424] bg-[#141414] px-4 sm:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <DocvynLogo className="h-7 w-auto text-white" />
          <span className="text-[11px] bg-[#222222] text-[#8e8e8e] px-2 py-0.5 rounded-full border border-[#2e2e2e] flex items-center gap-1 font-medium select-none">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Read-Only View</span>
          </span>
        </div>

        <Link
          to="/login"
          className="text-xs font-medium text-white bg-[#222222] hover:bg-[#2c2c2c] border border-[#2e2e2e] px-3 py-1.5 rounded-lg transition"
        >
          Sign In
        </Link>
      </header>

      {/* Main View */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-[#8e8e8e]">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-400 stroke-[1.5]" />
            <h2 className="text-lg font-heading font-semibold text-white">
              Conversation Unavailable
            </h2>
            <p className="text-sm text-[#8e8e8e] max-w-md">{error}</p>
            <div className="pt-4">
              <Link
                to="/login"
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-white text-[#141414] hover:bg-[#e5e5e5] transition"
              >
                Go to docvyn
              </Link>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Title & Metadata */}
            <div className="pb-4 border-b border-[#242424]">
              <h1 className="text-2xl font-heading font-semibold text-white">
                {data.title}
              </h1>
              <p className="text-xs text-[#707070] mt-1 font-sans">
                Shared on {new Date(data.created_at).toLocaleDateString()} · {data.messages.length} messages
              </p>
            </div>

            {/* Messages Thread */}
            <div className="space-y-6">
              {data.messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-start gap-3 max-w-3xl w-full">
                      {!isUser && (
                        <div className="w-7 h-7 rounded-full bg-[#242424] text-white flex items-center justify-center shrink-0 mt-1 border border-[#333333] select-none text-xs font-bold font-aleo">
                          d
                        </div>
                      )}

                      <div
                        className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm w-full ${
                          isUser
                            ? 'bg-[#222222] border border-[#2e2e2e] text-white rounded-tr-sm ml-auto max-w-2xl'
                            : 'bg-[#1a1a1a] border border-[#262626] text-[#ededed] rounded-tl-sm'
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap font-sans text-sm text-white">
                            {msg.content}
                          </p>
                        ) : (
                          <MarkdownRenderer content={msg.content} />
                        )}
                      </div>

                      {isUser && (
                        <div className="w-7 h-7 rounded-full bg-[#222222] text-[#8e8e8e] flex items-center justify-center shrink-0 mt-1 select-none border border-[#2c2c2c]">
                          <User className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    {/* Citations / Sources */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3.5 pl-10 max-w-3xl w-full">
                        <p className="font-sans text-[11px] font-semibold text-[#8e8e8e] uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
                          <Bookmark className="w-3.5 h-3.5 text-white/80" />
                          <span>Sources ({msg.citations.length})</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {msg.citations.map((citation, citIdx) => (
                            <div
                              key={citIdx}
                              className="bg-[#1a1a1a] border border-[#282828] p-3 rounded-xl shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2 select-none">
                                <span className="text-[10px] font-semibold tracking-wider text-white bg-[#262626] px-2 py-0.5 rounded border border-[#333333]">
                                  Source {citIdx + 1}
                                </span>
                                {citation.page_number && (
                                  <span className="text-[11px] text-[#707070]">
                                    Page {citation.page_number}
                                  </span>
                                )}
                              </div>
                              <p className="font-heading font-medium text-xs text-white mt-2 truncate">
                                {citation.document_title}
                              </p>
                              <p className="font-sans text-[11px] text-[#8e8e8e] mt-1 line-clamp-3 leading-relaxed">
                                {citation.snippet}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Read-Only Notice Footer */}
            <div className="pt-8 mt-12 border-t border-[#242424] text-center text-xs text-[#707070] space-y-2 select-none">
              <p>This is a read-only conversation shared via docvyn.</p>
              <p>
                Want to analyze and chat with your own documents?{' '}
                <Link to="/register" className="text-white hover:underline font-medium">
                  Create a free account
                </Link>
              </p>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
