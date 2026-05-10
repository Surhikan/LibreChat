import { memo, useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { MicOff } from 'lucide-react';
import { useToastContext, TooltipAnchor, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import { globalAudioId } from '~/common';
import { cn } from '~/utils';
import store from '~/store';

const isExternalSTT = (speechToTextEndpoint: string) => speechToTextEndpoint === 'external';

const isMicToggleHotkey = (e: KeyboardEvent) => e.shiftKey && e.altKey && e.code === 'KeyL';

const isPushToTalkHotkey = (e: KeyboardEvent) =>
  e.key === 'F21' || e.code === 'F21' || (e.shiftKey && e.code === 'F9');

export default memo(function AudioRecorder({
  index,
  disabled,
  ask,
  methods,
  textAreaRef,
  isSubmitting,
}: {
  index: number;
  disabled: boolean;
  ask: (data: { text: string }) => void;
  methods: ReturnType<typeof useChatFormContext>;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  isSubmitting: boolean;
}) {
  const { setValue, reset, getValues } = methods;
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const conversation = useRecoilValue(store.conversationByKeySelector(index));
  const avatarMode = conversation?.avatarMode === true;
  const [voiceSessionActive, setVoiceSessionActive] = useRecoilState(
    store.voiceSessionActiveByIndex(index),
  );

  const existingTextRef = useRef<string>('');
  const acceptingBrowserTranscriptRef = useRef(false);
  const isSubmittingRef = useRef(isSubmitting);
  const previousSubmittingRef = useRef(isSubmitting);
  const avatarModeRef = useRef(avatarMode);
  const disabledRef = useRef(disabled);
  const isListeningRef = useRef(false);
  const isLoadingRef = useRef(false);
  const pushToTalkActiveRef = useRef(false);
  isSubmittingRef.current = isSubmitting;
  avatarModeRef.current = avatarMode;
  disabledRef.current = disabled;

  const onTranscriptionComplete = useCallback(
    (text: string) => {
      if (isSubmittingRef.current) {
        showToast({
          message: localize('com_ui_speech_while_submitting'),
          status: 'error',
        });
        return;
      }
      if (text) {
        const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | null;
        if (globalAudio) {
          console.log('Unmuting global audio');
          globalAudio.muted = false;
        }
        /** For external STT, append existing text to the transcription */
        const finalText =
          isExternalSTT(speechToTextEndpoint) && existingTextRef.current
            ? `${existingTextRef.current} ${text}`
            : text;
        ask({ text: finalText });
        reset({ text: '' });
        existingTextRef.current = '';
        acceptingBrowserTranscriptRef.current = false;
      }
    },
    [ask, reset, showToast, localize, speechToTextEndpoint],
  );

  const setText = useCallback(
    (text: string) => {
      if (!isExternalSTT(speechToTextEndpoint) && !acceptingBrowserTranscriptRef.current) {
        return;
      }

      let newText = text;
      if (isExternalSTT(speechToTextEndpoint)) {
        /** For external STT, the text comes as a complete transcription, so append to existing */
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      } else {
        /** For browser STT, the transcript is cumulative, so we only need to prepend the existing text once */
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      }
      setValue('text', newText, {
        shouldValidate: true,
      });
    },
    [setValue, speechToTextEndpoint],
  );

  const { isListening, isLoading, startRecording, stopRecording, resetTranscript } =
    useSpeechToText(setText, onTranscriptionComplete);
  const startRecordingRef = useRef(startRecording);
  const stopRecordingRef = useRef(stopRecording);
  const resetTranscriptRef = useRef(resetTranscript);
  startRecordingRef.current = startRecording;
  stopRecordingRef.current = stopRecording;
  resetTranscriptRef.current = resetTranscript;
  isListeningRef.current = isListening === true;
  isLoadingRef.current = isLoading === true;

  const startMic = useCallback(() => {
    if (
      disabledRef.current ||
      isSubmittingRef.current ||
      isLoadingRef.current ||
      isListeningRef.current
    ) {
      return;
    }

    existingTextRef.current = getValues('text') || '';
    acceptingBrowserTranscriptRef.current = !isExternalSTT(speechToTextEndpoint);
    startRecordingRef.current();
  }, [getValues, speechToTextEndpoint]);

  const stopMic = useCallback(() => {
    if (isListeningRef.current) {
      stopRecordingRef.current();
    }

    if (!isExternalSTT(speechToTextEndpoint)) {
      existingTextRef.current = '';
    }
  }, [speechToTextEndpoint]);

  useEffect(() => {
    if (!isSubmitting || isExternalSTT(speechToTextEndpoint)) {
      return;
    }

    existingTextRef.current = '';
    acceptingBrowserTranscriptRef.current = false;
    if (isListening) {
      stopRecordingRef.current();
    }
    resetTranscriptRef.current();
  }, [isSubmitting, isListening, speechToTextEndpoint]);

  useEffect(() => {
    if (!avatarMode && voiceSessionActive) {
      setVoiceSessionActive(false);
    }
  }, [avatarMode, setVoiceSessionActive, voiceSessionActive]);

  useEffect(() => {
    const wasSubmitting = previousSubmittingRef.current;
    previousSubmittingRef.current = isSubmitting;

    if (!wasSubmitting || isSubmitting) {
      return;
    }

    if (
      !avatarMode ||
      !voiceSessionActive ||
      disabled ||
      isLoading ||
      pushToTalkActiveRef.current
    ) {
      return;
    }

    /** Re-arm after the agent turn finishes; TTS is external and cannot signal readiness here. */
    const timeout = window.setTimeout(() => {
      resetTranscriptRef.current();
      startMic();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [avatarMode, disabled, isLoading, isSubmitting, startMic, voiceSessionActive]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!avatarModeRef.current) {
        return;
      }

      if (isMicToggleHotkey(e)) {
        e.preventDefault();
        if (e.repeat) {
          return;
        }

        setVoiceSessionActive((prev) => {
          const next = !prev;
          if (next) {
            startMic();
            return next;
          }

          stopMic();
          return next;
        });
        return;
      }

      if (!isPushToTalkHotkey(e)) {
        return;
      }

      e.preventDefault();
      if (e.repeat || pushToTalkActiveRef.current) {
        return;
      }

      pushToTalkActiveRef.current = true;
      setVoiceSessionActive(false);
      startMic();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isPushToTalkHotkey(e) || !pushToTalkActiveRef.current) {
        return;
      }

      e.preventDefault();
      pushToTalkActiveRef.current = false;
      stopMic();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setVoiceSessionActive, startMic, stopMic]);

  if (!textAreaRef.current) {
    return null;
  }

  const handleStartRecording = async () => {
    if (avatarMode) {
      setVoiceSessionActive(true);
    }
    startMic();
  };

  const handleStopRecording = async () => {
    setVoiceSessionActive(false);
    stopMic();
  };

  const renderIcon = () => {
    if (isListening === true) {
      return <MicOff className="stroke-red-500" />;
    }
    if (isLoading === true) {
      return <Spinner className="stroke-text-secondary" />;
    }
    return <ListeningIcon className="stroke-text-secondary" />;
  };

  return (
    <TooltipAnchor
      description={localize('com_ui_use_micrphone')}
      render={
        <button
          id="audio-recorder"
          type="button"
          aria-label={localize('com_ui_use_micrphone')}
          onClick={isListening === true ? handleStopRecording : handleStartRecording}
          disabled={disabled}
          className={cn(
            'flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover',
          )}
          title={localize('com_ui_use_micrphone')}
          aria-pressed={isListening}
        >
          {renderIcon()}
        </button>
      }
    />
  );
});
