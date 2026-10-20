export type ConfigurationSource = { source: string; locked: boolean; database_value_present?: boolean };
export type ConfigurationSources = Record<string, ConfigurationSource>;

const aliases: Record<string, string> = {
    registration: 'registration_open', jit_registration: 'jit_registration_enabled',
    auto_purge_seen_enabled: 'auto_purge_seen',
};
export function configurationSource(sources: ConfigurationSources | undefined, key: string): ConfigurationSource | undefined {
    return sources?.[aliases[key] ?? key];
}
export function protectionMessage(sources: ConfigurationSources | undefined, key: string): string | undefined {
    const entry = configurationSource(sources, key);
    return entry?.locked ? `${key} is controlled by ${entry.source}. Change that source and restart the service.` : undefined;
}
