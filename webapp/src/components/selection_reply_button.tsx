import {getComposerKindFromNode, insertQuoteIntoReplyDraft} from 'draft_utils';
import {t} from 'i18n';
import {getPluginConfig} from 'plugin_config';
import React, {useEffect, useState} from 'react';
import type {Store} from 'redux';
import {extractPostIdFromElement} from 'reply_utils';

import type {GlobalState} from '@mattermost/types/store';

type Props = {
    store: Store<GlobalState>;
};

type OverlayState = {
    top: number;
    left: number;
    postId: string;
    selectedText: string;
    composerKind: 'channel' | 'thread';
};

const MESSAGE_BODY_SELECTORS = [
    '[data-testid^="postMessageText"]',
    '.post-message__text',
    '.post-message__content',
    '.post__content',
    '.markdown',
];

function getElement(node: Node | null) {
    if (!node) {
        return null;
    }

    return node instanceof Element ? node : node.parentElement;
}

function findClosestBySelectors(node: Node | null, selectors: string[]) {
    const element = getElement(node);
    if (!element) {
        return null;
    }

    return element.closest(selectors.join(','));
}

function getSelectionContext(range: Range) {
    const startPostId = extractPostIdFromElement(range.startContainer);
    const endPostId = extractPostIdFromElement(range.endContainer);
    if (!startPostId || startPostId !== endPostId) {
        return null;
    }

    const startMessageBody = findClosestBySelectors(range.startContainer, MESSAGE_BODY_SELECTORS);
    const endMessageBody = findClosestBySelectors(range.endContainer, MESSAGE_BODY_SELECTORS);
    if (!startMessageBody || startMessageBody !== endMessageBody) {
        return null;
    }

    return {
        postId: startPostId,
        messageBody: startMessageBody,
        composerKind: getComposerKindFromNode(startMessageBody),
    };
}

function readSelectionOverlay(): OverlayState | null {
    if (!getPluginConfig().enableSelectionPopup) {
        return null;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return null;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
        return null;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
        return null;
    }

    const selectionContext = getSelectionContext(range);
    if (!selectionContext) {
        return null;
    }

    return {
        top: Math.min(rect.bottom + 8, window.innerHeight - 52),
        left: Math.min(rect.left + (rect.width / 2), window.innerWidth - 96),
        postId: selectionContext.postId,
        selectedText,
        composerKind: selectionContext.composerKind,
    };
}

export function SelectionReplyButton({store}: Props) {
    const [overlay, setOverlay] = useState<OverlayState | null>(null);

    useEffect(() => {
        const updateOverlay = () => {
            setOverlay(readSelectionOverlay());
        };

        const clearOverlay = () => {
            setOverlay(null);
        };

        document.addEventListener('selectionchange', updateOverlay);
        window.addEventListener('scroll', clearOverlay, true);
        window.addEventListener('resize', updateOverlay);

        return () => {
            document.removeEventListener('selectionchange', updateOverlay);
            window.removeEventListener('scroll', clearOverlay, true);
            window.removeEventListener('resize', updateOverlay);
        };
    }, []);

    if (!getPluginConfig().enableSelectionPopup || !overlay) {
        return null;
    }

    return (
        <button
            type='button'
            className='zilosoft-quote-reply-selection'
            style={{
                top: `${overlay.top}px`,
                left: `${overlay.left}px`,
            }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
                insertQuoteIntoReplyDraft(
                    store,
                    overlay.postId,
                    overlay.selectedText,
                    overlay.composerKind,
                ).catch(() => undefined);
                window.getSelection()?.removeAllRanges();
                setOverlay(null);
            }}
        >
            {t('quoteSelection')}
        </button>
    );
}
