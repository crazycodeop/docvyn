import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PropTypes from 'prop-types';
import { Copy, Check } from 'lucide-react';

function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code block:', err);
    }
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-[#282828] bg-[#141414] select-text group">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1c1c1c] border-b border-[#282828] text-[11px] text-[#8e8e8e] font-mono select-none">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[#8e8e8e] hover:text-white px-2 py-0.5 rounded hover:bg-[#282828] transition cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans text-[11px]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-sans text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto font-mono text-xs leading-relaxed text-[#ededed] select-text">
        <code>{value}</code>
      </pre>
    </div>
  );
}

CodeBlock.propTypes = {
  language: PropTypes.string,
  value: PropTypes.string.isRequired,
};

export default function MarkdownRenderer({ content = '' }) {
  return (
    <div className="markdown-content select-text font-sans text-sm leading-relaxed text-[#ededed]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-2 leading-relaxed text-[#ededed] select-text font-sans">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white select-text">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[#d4d4d4] select-text">
              {children}
            </em>
          ),
          h1: ({ children }) => (
            <h1 className="font-heading text-lg font-bold text-white mt-4 mb-2 tracking-tight select-text border-b border-[#262626] pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-heading text-base font-bold text-white mt-3.5 mb-1.5 tracking-tight select-text">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-heading text-sm font-semibold text-white mt-2.5 mb-1 tracking-tight select-text">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 my-2 space-y-1 text-[#d4d4d4] select-text">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 my-2 space-y-1 text-[#d4d4d4] select-text">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed select-text pl-1">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-white/60 pl-3.5 py-0.5 my-2.5 text-[#a0a0a0] italic select-text bg-[#1c1c1c]/50 rounded-r-lg">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-[#282828] select-text">
              <table className="min-w-full text-xs text-left divide-y divide-[#282828]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#1c1c1c] text-white font-heading font-semibold select-text">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-[#262626] bg-[#141414] select-text">
              {children}
            </tbody>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left select-text font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 select-text text-[#b0b0b0]">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline hover:text-[#d4d4d4] transition select-text"
            >
              {children}
            </a>
          ),
          code: ({ inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const rawContent = String(children).replace(/\n$/, '');

            if (!inline && (match || rawContent.includes('\n'))) {
              return (
                <CodeBlock
                  language={match ? match[1] : ''}
                  value={rawContent}
                />
              );
            }

            return (
              <code
                className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#1e1e1e] text-white border border-[#2c2c2c] select-text"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

MarkdownRenderer.propTypes = {
  content: PropTypes.string,
};
