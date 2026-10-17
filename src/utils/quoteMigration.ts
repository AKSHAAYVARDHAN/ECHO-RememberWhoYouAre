/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { INITIAL_QUOTES, QuoteItem, DEFAULT_QUOTES_VERSION, getDefaultsSignature } from '../types/quote';

export { DEFAULT_QUOTES_VERSION, getDefaultsSignature } from '../types/quote';
export const QUOTES_STORAGE_KEY = 'insideout_quotes_v1';
export const PROFILE_STORAGE_KEY = 'insideout_profile_v1';
export const QUOTES_VERSION_KEY = 'insideout_quotes_version_v2';
export const DELETED_DEFAULTS_STORAGE_KEY = 'insideout_deleted_defaults_v1';

/**
 * Creates fresh default QuoteItem objects from INITIAL_QUOTES.
 */
export function createDefaultQuotes(defaults: readonly string[] = INITIAL_QUOTES): QuoteItem[] {
  return defaults.map((text, idx) => ({
    id: `quote-init-${idx + 1}`,
    defaultId: `quote-init-${idx + 1}`,
    defaultIndex: idx,
    text,
    origin: 'default',
    isEdited: false,
    originalText: text,
    createdAt: 1700000000000 + idx * 1000,
  }));
}

/**
 * Loads the set of intentionally deleted default quote IDs from localStorage.
 */
export function loadDeletedDefaultIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_DEFAULTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map(String));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

/**
 * Persists the set of intentionally deleted default quote IDs to localStorage.
 */
export function saveDeletedDefaultIds(deletedIds: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      DELETED_DEFAULTS_STORAGE_KEY,
      JSON.stringify(Array.from(deletedIds))
    );
  } catch {
    // ignore
  }
}

/**
 * Migrates a quote collection:
 * - Detects default quotes vs user-created quotes
 * - Updates default quotes whose source definition changed in INITIAL_QUOTES
 * - Preserves user-created quotes
 * - Preserves user-edited default quotes
 * - Preserves intentionally deleted default quotes (never resurrects them)
 * - Avoids duplicates
 */
export function migrateQuoteCollection(
  rawQuotes: unknown[],
  deletedDefaultIds: Set<string>,
  defaults: readonly string[] = INITIAL_QUOTES
): QuoteItem[] {
  if (!Array.isArray(rawQuotes) || rawQuotes.length === 0) {
    return createDefaultQuotes(defaults);
  }

  // Detect whether previous data was already initialized with default quotes.
  // In previous versions, default quotes were named "quote-init-X".
  const hasLegacyDefaults = rawQuotes.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const q = item as Partial<QuoteItem>;
    return (
      q.origin === 'default' ||
      (typeof q.id === 'string' && /^quote-init-\d+$/.test(q.id)) ||
      (typeof q.defaultId === 'string' && /^quote-init-\d+$/.test(q.defaultId))
    );
  });

  // If previous defaults existed, infer any default quotes that were deleted in the past
  if (hasLegacyDefaults) {
    const presentDefaultIds = new Set<string>();
    for (const item of rawQuotes) {
      if (!item || typeof item !== 'object') continue;
      const q = item as Partial<QuoteItem>;
      const match = (q.defaultId || q.id || '').match(/^quote-init-(\d+)$/);
      if (match) {
        presentDefaultIds.add(match[0]);
      }
    }

    // Default IDs that were originally generated (1 to defaults.length or 11)
    // Any default quote absent from presentDefaultIds was deleted by the user!
    const maxIndex = Math.max(defaults.length, 11);
    for (let i = 1; i <= maxIndex; i++) {
      const defaultId = `quote-init-${i}`;
      if (!presentDefaultIds.has(defaultId)) {
        deletedDefaultIds.add(defaultId);
      }
    }
  }

  const result: QuoteItem[] = [];
  const seenIds = new Set<string>();
  const processedDefaultIndices = new Set<number>();

  for (let i = 0; i < rawQuotes.length; i++) {
    const raw = rawQuotes[i];
    if (!raw) continue;

    // Normalize string items (very old legacy format)
    let item: Partial<QuoteItem>;
    if (typeof raw === 'string') {
      item = {
        id: `quote-legacy-${i}`,
        text: raw,
        createdAt: Date.now() - (rawQuotes.length - i) * 1000,
      };
    } else if (typeof raw === 'object') {
      item = raw as Partial<QuoteItem>;
    } else {
      continue;
    }

    const trimmedText = typeof item.text === 'string' ? item.text.trim() : '';
    if (!trimmedText) continue;

    const idStr = String(item.id || `quote-${Date.now()}-${i}`);

    // Check if this item is a default quote
    const match = (item.defaultId || idStr).match(/^quote-init-(\d+)$/);
    const isDefault = item.origin === 'default' || Boolean(match) || typeof item.defaultIndex === 'number';

    if (isDefault) {
      const defaultIndex =
        typeof item.defaultIndex === 'number'
          ? item.defaultIndex
          : match
          ? parseInt(match[1], 10) - 1
          : -1;

      const defaultId = defaultIndex >= 0 ? `quote-init-${defaultIndex + 1}` : idStr;

      // Check if user previously deleted this default quote
      if (deletedDefaultIds.has(defaultId)) {
        continue;
      }

      // Avoid duplicates
      if (defaultIndex >= 0 && processedDefaultIndices.has(defaultIndex)) {
        continue;
      }
      if (seenIds.has(defaultId)) {
        continue;
      }

      if (defaultIndex >= 0) {
        processedDefaultIndices.add(defaultIndex);
      }
      seenIds.add(defaultId);

      // Check if the user edited this default quote
      const isUserEdited = Boolean(
        item.isEdited === true ||
        (item as Record<string, unknown>).userEdited === true ||
        (item as Record<string, unknown>).edited === true ||
        (item.originalText && item.text !== item.originalText)
      );

      let textToUse: string;
      let isEditedFlag: boolean;
      let originalTextToUse: string;

      if (defaultIndex >= 0 && defaultIndex < defaults.length) {
        const sourceText = defaults[defaultIndex];
        if (isUserEdited) {
          // Preserve user-edited text
          textToUse = trimmedText;
          isEditedFlag = true;
          originalTextToUse = item.originalText || sourceText;
        } else {
          // Unedited default: update to match latest source definition!
          textToUse = sourceText;
          isEditedFlag = false;
          originalTextToUse = sourceText;
        }
      } else {
        textToUse = trimmedText;
        isEditedFlag = isUserEdited;
        originalTextToUse = item.originalText || trimmedText;
      }

      result.push({
        id: defaultId,
        defaultId,
        defaultIndex: defaultIndex >= 0 ? defaultIndex : undefined,
        text: textToUse,
        origin: 'default',
        isEdited: isEditedFlag,
        originalText: originalTextToUse,
        createdAt: item.createdAt || 1700000000000 + (defaultIndex >= 0 ? defaultIndex * 1000 : 0),
      });
    } else {
      // User-created quote
      if (seenIds.has(idStr)) {
        continue;
      }
      seenIds.add(idStr);

      result.push({
        id: idStr,
        text: trimmedText,
        origin: 'user',
        isEdited: Boolean(item.isEdited),
        createdAt: item.createdAt || Date.now(),
      });
    }
  }

  // Now, if any new defaults from `INITIAL_QUOTES` were NOT present and were NOT deleted:
  // (e.g. if the application shipped with new additional default quotes)
  for (let idx = 0; idx < defaults.length; idx++) {
    const defaultId = `quote-init-${idx + 1}`;
    if (!processedDefaultIndices.has(idx) && !deletedDefaultIds.has(defaultId) && !seenIds.has(defaultId)) {
      result.push({
        id: defaultId,
        defaultId,
        defaultIndex: idx,
        text: defaults[idx],
        origin: 'default',
        isEdited: false,
        originalText: defaults[idx],
        createdAt: 1700000000000 + idx * 1000,
      });
      seenIds.add(defaultId);
      processedDefaultIndices.add(idx);
    }
  }

  return result;
}

/**
 * Loads stored quotes and performs migration if needed.
 */
export function loadAndMigrateStoredQuotes(): QuoteItem[] {
  if (typeof window === 'undefined') {
    return createDefaultQuotes(INITIAL_QUOTES);
  }

  const deletedDefaultIds = loadDeletedDefaultIds();
  const currentSig = getDefaultsSignature(INITIAL_QUOTES);

  try {
    const raw = localStorage.getItem(QUOTES_STORAGE_KEY);
    const storedSig = localStorage.getItem(QUOTES_VERSION_KEY);

    if (!raw) {
      // First run: save defaults and signature
      const defaults = createDefaultQuotes(INITIAL_QUOTES);
      localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(defaults));
      localStorage.setItem(QUOTES_VERSION_KEY, currentSig);
      return defaults;
    }

    const parsed = JSON.parse(raw);

    // If signature matches and parsed is already well-formed with origin tags
    if (
      storedSig === currentSig &&
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((p) => p && typeof p === 'object' && p.origin)
    ) {
      return parsed as QuoteItem[];
    }

    // Otherwise, perform safe migration
    const migrated = migrateQuoteCollection(parsed, deletedDefaultIds, INITIAL_QUOTES);
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(migrated));
    localStorage.setItem(QUOTES_VERSION_KEY, currentSig);
    saveDeletedDefaultIds(deletedDefaultIds);

    return migrated;
  } catch (err) {
    console.error('Error during quote migration:', err);
    const defaults = createDefaultQuotes(INITIAL_QUOTES);
    try {
      localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(defaults));
      localStorage.setItem(QUOTES_VERSION_KEY, currentSig);
    } catch {
      // ignore
    }
    return defaults;
  }
}
