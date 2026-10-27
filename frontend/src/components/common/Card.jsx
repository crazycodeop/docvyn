import React from 'react';
import PropTypes from 'prop-types';

export default function Card({ title, subtitle, action, children, className = '', bodyClassName = '' }) {
  return (
    <div className={`bg-[#1a1a1a] rounded-2xl border border-[#282828] transition-all duration-150 hover:border-[#333333] ${className}`}>
      {(title || subtitle || action) && (
        <div className="px-5 sm:px-6 py-4 border-b border-[#242424] flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="font-heading text-sm sm:text-base font-semibold text-white tracking-tight">{title}</h3>}
            {subtitle && <p className="font-sans text-xs text-[#8e8e8e] mt-0.5 leading-normal">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={`p-5 sm:p-6 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

Card.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  action: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  bodyClassName: PropTypes.string,
};
