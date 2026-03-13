import {getComposerKindFromNode, insertQuoteIntoReplyDraft} from 'draft_utils';
import {t} from 'i18n';
import React from 'react';
import type {Store} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

type Props = {
    store: Store<GlobalState>;
    post?: {id?: string};
    postId?: string;
};

export function PostQuoteAction({store, post, postId}: Props) {
    const resolvedPostId = post?.id || postId;
    if (!resolvedPostId) {
        return null;
    }

    const label = t('quote');

    return (
        <button
            type='button'
            className='zilosoft-quote-reply-action'
            title={label}
            aria-label={label}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                insertQuoteIntoReplyDraft(
                    store,
                    resolvedPostId,
                    undefined,
                    getComposerKindFromNode(event.currentTarget),
                ).catch(() => undefined);
            }}
        >
            <svg
                viewBox='0 0 16 16'
                aria-hidden='true'
                className='zilosoft-quote-reply-action__icon'
            >
                <path
                    d='M6.2 4.2H3.9L2.2 7v4.8h4.7V7H4.5l1.7-2.8Zm6.9 0h-2.3L9.1 7v4.8h4.7V7h-2.4l1.7-2.8Z'
                    fill='currentColor'
                />
            </svg>
        </button>
    );
}
