import React from 'react';
import PropTypes from 'prop-types';

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  onClick,
  icon: Icon,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 ease-out rounded-xl focus:outline-none focus:ring-1 focus:ring-white/40 focus:ring-offset-1 focus:ring-offset-[#141414] disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer active:scale-[0.98]';

  const variants = {
    primary: 'bg-white text-[#141414] hover:bg-[#e5e5e5] font-semibold shadow-sm border border-transparent',
    secondary: 'bg-[#1e1e1e] text-slate-200 border border-[#2e2e2e] hover:bg-[#282828] hover:border-[#383838] hover:text-white',
    danger: 'bg-[#251717] text-rose-300 border border-[#3e2222] hover:bg-[#301c1c] hover:text-rose-200',
    ghost: 'text-[#8e8e8e] hover:text-white hover:bg-[#222222]',
    outline: 'border border-[#333333] text-white hover:bg-[#222222]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      onClick={onClick}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-0.5 h-4 w-4 text-current shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost', 'outline']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  isLoading: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func,
  icon: PropTypes.elementType,
};
