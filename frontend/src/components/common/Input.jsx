import React from 'react';
import PropTypes from 'prop-types';

export default function Input({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  helperText,
  disabled = false,
  required = false,
  className = '',
  icon: Icon,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-[11px] font-medium text-[#8e8e8e] mb-1.5">
          {label} {required && <span className="text-white/70">*</span>}
        </label>
      )}
      <div className="relative rounded-xl shadow-sm">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#707070]">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`block w-full rounded-xl border text-sm transition-all duration-150 py-2.5 bg-[#181818] ${
            Icon ? 'pl-10 pr-3.5' : 'px-3.5'
          } ${
            error
              ? 'border-rose-500/80 text-rose-200 placeholder-rose-400/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
              : 'border-[#2e2e2e] text-white placeholder-[#666666] hover:border-[#3d3d3d] focus:border-[#666666] focus:ring-1 focus:ring-[#666666]'
          } disabled:bg-[#141414] disabled:text-[#555555] disabled:cursor-not-allowed outline-none`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-400 font-medium">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-[#8e8e8e]">{helperText}</p>}
    </div>
  );
}

Input.propTypes = {
  label: PropTypes.string,
  id: PropTypes.string,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  error: PropTypes.string,
  helperText: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  className: PropTypes.string,
  icon: PropTypes.elementType,
};
