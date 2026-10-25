import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FindInChatBar from '../components/chat/FindInChatBar';

describe('FindInChatBar Component', () => {
  it('renders search query and match counter correctly', () => {
    render(
      <FindInChatBar
        query="contract"
        onQueryChange={vi.fn()}
        activeIndex={2}
        totalMatches={7}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('Find in conversation...')).toBeInTheDocument();
    expect(screen.getByDisplayValue('contract')).toBeInTheDocument();
    expect(screen.getByText('3/7')).toBeInTheDocument();
  });

  it('triggers next, prev, and close actions on click', () => {
    const handleNext = vi.fn();
    const handlePrev = vi.fn();
    const handleClose = vi.fn();

    render(
      <FindInChatBar
        query="revenue"
        onQueryChange={vi.fn()}
        activeIndex={0}
        totalMatches={3}
        onNext={handleNext}
        onPrev={handlePrev}
        onClose={handleClose}
      />
    );

    fireEvent.click(screen.getByTitle('Next match (Enter)'));
    expect(handleNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Previous match (Shift+Enter)'));
    expect(handlePrev).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('Close (Esc)'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard navigation: Enter, Shift+Enter, and Escape', () => {
    const handleNext = vi.fn();
    const handlePrev = vi.fn();
    const handleClose = vi.fn();

    render(
      <FindInChatBar
        query="section"
        onQueryChange={vi.fn()}
        activeIndex={1}
        totalMatches={4}
        onNext={handleNext}
        onPrev={handlePrev}
        onClose={handleClose}
      />
    );

    const input = screen.getByPlaceholderText('Find in conversation...');

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(handleNext).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(handlePrev).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('disables next and prev buttons when zero matches', () => {
    render(
      <FindInChatBar
        query="nonexistent"
        onQueryChange={vi.fn()}
        activeIndex={0}
        totalMatches={0}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.getByTitle('Next match (Enter)')).toBeDisabled();
    expect(screen.getByTitle('Previous match (Shift+Enter)')).toBeDisabled();
  });
});
