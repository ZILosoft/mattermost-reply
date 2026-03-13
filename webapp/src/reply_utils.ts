import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';
import type {Team} from '@mattermost/types/teams';

type ReplyTarget = {
    postId: string;
    rootId: string;
    channelId: string;
    sourceMessage: string;
    selectedText?: string;
    permalink?: string;
};

type StateShape = GlobalState & {
    entities?: {
        posts?: {
            posts?: Record<string, Post>;
        };
        teams?: {
            currentTeamId?: string;
            teams?: Record<string, Team>;
        };
    };
};

const MAX_QUOTE_LENGTH = 280;

function matchPostId(value?: string | null) {
    if (!value) {
        return null;
    }

    const patterns = [
        /^post_([a-z0-9]+)$/i,
        /^rhsPost_([a-z0-9]+)$/i,
        /^postView_([a-z0-9]+)$/i,
        /^post-message-([a-z0-9]+)$/i,
        /^([a-z0-9]{26})$/i,
    ];

    for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match?.[1]) {
            return match[1];
        }
        if (match?.[0] && match[0].length === 26) {
            return match[0];
        }
    }

    const embedded = value.match(/([a-z0-9]{26})/i);
    return embedded?.[1] || null;
}

function trimText(value: string) {
    return value.replace(/\u00a0/g, ' ').trim();
}

function truncate(value: string) {
    if (value.length <= MAX_QUOTE_LENGTH) {
        return value;
    }

    return `${value.slice(0, MAX_QUOTE_LENGTH - 1).trimEnd()}…`;
}

function getPostFromState(state: GlobalState, postId: string) {
    const typedState = state as StateShape;
    return typedState.entities?.posts?.posts?.[postId] ?? null;
}

function getCurrentTeam(state: GlobalState) {
    const typedState = state as StateShape;
    const currentTeamId = typedState.entities?.teams?.currentTeamId;
    if (!currentTeamId) {
        return null;
    }

    return typedState.entities?.teams?.teams?.[currentTeamId] ?? null;
}

function normalizeQuoteSource(value: string) {
    return truncate(trimText(value));
}

function buildPermalink(state: GlobalState, postId: string) {
    const team = getCurrentTeam(state);
    if (!team?.name) {
        return undefined;
    }

    const marker = `/${team.name}/`;
    const pathname = window.location.pathname;
    const markerIndex = pathname.indexOf(marker);
    const basePath = markerIndex >= 0 ? pathname.slice(0, markerIndex) : '';

    return `${window.location.origin}${basePath}/${team.name}/pl/${postId}`;
}

export function normalizePostInput(postInput: unknown) {
    if (typeof postInput === 'string' && postInput) {
        return postInput;
    }

    if (postInput && typeof postInput === 'object') {
        const candidate = postInput as {id?: unknown; postId?: unknown; post?: {id?: unknown}};
        if (typeof candidate.id === 'string' && candidate.id) {
            return candidate.id;
        }
        if (typeof candidate.postId === 'string' && candidate.postId) {
            return candidate.postId;
        }
        if (typeof candidate.post?.id === 'string' && candidate.post.id) {
            return candidate.post.id;
        }
    }

    return null;
}

export function extractPostIdFromElement(target: EventTarget | null) {
    if (!(target instanceof Node)) {
        return null;
    }

    let element = target instanceof Element ? target : target.parentElement;
    while (element) {
        const postId = matchPostId(
            element.getAttribute('data-postid') ||
            element.getAttribute('data-post-id') ||
            element.getAttribute('data-testid') ||
            element.id,
        );

        if (postId) {
            return postId;
        }

        element = element.parentElement;
    }

    return null;
}

export function buildReplyTargetFromPost(state: GlobalState, postInput: unknown, selectedText?: string): ReplyTarget | null {
    const postId = normalizePostInput(postInput);
    if (!postId) {
        return null;
    }

    const post = getPostFromState(state, postId);
    if (!post) {
        return null;
    }

    const sourceText = selectedText ? normalizeQuoteSource(selectedText) : normalizeQuoteSource(post.message);
    if (!sourceText) {
        return null;
    }

    return {
        postId: post.id,
        rootId: post.root_id || post.id,
        channelId: post.channel_id,
        sourceMessage: normalizeQuoteSource(post.message),
        selectedText: selectedText ? sourceText : undefined,
        permalink: buildPermalink(state, post.id),
    };
}

export function buildQuoteBlock(target: ReplyTarget) {
    const source = target.selectedText || target.sourceMessage;
    if (!source) {
        return '';
    }

    return source.split('\n').map((line) => `> ${line || ' '}`).join('\n');
}
