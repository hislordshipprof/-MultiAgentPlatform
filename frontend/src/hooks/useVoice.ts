import { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceOptions {
  onTranscript: (text: string) => void;
  onError?: (error: Error) => void;
}

export function useVoice({ onTranscript, onError }: VoiceOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const interimTranscriptRef = useRef<string>('');

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      if (onError) {
        onError(new Error('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.'));
      }
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      interimTranscriptRef.current = '';
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      interimTranscriptRef.current = interimTranscript;

      if (finalTranscript.trim()) {
        onTranscript(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      // Handle different error types
      // Common recoverable errors that shouldn't be shown to user:
      // - 'no-speech': No speech detected (user stopped talking)
      // - 'aborted': Recognition was stopped (normal operation)
      // - 'audio-capture': Microphone issues (may be temporary)
      const silentErrors = ['no-speech', 'aborted', 'audio-capture'];
      
      // Only show critical errors to user
      if (!silentErrors.includes(event.error) && onError) {
        // Only show error for critical issues
        if (event.error === 'network' || event.error === 'not-allowed') {
          onError(new Error(`Speech recognition error: ${event.error}. Please check your microphone permissions and internet connection.`));
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          // Log other errors but don't interrupt user flow
          console.warn('Speech recognition error (non-critical):', event.error);
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
    };
  }, [onTranscript, onError]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) {
      if (onError) {
        onError(new Error('Speech recognition is not available'));
      }
      return;
    }

    try {
      // With continuous=true, recognition auto-restarts, so we can just start
      recognitionRef.current.start();
    } catch (error: any) {
      // InvalidStateError means it's already running - that's okay, ignore
      if (error.name !== 'InvalidStateError') {
        console.error('Error starting recognition:', error);
        if (onError && error.name !== 'InvalidStateError') {
          onError(error);
        }
      }
    }
  }, [isSupported, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
    setIsListening(false);
  }, []);

  const getInterimTranscript = useCallback(() => {
    return interimTranscriptRef.current;
  }, []);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    getInterimTranscript,
  };
}

// Speech synthesis for TTS
export function speakText(text: string, onStart?: () => void, onEnd?: () => void) {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    if (onStart) {
      utterance.onstart = onStart;
    }

    if (onEnd) {
      utterance.onend = onEnd;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  }
  return false;
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
