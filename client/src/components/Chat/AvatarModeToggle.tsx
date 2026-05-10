import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { Bot } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { useUpdateConversationMutation } from '~/data-provider';
import { cn } from '~/utils';
import store from '~/store';

function AvatarModeToggle() {
  const conversation = useRecoilValue(store.conversationByKeySelector(0));
  const conversationId = conversation?.conversationId;
  const avatarMode = conversation?.avatarMode === true;
  const updateConvoMutation = useUpdateConversationMutation(conversationId ?? '');
  const updateConversation = useSetRecoilState(
   store.updateConversationSelector(conversationId ?? ''),
  );

  const toggleAvatarMode = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    const nextAvatarMode = !avatarMode;

    await updateConvoMutation.mutateAsync({
      conversationId,
      avatarMode: nextAvatarMode,
    });

    updateConversation({ avatarMode: nextAvatarMode });
  }, [avatarMode, conversationId, updateConvoMutation, updateConversation]);

  if (!conversationId) {
    return null;
  }

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
