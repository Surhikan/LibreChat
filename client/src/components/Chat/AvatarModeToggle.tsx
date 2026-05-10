import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { Bot } from 'lucide-react';
import { Constants } from 'librechat-data-provider';
import { TooltipAnchor } from '@librechat/client';
import type { TConversation } from 'librechat-data-provider';
import { useUpdateConversationMutation } from '~/data-provider';
import { cn } from '~/utils';
import store from '~/store';

function AvatarModeToggle() {
  const conversation = useRecoilValue(store.conversationByKeySelector(0));
  const conversationId = conversation?.conversationId;
  const avatarMode = conversation?.avatarMode === true;
  const updateConvoMutation = useUpdateConversationMutation(conversationId ?? '');
  const setConversation = useSetRecoilState(store.conversationByKeySelector(0));
  const updateConversation = useSetRecoilState(
    store.updateConversationSelector(conversationId ?? ''),
  );

  const toggleAvatarMode = useCallback(async () => {
    const nextAvatarMode = !avatarMode;
    const newConversationId = String(Constants.NEW_CONVO);

    if (!conversationId || conversationId === newConversationId) {
      /*
      Avatar mode can be enabled before the first message.
      New chats do not exist server-side yet, so persist the flag locally
      and let the first submission carry it in the conversation payload.
      */
      setConversation((prevConversation) =>
        prevConversation
          ? {
              ...prevConversation,
              conversationId: prevConversation.conversationId ?? newConversationId,
              avatarMode: nextAvatarMode,
            }
          : ({
              conversationId: newConversationId,
              endpoint: null,
              title: 'New Chat',
              createdAt: '',
              updatedAt: '',
              avatarMode: nextAvatarMode,
            } satisfies TConversation),
      );
      return;
    }

    await updateConvoMutation.mutateAsync({
      conversationId,
      avatarMode: nextAvatarMode,
    });

    updateConversation({ avatarMode: nextAvatarMode });
  }, [avatarMode, conversationId, setConversation, updateConvoMutation, updateConversation]);

  return (
    <TooltipAnchor
      description={avatarMode ? 'Avatar mode enabled' : 'Avatar mode disabled'}
      role="button"
      tabIndex={0}
      aria-label={avatarMode ? 'Disable avatar mode' : 'Enable avatar mode'}
      onClick={toggleAvatarMode}
      data-testid="avatar-mode-toggle"
      className={cn(
        'inline-flex size-10 flex-shrink-0 items-center justify-center rounded-xl border border-border-light bg-presentation text-text-primary transition-all ease-in-out hover:bg-surface-tertiary disabled:pointer-events-none disabled:opacity-50 radix-state-open:bg-surface-tertiary',
        avatarMode ? 'border-primary bg-surface-tertiary text-primary' : '',
      )}
    >
      <Bot className="icon-lg" aria-hidden="true" />
    </TooltipAnchor>
  );
}

export default AvatarModeToggle;
