import { useEffect, useRef, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { useToastContext } from '@librechat/client';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import useGetAudioSettings from './useGetAudioSettings';
import { useLocalize } from '~/hooks';
import store from '~/store';

const useSpeechToTextBrowser = (
  setText: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const isBrowserSTTEnabled = speechToTextEndpoint === 'browser';
  const { data: speechConfig } = useGetCustomConfigSpeechQuery({ enabled: true });
  const sttExternal = Boolean(speechConfig?.sttExternal);

  const lastTranscript = useRef<string | null>(null);
  const lastInterim = useRef<string | null>(null);
  const ignoredFinalTranscript = useRef<string | null>(null);
  const ignoredInterimTranscript = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>();
  const clearIgnoredRef = useRef<NodeJS.Timeout | null>();
  const isBrowserSTTEnabledRef = useRef(isBrowserSTTEnabled);
  const toggleListeningRef = useRef<() => void>(() => {});
  const [autoSendText] = useRecoilState(store.autoSendText);
  const [languageSTT] = useRecoilState<string>(store.languageSTT);
  const [autoTranscribeAudio] = useRecoilState<boolean>(store.autoTranscribeAudio);

  const {
    listening,
    finalTranscript,
    resetTranscript,
    interimTranscript,
    isMicrophoneAvailable,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();
  const isListening = useMemo(() => listening, [listening]);
  isBrowserSTTEnabledRef.current = isBrowserSTTEnabled;

  useEffect(() => {
    if (interimTranscript == null || interimTranscript === '') {
      return;
    }

    if (ignoredInterimTranscript.current === interimTranscript) {
      return;
    }

    if (lastInterim.current === interimTranscript) {
      return;
    }

    setText(interimTranscript);
    lastInterim.current = interimTranscript;
  }, [setText, interimTranscript]);

  useEffect(() => {
    if (finalTranscript == null || finalTranscript === '') {
      return;
    }

    if (ignoredFinalTranscript.current === finalTranscript) {
      return;
    }

    if (lastTranscript.current === finalTranscript) {
      return;
    }

    setText(finalTranscript);
    lastTranscript.current = finalTranscript;
    if (autoSendText > -1 && finalTranscript.length > 0) {
      timeoutRef.current = setTimeout(() => {
        onTranscriptionComplete(finalTranscript);
        resetTranscript();
      }, autoSendText * 1000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [setText, onTranscriptionComplete, resetTranscript, finalTranscript, autoSendText]);

  const clearTranscriptState = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (clearIgnoredRef.current) {
      clearTimeout(clearIgnoredRef.current);
      clearIgnoredRef.current = null;
    }
    lastTranscript.current = null;
    lastInterim.current = null;
    ignoredFinalTranscript.current = finalTranscript || null;
    ignoredInterimTranscript.current = interimTranscript || null;
    resetTranscript();
  };

  const startListening = () => {
    if (!browserSupportsSpeechRecognition) {
      showToast({
        message: sttExternal
          ? localize('com_ui_speech_not_supported_use_external')
          : localize('com_ui_speech_not_supported'),
        status: 'error',
      });
      return;
    }

    if (!isMicrophoneAvailable) {
      showToast({
        message: localize('com_ui_microphone_unavailable'),
        status: 'error',
      });
      return;
    }

    clearTranscriptState();
    clearIgnoredRef.current = setTimeout(() => {
      ignoredFinalTranscript.current = null;
      ignoredInterimTranscript.current = null;
      clearIgnoredRef.current = null;
    }, 500);
    SpeechRecognition.startListening({
      language: languageSTT,
      continuous: autoTranscribeAudio,
    });
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  const toggleListening = () => {
    if (isListening === true) {
      stopListening();
      return;
    }

    startListening();
  };
  toggleListeningRef.current = toggleListening;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.code === 'KeyL' && isBrowserSTTEnabledRef.current) {
        toggleListeningRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isListening,
    isLoading: false,
    startRecording: startListening,
    stopRecording: stopListening,
    resetTranscript: clearTranscriptState,
  };
};

export default useSpeechToTextBrowser;
