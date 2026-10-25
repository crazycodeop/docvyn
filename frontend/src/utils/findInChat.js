/**
 * DOM utility for finding and highlighting text inside the current chat conversation.
 */

export function removeHighlights(container) {
  if (!container) return;
  const marks = container.querySelectorAll('mark.find-match');
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
  });
}

export function highlightMatchesInContainer(container, query) {
  if (!container) return [];
  removeHighlights(container);

  const term = (query || '').trim().toLowerCase();
  if (!term) return [];

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (
          tag === 'button' ||
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'style' ||
          tag === 'script' ||
          parent.closest('.find-in-chat-dock') ||
          parent.closest('.find-ignore')
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  const marks = [];

  for (const node of textNodes) {
    const text = node.nodeValue;
    const lower = text.toLowerCase();
    let pos = lower.indexOf(term);
    if (pos === -1) continue;

    const parent = node.parentNode;
    if (!parent) continue;

    const fragment = document.createDocumentFragment();
    let lastPos = 0;

    while (pos !== -1) {
      if (pos > lastPos) {
        fragment.appendChild(document.createTextNode(text.slice(lastPos, pos)));
      }
      const mark = document.createElement('mark');
      mark.className = 'find-match bg-[#443800] text-amber-200 px-0.5 rounded transition-all duration-150 select-text';
      mark.textContent = text.slice(pos, pos + term.length);
      fragment.appendChild(mark);
      marks.push(mark);

      lastPos = pos + term.length;
      pos = lower.indexOf(term, lastPos);
    }

    if (lastPos < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastPos)));
    }

    parent.replaceChild(fragment, node);
  }

  return marks;
}

export function setActiveMatch(marks, activeIndex) {
  if (!marks || marks.length === 0) return;
  marks.forEach((mark, i) => {
    if (i === activeIndex) {
      mark.className = 'find-match bg-amber-400 text-black font-semibold px-1 rounded shadow-sm scale-105 inline-block select-text';
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      mark.className = 'find-match bg-[#443800] text-amber-200 px-0.5 rounded transition-all duration-150 select-text';
    }
  });
}
