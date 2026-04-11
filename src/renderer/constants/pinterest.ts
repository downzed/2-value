/** Pinterest OAuth 2.0 scopes required by the app */
export const PINTEREST_SCOPES = ['boards:read', 'pins:read', 'pins:write'] as const;

/** Pinterest developer portal URL — for linking in the settings/help UI */
export const PINTEREST_DEVELOPER_URL = 'https://developers.pinterest.com/apps/';

/** Default panel position for the Pinterest floating panel */
export const PINTEREST_PANEL_DEFAULT_POSITION = { x: 20, y: 160 };

/** localStorage key used to persist the Pinterest panel position */
export const PINTEREST_PANEL_STORAGE_KEY = 'image-editor-pinterest-panel-position';
