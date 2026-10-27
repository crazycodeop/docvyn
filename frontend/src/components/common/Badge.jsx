import React from 'react';
import PropTypes from 'prop-types';

export default function Badge({ status, label, size = 'sm', className = '' }) {
  const normStatus = (status || '').toLowerCase();

  const statusConfig = {
    completed: {
      bg: 'bg-[#16211a] text-emerald-400 border-[#223929]',
      dot: 'bg-emerald-400',
      text: 'Ready to use',
    },
    processing: {
      bg: 'bg-[#202020] text-[#ededed] border-[#383838]',
      dot: 'bg-white animate-pulse',
      text: 'Processing document',
    },
    queued: {
      bg: 'bg-[#1a1a1a] text-[#a0a0a0] border-[#2e2e2e]',
      dot: 'bg-[#808080]',
      text: 'Waiting to process',
    },
    uploaded: {
      bg: 'bg-[#1a1a1a] text-[#a0a0a0] border-[#2e2e2e]',
      dot: 'bg-[#808080]',
      text: 'Waiting to process',
    },
    failed: {
      bg: 'bg-[#251717] text-rose-300 border-[#3d2222]',
      dot: 'bg-rose-400',
      text: "Couldn't process this document",
    },
    default: {
      bg: 'bg-[#1a1a1a] text-[#a0a0a0] border-[#2e2e2e]',
      dot: 'bg-[#808080]',
      text: label || status,
    },
  };

  const config = statusConfig[normStatus] || statusConfig.default;
  const displayText = label || config.text;

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border transition-all duration-150 ${config.bg} ${
        sizeStyles[size] || sizeStyles.sm
      } ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span>{displayText}</span>
    </span>
  );
}

Badge.propTypes = {
  status: PropTypes.string,
  label: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md']),
  className: PropTypes.string,
};
