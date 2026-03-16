import manifest from 'manifest';

export type PluginConfig = {
    quoteButtonLabel: string;
    selectionButtonLabel: string;
    enableSelectionPopup: boolean;
    linkQuotesToSource: boolean;
};

const defaultConfig: PluginConfig = {
    quoteButtonLabel: 'Quote',
    selectionButtonLabel: 'Quote',
    enableSelectionPopup: true,
    linkQuotesToSource: true,
};

let pluginConfig: PluginConfig = defaultConfig;

function sanitizeLabel(value: unknown, fallback: string) {
    if (typeof value !== 'string') {
        return fallback;
    }

    const trimmed = value.trim();
    return trimmed || fallback;
}

export async function loadPluginConfig() {
    try {
        const response = await fetch(`/plugins/${manifest.id}/api/v1/config`);
        if (!response.ok) {
            return pluginConfig;
        }

        const data = await response.json() as Partial<PluginConfig>;
        pluginConfig = {
            quoteButtonLabel: sanitizeLabel(data.quoteButtonLabel, defaultConfig.quoteButtonLabel),
            selectionButtonLabel: sanitizeLabel(data.selectionButtonLabel, defaultConfig.selectionButtonLabel),
            enableSelectionPopup: typeof data.enableSelectionPopup === 'boolean' ? data.enableSelectionPopup : defaultConfig.enableSelectionPopup,
            linkQuotesToSource: typeof data.linkQuotesToSource === 'boolean' ? data.linkQuotesToSource : defaultConfig.linkQuotesToSource,
        };
    } catch {
        pluginConfig = defaultConfig;
    }

    return pluginConfig;
}

export function getPluginConfig() {
    return pluginConfig;
}
