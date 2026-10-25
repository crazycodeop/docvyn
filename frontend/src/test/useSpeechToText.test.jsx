import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSpeechToText } from '../hooks/useSpeechToText';

function SpeechTestComponent({ onError }) {
  const { isListening, isSupported, speechError, toggleListening } = useSpeechToText({ onError });

  return (
    <div>
      <span data-testid="supported">{isSupported ? 'yes' : 'no'}</span>
      <span data-testid="listening">{isListening ? 'yes' : 'no'}</span>
      <span data-testid="error">{speechError || 'none'}</span>
      <button onClick={toggleListening} data-testid="mic-btn">
        Toggle Mic
      </button>
    </div>
  );
}

describe('useSpeechToText Hook', () => {
  beforeEach(() => {
    // Ensure window.SpeechRecognition and webkitSpeechRecognition are absent to simulate unsupported browser
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  it('detects unsupported browser and sets appropriate error when clicked', () => {
    const handleError = vi.fn();
    render(<SpeechTestComponent onError={handleError} />);

    expect(screen.getByTestId('supported').textContent).toBe('no');
    expect(screen.getByTestId('listening').textContent).toBe('no');

    // Click microphone button
    fireEvent.click(screen.getByTestId('mic-btn'));

    // Verify error state is populated
    expect(screen.getByTestId('error').textContent).toContain('Speech recognition is not supported');
    expect(handleError).toHaveBeenCalled();
  });
});
