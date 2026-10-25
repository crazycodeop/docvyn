import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook providing browser-native speech-to-text using Web Speech API.
 * Free, client-side, zero external API keys needed.
 */
export function useSpeechToText({ onTranscript, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);

  // Keep latest callbacks in refs to avoid re-initializing recognition on re-renders
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const errorTimerRef = useRef(null);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  });

  const clearErrorTimer = () => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  };

  const setTimedError = (msg) => {
    clearErrorTimer();
    setSpeechError(msg);
    // Auto-dismiss transient speech error after 6 seconds
    errorTimerRef.current = setTimeout(() => {
      setSpeechError(null);
    }, 6000);
  };

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    setIsSupported(Boolean(SpeechRecognition));

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        clearErrorTimer();
        setSpeechError(null);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        setIsListening(false);

        // 'aborted' is triggered when stopping or switching; not an actual user-facing error
        if (event.error === 'aborted') {
          return;
        }

        console.warn('SpeechRecognition error event:', event.error);

        let errorMsg = 'Could not recognize speech.';
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          errorMsg = 'Microphone access denied. Please allow microphone permissions in your browser address bar.';
        } else if (event.error === 'no-speech') {
          errorMsg = 'No speech was detected. Please check your microphone and try again.';
        } else if (event.error === 'network' || event.error === 'service-not-allowed') {
          errorMsg = 'Speech service blocked. Privacy browsers like Brave block Google speech servers by default; please allow Google speech services in Brave settings or use Chrome/Edge.';
        } else if (event.error === 'audio-capture') {
          errorMsg = 'No microphone device found. Please verify your microphone is connected in system settings.';
        }

        setTimedError(errorMsg);
        if (onErrorRef.current) {
          onErrorRef.current(errorMsg, event.error);
        }
      };

      recognition.onresult = (event) => {
        if (event.results && event.results.length > 0) {
          const transcript = event.results[0][0]?.transcript || '';
          if (transcript.trim() && onTranscriptRef.current) {
            onTranscriptRef.current(transcript.trim());
          }
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      clearErrorTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore cleanup abort
        }
      }
    };
  }, []); // Run once on mount

  const startListening = useCallback(() => {
    clearErrorTimer();
    setSpeechError(null);
    if (!isSupported) {
      const msg = 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.';
      setTimedError(msg);
      if (onErrorRef.current) onErrorRef.current(msg, 'unsupported');
      return;
    }
    try {
      recognitionRef.current?.start();
    } catch (err) {
      console.warn('SpeechRecognition start warning:', err);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch (err) {
      // ignore
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    speechError,
    setSpeechError,
    startListening,
    stopListening,
    toggleListening,
  };
}
