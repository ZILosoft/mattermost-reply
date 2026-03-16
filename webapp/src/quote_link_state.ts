export type PendingQuoteItem = {
    quoteBlock: string;
    permalink?: string;
};

type QuoteLinkState = Record<string, PendingQuoteItem[]>;

const pendingQuoteItems: QuoteLinkState = {};

export function addPendingQuoteItem(draftKey: string, item: PendingQuoteItem) {
    if (!item.quoteBlock) {
        return;
    }

    pendingQuoteItems[draftKey] = [...(pendingQuoteItems[draftKey] || []), item];
}

export function takePendingQuoteItems(draftKey: string) {
    const items = pendingQuoteItems[draftKey] || [];
    delete pendingQuoteItems[draftKey];
    return items;
}
