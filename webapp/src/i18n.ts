import {getPluginConfig} from 'plugin_config';

const translations = {
    quote: {
        ru: 'Quote',
        en: 'Quote',
    },
    quoteSelection: {
        ru: 'Quote',
        en: 'Quote',
    },
} as const;

type TranslationKey = keyof typeof translations;

function getLanguage() {
    const language = document.documentElement.lang || navigator.language || 'en';
    return language.toLowerCase().slice(0, 2);
}

export function t(key: TranslationKey) {
    const pluginConfig = getPluginConfig();
    if (key === 'quote' && pluginConfig.quoteButtonLabel) {
        return pluginConfig.quoteButtonLabel;
    }

    if (key === 'quoteSelection' && pluginConfig.selectionButtonLabel) {
        return pluginConfig.selectionButtonLabel;
    }

    const language = getLanguage() as keyof typeof translations[TranslationKey];
    return translations[key][language] || translations[key].en;
}
