import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatProvider, useChat } from '../context/ChatContext';

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'usr-1', email: 'demo@cortex.ai' },
  }),
}));

// Mock chatApi
vi.mock('../api/chat', () => ({
  chatApi: {
    getConversations: vi.fn().mockResolvedValue([
      { id: 'conv-1', title: 'First Conversation', message_count: 2 },
      { id: 'conv-2', title: 'Second Conversation', message_count: 5 },
    ]),
    getConversation: vi.fn().mockImplementation((id) =>
      Promise.resolve({
        id,
        title: id === 'conv-1' ? 'First Conversation' : 'Second Conversation',
        messages: [
          { id: 'm1', role: 'user', content: 'Hello' },
          { id: 'm2', role: 'assistant', content: 'Hi there' },
        ],
      })
    ),
    deleteConversation: vi.fn().mockResolvedValue({ message: 'Deleted' }),
    createConversation: vi.fn().mockResolvedValue({ id: 'conv-new', title: 'New Chat' }),
    updateConversation: vi.fn().mockImplementation((id, data) =>
      Promise.resolve({ id, title: data.title || 'Chat', ...data })
    ),
    getArchivedConversations: vi.fn().mockResolvedValue([
      { id: 'conv-arch', title: 'Archived Chat', is_archived: true },
    ]),
  },
}));

function TestConsumer() {
  const {
    conversations,
    activeConvId,
    messages,
    startNewChat,
    selectConversation,
    deleteConversation,
    pinConversation,
    archiveConversation,
  } = useChat();

  return (
    <div>
      <div data-testid="active-id">{activeConvId || 'none'}</div>
      <div data-testid="message-count">{messages.length}</div>
      <div data-testid="conv-count">{conversations.length}</div>
      <button onClick={() => startNewChat()} data-testid="new-chat-btn">
        New Chat
      </button>
      <button onClick={() => selectConversation('conv-1')} data-testid="select-conv-btn">
        Select Conv 1
      </button>
      <button onClick={() => deleteConversation('conv-1')} data-testid="delete-conv-btn">
        Delete Conv 1
      </button>
      <button onClick={() => pinConversation('conv-1', true)} data-testid="pin-conv-btn">
        Pin Conv 1
      </button>
      <button onClick={() => archiveConversation('conv-1')} data-testid="archive-conv-btn">
        Archive Conv 1
      </button>
    </div>
  );
}

describe('ChatContext & New Chat Behavior', () => {
  it('starts with fresh empty conversation state without locking user into previous chats', async () => {
    await act(async () => {
      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );
    });

    expect(screen.getByTestId('active-id').textContent).toBe('none');
    expect(screen.getByTestId('message-count').textContent).toBe('0');
  });

  it('loads conversation messages when selectConversation is called', async () => {
    await act(async () => {
      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );
    });

    await act(async () => {
      screen.getByTestId('select-conv-btn').click();
    });

    expect(screen.getByTestId('active-id').textContent).toBe('conv-1');
    expect(screen.getByTestId('message-count').textContent).toBe('2');
  });

  it('resets to fresh state when startNewChat is called', async () => {
    await act(async () => {
      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );
    });

    // Select conv-1 first
    await act(async () => {
      screen.getByTestId('select-conv-btn').click();
    });
    expect(screen.getByTestId('active-id').textContent).toBe('conv-1');

    // Click New Chat
    await act(async () => {
      screen.getByTestId('new-chat-btn').click();
    });

    // Expect reset to fresh state
    expect(screen.getByTestId('active-id').textContent).toBe('none');
    expect(screen.getByTestId('message-count').textContent).toBe('0');
  });

  it('updates pin status of a conversation', async () => {
    await act(async () => {
      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );
    });

    await act(async () => {
      screen.getByTestId('pin-conv-btn').click();
    });

    expect(screen.getByTestId('conv-count').textContent).toBe('2');
  });

  it('archives conversation and removes it from active list', async () => {
    await act(async () => {
      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );
    });

    // Select conv-1
    await act(async () => {
      screen.getByTestId('select-conv-btn').click();
    });
    expect(screen.getByTestId('active-id').textContent).toBe('conv-1');

    // Archive conv-1
    await act(async () => {
      screen.getByTestId('archive-conv-btn').click();
    });

    // Active conversation count reduced to 1 and activeConv reset
    expect(screen.getByTestId('conv-count').textContent).toBe('1');
    expect(screen.getByTestId('active-id').textContent).toBe('none');
  });
});
