import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MarkdownRenderer from '../components/chat/MarkdownRenderer';

describe('MarkdownRenderer Component', () => {
  it('renders bold markdown as strong text without literal asterisks', () => {
    const { container } = render(<MarkdownRenderer content="**It is** a verified fact" />);
    const strongEl = container.querySelector('strong');
    expect(strongEl).toBeInTheDocument();
    expect(strongEl.textContent).toBe('It is');
    expect(container.textContent).not.toContain('**');
  });

  it('renders headings correctly', () => {
    const { container } = render(<MarkdownRenderer content="### Section Overview" />);
    const heading = container.querySelector('h3');
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBe('Section Overview');
  });

  it('renders unordered lists correctly', () => {
    const markdown = `- First item\n- Second item`;
    const { container } = render(<MarkdownRenderer content={markdown} />);
    const listItems = container.querySelectorAll('li');
    expect(listItems.length).toBe(2);
    expect(listItems[0].textContent).toContain('First item');
    expect(listItems[1].textContent).toContain('Second item');
  });

  it('renders code blocks with copy action', () => {
    const markdown = '```javascript\nconst hello = "world";\n```';
    const { container } = render(<MarkdownRenderer content={markdown} />);
    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(container.textContent).toContain('const hello = "world";');
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByTitle('Copy code')).toBeInTheDocument();
  });

  it('renders tables correctly with GFM', () => {
    const markdown = `| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |`;
    const { container } = render(<MarkdownRenderer content={markdown} />);
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(container.querySelectorAll('th').length).toBe(2);
    expect(container.querySelectorAll('td').length).toBe(2);
  });
});
