import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Badge from '../components/common/Badge';

describe('Badge Component', () => {
  it('renders completed status badge with friendly text', () => {
    render(<Badge status="completed" />);
    expect(screen.getByText(/ready to use/i)).toBeInTheDocument();
  });

  it('renders processing status badge with friendly text', () => {
    render(<Badge status="processing" />);
    expect(screen.getByText(/processing document/i)).toBeInTheDocument();
  });

  it('renders failed status badge with friendly text', () => {
    render(<Badge status="failed" />);
    expect(screen.getByText(/couldn't process/i)).toBeInTheDocument();
  });

  it('renders custom label when provided', () => {
    render(<Badge status="completed" label="Custom Status" />);
    expect(screen.getByText('Custom Status')).toBeInTheDocument();
  });
});
