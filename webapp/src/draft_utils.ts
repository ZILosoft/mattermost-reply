import {getPluginConfig} from 'plugin_config';
import {addPendingQuoteItem} from 'quote_link_state';
import type {Store} from 'redux';
import {buildQuoteBlock, buildReplyTargetFromPost} from 'reply_utils';

import type {GlobalState} from '@mattermost/types/store';

const MM_KV_STORE_DB_NAME = 'localforage';
const MM_KV_STORE_NAME = 'keyvaluepairs';

type DraftValue = {
    message?: string;
    fileInfos?: unknown[];
    uploadsInProgress?: unknown[];
};

type DraftRecord = {
    value?: DraftValue;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

export type ComposerKind = 'channel' | 'thread';

const THREAD_AREA_SELECTORS = [
    '#rhsContainer',
    '.SidebarContainer',
    '.ThreadPane',
    '.sidebar--right',
    '[data-testid="rhsContainer"]',
];

function isVisible(element: HTMLElement) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.offsetParent !== null;
}

function findComposer() {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLTextAreaElement && isVisible(activeElement)) {
        return activeElement;
    }

    const selectors = [
        '#reply_textbox',
        '#post_textbox',
        'textarea[aria-label*="сообщ"]',
        'textarea[aria-label*="message"]',
        'textarea[placeholder*="Ответ"]',
        'textarea[placeholder*="Reply"]',
        'textarea',
    ];

    for (const selector of selectors) {
        const candidates = Array.from(document.querySelectorAll<HTMLTextAreaElement>(selector));
        const visibleCandidate = candidates.find(isVisible);
        if (visibleCandidate) {
            return visibleCandidate;
        }
    }

    return null;
}

function findThreadComposer() {
    const selectors = [
        '#reply_textbox',
        'textarea[placeholder*="Ответить"]',
        'textarea[placeholder*="Reply to thread"]',
        'textarea[aria-label*="reply"]',
    ];

    for (const selector of selectors) {
        const candidates = Array.from(document.querySelectorAll<HTMLTextAreaElement>(selector));
        const visibleCandidate = candidates.find(isVisible);
        if (visibleCandidate) {
            return visibleCandidate;
        }
    }

    return null;
}

function findChannelComposer() {
    const selectors = [
        '#post_textbox',
        'textarea[placeholder*="Напишите"]',
        'textarea[placeholder*="Send a message"]',
    ];

    for (const selector of selectors) {
        const candidates = Array.from(document.querySelectorAll<HTMLTextAreaElement>(selector));
        const visibleCandidate = candidates.find(isVisible);
        if (visibleCandidate) {
            return visibleCandidate;
        }
    }

    return null;
}

function getComposerKindForComposer(composer: HTMLTextAreaElement): ComposerKind {
    return composer.id === 'reply_textbox' ? 'thread' : 'channel';
}

function findComposerByKind(kind: ComposerKind) {
    return kind === 'thread' ? findThreadComposer() : findChannelComposer();
}

function getComposerContext(preferredKind?: ComposerKind) {
    if (preferredKind) {
        const preferredComposer = findComposerByKind(preferredKind);
        if (preferredComposer) {
            return {composer: preferredComposer, kind: preferredKind};
        }
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLTextAreaElement && isVisible(activeElement)) {
        return {composer: activeElement, kind: getComposerKindForComposer(activeElement)};
    }

    const threadComposer = findThreadComposer();
    if (threadComposer) {
        return {composer: threadComposer, kind: 'thread' as ComposerKind};
    }

    const channelComposer = findChannelComposer();
    if (channelComposer) {
        return {composer: channelComposer, kind: 'channel' as ComposerKind};
    }

    const composer = findComposer();
    if (!composer) {
        return null;
    }

    return {composer, kind: getComposerKindForComposer(composer)};
}

export function getComposerKindFromNode(node: Node | EventTarget | null): ComposerKind {
    if (!(node instanceof Node)) {
        return 'channel';
    }

    const element = node instanceof Element ? node : node.parentElement;
    if (!element) {
        return 'channel';
    }

    if (element.closest(THREAD_AREA_SELECTORS.join(','))) {
        return 'thread';
    }

    return 'channel';
}

function getComposerMessage(preferredKind?: ComposerKind) {
    return getComposerContext(preferredKind)?.composer.value || '';
}

function syncComposerValue(nextMessage: string, preferredKind?: ComposerKind) {
    window.setTimeout(() => {
        const composerContext = getComposerContext(preferredKind);
        if (!composerContext) {
            return;
        }

        const {composer} = composerContext;
        const prototype = Object.getPrototypeOf(composer) as HTMLTextAreaElement;
        const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        valueSetter?.call(composer, nextMessage);
        composer.dispatchEvent(new Event('input', {bubbles: true}));
        composer.dispatchEvent(new Event('change', {bubbles: true}));
        composer.focus();
    }, 30);
}

function getDb() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve) => {
        const request = indexedDB.open(MM_KV_STORE_DB_NAME);

        request.onerror = () => resolve(null);
        request.onsuccess = () => resolve(request.result);
    });

    return dbPromise;
}

async function getDraftRecord(rootId: string): Promise<DraftRecord | null> {
    const db = await getDb();
    if (!db) {
        return null;
    }

    return new Promise((resolve) => {
        const request = db.transaction(MM_KV_STORE_NAME).objectStore(MM_KV_STORE_NAME).get(
            `reduxPersist:storage:comment_draft_${rootId}`,
        );

        request.onerror = () => resolve(null);
        request.onsuccess = () => {
            if (!request.result) {
                resolve(null);
                return;
            }

            try {
                resolve(JSON.parse(request.result) as DraftRecord);
            } catch {
                resolve(null);
            }
        };
    });
}

function buildNextMessage(quoteBlock: string, currentMessage?: string) {
    const trimmedCurrentMessage = currentMessage?.trim() || '';
    if (!trimmedCurrentMessage) {
        return `${quoteBlock}\n\n`;
    }

    if (trimmedCurrentMessage.endsWith(quoteBlock)) {
        return currentMessage || trimmedCurrentMessage;
    }

    return `${trimmedCurrentMessage}\n\n${quoteBlock}`;
}

export function getDraftKey(channelId: string, composerKind: ComposerKind, rootId: string) {
    if (composerKind === 'thread') {
        return `${channelId}:${rootId}`;
    }

    return `${channelId}:`;
}

export async function insertQuoteIntoReplyDraft(
    store: Store<GlobalState>,
    postInput: unknown,
    selectedText?: string,
    preferredComposerKind?: ComposerKind,
) {
    const target = buildReplyTargetFromPost(store.getState(), postInput, selectedText);
    if (!target) {
        return;
    }

    const quoteBlock = buildQuoteBlock(target);
    if (!quoteBlock) {
        return;
    }

    const existingDraft = await getDraftRecord(target.rootId);
    const liveComposerMessage = getComposerMessage(preferredComposerKind);
    const baseMessage = liveComposerMessage || existingDraft?.value?.message;
    const nextMessage = buildNextMessage(quoteBlock, baseMessage);
    const composerContext = getComposerContext(preferredComposerKind);
    const composerKind = composerContext?.kind || preferredComposerKind || 'channel';
    const draftKey = getDraftKey(target.channelId, composerKind, target.rootId);

    addPendingQuoteItem(draftKey, {
        quoteBlock,
        permalink: getPluginConfig().linkQuotesToSource ? target.permalink : undefined,
    });

    if (composerKind === 'thread') {
        store.dispatch({
            type: 'SET_GLOBAL_ITEM',
            data: {
                name: `comment_draft_${target.rootId}`,
                value: {
                    message: nextMessage,
                    fileInfos: existingDraft?.value?.fileInfos || [],
                    uploadsInProgress: existingDraft?.value?.uploadsInProgress || [],
                },
                timestamp: new Date(),
            },
        });
    }

    syncComposerValue(nextMessage, composerKind);
}
