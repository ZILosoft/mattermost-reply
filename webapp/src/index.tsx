// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getDraftKey} from 'draft_utils';
import manifest from 'manifest';
import {getPluginConfig, loadPluginConfig} from 'plugin_config';
import {takePendingQuoteItems} from 'quote_link_state';
import React from 'react';
import type {Store} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {PostQuoteAction} from 'components/post_quote_action';
import {SelectionReplyButton} from 'components/selection_reply_button';

import type {PluginRegistry} from 'types/mattermost-webapp';

import './styles.scss';

type PluginQuoteItem = {
    quoteBlock: string;
    permalink?: string;
};

function escapeMarkdownLinkText(value: string) {
    return value.
        replace(/\\/g, '\\\\').
        replace(/\[/g, '\\[').
        replace(/\]/g, '\\]');
}

function linkifyQuoteBlock(quoteBlock: string, permalink: string) {
    return quoteBlock.split('\n').map((line) => {
        if (!line.startsWith('> ')) {
            return line;
        }

        const content = line.slice(2);
        if (!content.trim()) {
            return line;
        }

        return `> [${escapeMarkdownLinkText(content)}](${permalink})`;
    }).join('\n');
}

function applyQuoteLinks(message: string, quoteItems: PluginQuoteItem[]) {
    let nextMessage = message;
    let searchBoundary = nextMessage.length;

    for (let index = quoteItems.length - 1; index >= 0; index--) {
        const item = quoteItems[index];
        if (!item?.quoteBlock || !item.permalink) {
            continue;
        }

        const replaceAt = nextMessage.slice(0, searchBoundary).lastIndexOf(item.quoteBlock);
        if (replaceAt === -1) {
            continue;
        }

        const linkedQuoteBlock = linkifyQuoteBlock(item.quoteBlock, item.permalink);
        nextMessage = `${nextMessage.slice(0, replaceAt)}${linkedQuoteBlock}${nextMessage.slice(replaceAt + item.quoteBlock.length)}`;
        searchBoundary = replaceAt;
    }

    return nextMessage;
}

export default class Plugin {
    public async initialize(registry: PluginRegistry, store: Store<GlobalState>) {
        await loadPluginConfig();

        const PostQuoteActionContainer = (props: Record<string, unknown>) => (
            <PostQuoteAction
                store={store}
                {...props}
            />
        );
        const SelectionReplyButtonContainer = () => <SelectionReplyButton store={store}/>;

        registry.registerPostActionComponent(PostQuoteActionContainer);
        registry.registerGlobalComponent(SelectionReplyButtonContainer);

        registry.registerMessageWillBePostedHook((post: Post) => {
            const draftKey = getDraftKey(post.channel_id, post.root_id ? 'thread' : 'channel', post.root_id || '');
            const pendingQuoteItems = takePendingQuoteItems(draftKey);
            if (!pendingQuoteItems.length) {
                return {post};
            }

            return {
                post: {
                    ...post,
                    props: {
                        ...post.props,
                        [manifest.id]: {
                            quoteItems: pendingQuoteItems,
                        },
                    },
                },
            };
        });

        registry.registerMessageWillFormatHook((post: Post, message: string) => {
            if (!getPluginConfig().linkQuotesToSource) {
                return message;
            }

            const pluginProps = post.props?.[manifest.id] as {quoteItems?: PluginQuoteItem[]} | undefined;
            if (!pluginProps?.quoteItems?.length) {
                return message;
            }

            return applyQuoteLinks(message, pluginProps.quoteItems);
        });
    }
}

declare global {
    interface Window {
        registerPlugin(pluginId: string, plugin: Plugin): void;
    }
}

window.registerPlugin(manifest.id, new Plugin());
