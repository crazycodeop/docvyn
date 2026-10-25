import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';

export default function FindInChatBar({
  isOpen = true,
  query,
  onQueryChange,
  activeIndex,
  totalMatches,
  onNext,
  onPrev,
  onClose,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    }
  };

  return (
    <div className="find-in-chat-dock absolute top-2 right-4 sm:right-6 z-30 flex items-center gap-1.5 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl px-2.5 py-1.5 shadow-2xl animate-slide-up select-none">
      <Search className="w-3.5 h-3.5 text-[#8e8e8e] shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in conversation..."
        className="bg-transparent text-xs text-white placeholder-[#666666] outline-none w-36 sm:w-48 font-sans"
      />

      {query.trim() && (
        <span className="text-[10px] text-[#8e8e8e] font-mono px-1">
          {totalMatches > 0 ? `${activeIndex + 1}/${totalMatches}` : '0/0'}
        </span>
      )}

      <div className="flex items-center gap-0.5 border-l border-[#2e2e2e] pl-1 ml-0.5">
        <button
          onClick={onPrev}
          disabled={totalMatches === 0}
          title="Previous match (Shift+Enter)"
          className="p-1 rounded text-[#8e8e8e] hover:text-white hover:bg-[#282828] disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onNext}
          disabled={totalMatches === 0}
          title="Next match (Enter)"
          className="p-1 rounded text-[#8e8e8e] hover:text-white hover:bg-[#282828] disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="p-1 rounded text-[#8e8e8e] hover:text-white hover:bg-[#282828] transition cursor-pointer ml-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

FindInChatBar.propTypes = {
  isOpen: PropTypes.bool,
  query: PropTypes.string.isRequired,
  onQueryChange: PropTypes.func.isRequired,
  activeIndex: PropTypes.number.isRequired,
  totalMatches: PropTypes.number.isRequired,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
