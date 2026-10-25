import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarProvider, useSidebar } from '../context/SidebarContext';

function TestSidebarComponent() {
  const { isSidebarCollapsed, toggleSidebarCollapse, setSidebarCollapsed } = useSidebar();
  return (
    <div>
      <span data-testid="status">{isSidebarCollapsed ? 'collapsed' : 'expanded'}</span>
      <button onClick={toggleSidebarCollapse} data-testid="toggle-btn">
        Toggle
      </button>
      <button onClick={() => setSidebarCollapsed(true)} data-testid="collapse-btn">
        Collapse
      </button>
    </div>
  );
}

describe('SidebarContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with expanded state by default', () => {
    render(
      <SidebarProvider>
        <TestSidebarComponent />
      </SidebarProvider>
    );

    expect(screen.getByTestId('status').textContent).toBe('expanded');
  });

  it('toggles collapse state and persists to localStorage', () => {
    render(
      <SidebarProvider>
        <TestSidebarComponent />
      </SidebarProvider>
    );

    const toggleBtn = screen.getByTestId('toggle-btn');
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId('status').textContent).toBe('collapsed');
    expect(localStorage.getItem('docvyn_sidebar_collapsed')).toBe('true');

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('status').textContent).toBe('expanded');
    expect(localStorage.getItem('docvyn_sidebar_collapsed')).toBe('false');
  });

  it('explicitly sets collapse state', () => {
    render(
      <SidebarProvider>
        <TestSidebarComponent />
      </SidebarProvider>
    );

    const collapseBtn = screen.getByTestId('collapse-btn');
    fireEvent.click(collapseBtn);

    expect(screen.getByTestId('status').textContent).toBe('collapsed');
  });
});
