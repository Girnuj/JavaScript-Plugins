/**
 * @fileoverview Plugin nativo para sincronizar estado de controles UI con query params en la URL.
 * @version 1.0
 * @since 2026
 * @author Samuel Montenegro
 * @module QuerySyncState
 */
(function () {
    'use strict';

    const SELECTOR_SUBJECT = '[data-role="query-sync-state"]'
        , INSTANCES = new WeakMap()
        , PENDING_REMOVALS = new Set()
        , NO_UPDATE = Symbol('QSS_NO_UPDATE');

    const QUERY_SYNC_STATE_DEFAULTS = Object.freeze({
        key: '',
        type: 'string',
        history: 'replace',
        debounceMs: 0,
        defaultRaw: undefined,
        defaultValue: undefined,
        omitDefault: false,
        resetPageKey: '',
        syncOnInit: true,
        trim: true,
        onBeforeSync: function () { },
        onSync: function () { },
        onError: function () { },
        onComplete: function () { },
    });

    const parseBoolean = (value) => {
        if (value === undefined) return undefined;
        if (typeof value === 'boolean') return value;

        const normalized = String(value).trim().toLowerCase();
        if (['', 'true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
        return undefined;
    };

    const parseNumber = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const parseJsonSafe = (value) => {
        if (typeof value !== 'string' || !value.trim()) return undefined;
        try {
            return JSON.parse(value);
        } catch (_error) {
            return undefined;
        }
    };

    const normalizeType = (value) => {
        const type = String(value || '').trim().toLowerCase() || QUERY_SYNC_STATE_DEFAULTS.type;
        if (!['string', 'number', 'boolean', 'csv', 'json'].includes(type)) {
            throw new Error("Error: 'type' solo permite 'string', 'number', 'boolean', 'csv' o 'json'.");
        }
        return type;
    };

    const normalizeHistory = (value) => {
        const mode = String(value || '').trim().toLowerCase() || QUERY_SYNC_STATE_DEFAULTS.history;
        if (!['replace', 'push'].includes(mode)) {
            throw new Error("Error: 'history' solo permite 'replace' o 'push'.");
        }
        return mode;
    };

    const getSubjects = (root = document) => {
        const subjects = [];

        if (root.nodeType === 1 && root.matches(SELECTOR_SUBJECT)) {
            subjects.push(root);
        }

        if (typeof root.querySelectorAll === 'function') {
            subjects.push(...root.querySelectorAll(SELECTOR_SUBJECT));
        }

        return subjects;
    };

    const flushPendingRemovals = () => {
        PENDING_REMOVALS.forEach((node) => {
            if (!node.isConnected) {
                QuerySyncState.destroyAll(node);
            }
            PENDING_REMOVALS.delete(node);
        });
    };

    const scheduleRemovalCheck = (node) => {
        PENDING_REMOVALS.add(node);
        queueMicrotask(flushPendingRemovals);
    };

    const isElementSyncable = (element) => {
        return element instanceof HTMLInputElement
            || element instanceof HTMLSelectElement
            || element instanceof HTMLTextAreaElement;
    };

    const getOptionsFromData = (element) => {
        const options = {};

        const setTrimmedOption = (key, value, transform) => {
            if (typeof value !== 'string') return;
            const trimmedValue = value.trim();
            if (!trimmedValue) return;
            options[key] = typeof transform === 'function' ? transform(trimmedValue) : trimmedValue;
        };

        const omitDefault = parseBoolean(element.dataset.qssOmitDefault)
            , syncOnInit = parseBoolean(element.dataset.qssSyncOnInit)
            , trim = parseBoolean(element.dataset.qssTrim);

        setTrimmedOption('key', element.dataset.qssKey);
        setTrimmedOption('type', element.dataset.qssType);
        setTrimmedOption('history', element.dataset.qssHistory);
        setTrimmedOption('defaultRaw', element.dataset.qssDefault);
        setTrimmedOption('resetPageKey', element.dataset.qssResetPageKey);

        element.dataset.qssDebounce !== undefined && (options.debounceMs = Math.max(0, parseNumber(element.dataset.qssDebounce, QUERY_SYNC_STATE_DEFAULTS.debounceMs)));
        omitDefault !== undefined && (options.omitDefault = omitDefault);
        syncOnInit !== undefined && (options.syncOnInit = syncOnInit);
        trim !== undefined && (options.trim = trim);

        return options;
    };

    const parseByType = (rawValue, type) => {
        if (rawValue === undefined || rawValue === null) return undefined;

        switch (type) {
            case 'number': {
                const parsed = Number(rawValue);
                return Number.isFinite(parsed) ? parsed : undefined;
            }
            case 'boolean': {
                const parsed = parseBoolean(rawValue);
                return parsed === undefined ? undefined : parsed;
            }
            case 'csv':
                return String(rawValue)
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean);
            case 'json':
                return typeof rawValue === 'string' ? parseJsonSafe(rawValue) : rawValue;
            case 'string':
            default:
                return String(rawValue);
        }
    };

    const stringifyByType = (value, type) => {
        if (value === undefined || value === null) return '';

        switch (type) {
            case 'number': {
                const parsed = Number(value);
                return Number.isFinite(parsed) ? String(parsed) : '';
            }
            case 'boolean':
                return value ? '1' : '0';
            case 'csv':
                return Array.isArray(value)
                    ? value.map((item) => String(item || '').trim()).filter(Boolean).join(',')
                    : String(value || '');
            case 'json': {
                try {
                    return JSON.stringify(value);
                } catch (_error) {
                    return '';
                }
            }
            case 'string':
            default:
                return String(value);
        }
    };

    const areValuesEquivalent = (left, right, type) => {
        if (left === right) return true;

        const leftString = stringifyByType(left, type)
            , rightString = stringifyByType(right, type);

        return leftString === rightString;
    };

    const getValidatedOptions = (element, options = {}) => {
        const mergedOptions = { ...QUERY_SYNC_STATE_DEFAULTS, ...getOptionsFromData(element), ...options };

        if (!mergedOptions.key) {
            throw new Error("Error: No se especifico la key 'data-qss-key'.");
        }

        mergedOptions.type = normalizeType(mergedOptions.type);
        mergedOptions.history = normalizeHistory(mergedOptions.history);
        mergedOptions.debounceMs = Math.max(0, parseNumber(mergedOptions.debounceMs, QUERY_SYNC_STATE_DEFAULTS.debounceMs));

        if (mergedOptions.defaultValue === undefined && typeof mergedOptions.defaultRaw === 'string') {
            mergedOptions.defaultValue = parseByType(mergedOptions.defaultRaw, mergedOptions.type);
        }

        return mergedOptions;
    };

    class QuerySyncState {
        constructor(element, options) {
            this.subject = element;
            this.options = { ...QUERY_SYNC_STATE_DEFAULTS, ...options };
            this.isBound = false;
            this.isApplyingFromUrl = false;
            this.debounceTimer = null;

            this.handleInput = this.handleInput.bind(this);
            this.handleChange = this.handleChange.bind(this);
            this.handlePopState = this.handlePopState.bind(this);
        }

        getListeners() {
            if (!isElementSyncable(this.subject)) return [];

            if (this.subject instanceof HTMLSelectElement) {
                return [['change', this.handleChange]];
            }

            if (this.subject instanceof HTMLTextAreaElement) {
                return [['input', this.handleInput], ['change', this.handleChange]];
            }

            if (this.subject instanceof HTMLInputElement) {
                if (['checkbox', 'radio'].includes(this.subject.type)) {
                    return [['change', this.handleChange]];
                }
                return [['input', this.handleInput], ['change', this.handleChange]];
            }

            return [];
        }

        applyListeners(method) {
            this.getListeners().forEach(([eventName, handler, useCapture]) => {
                this.subject[method](eventName, handler, useCapture);
            });
        }

        handleInput(event) {
            this.scheduleSync('ui', event);
        }

        handleChange(event) {
            this.scheduleSync('ui', event);
        }

        handlePopState(event) {
            this.syncFromUrl('history', event);
        }

        scheduleSync(source, originalEvent = null) {
            if (this.isApplyingFromUrl) return;

            if (this.options.debounceMs <= 0) {
                this.syncToUrl(source, originalEvent);
                return;
            }

            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.syncToUrl(source, originalEvent);
            }, this.options.debounceMs);
        }

        readElementValue() {
            if (!isElementSyncable(this.subject)) return undefined;

            if (this.subject instanceof HTMLInputElement) {
                if (this.subject.type === 'radio') {
                    return this.subject.checked ? this.subject.value : NO_UPDATE;
                }

                if (this.subject.type === 'checkbox') {
                    if (this.options.type === 'boolean') {
                        return this.subject.checked;
                    }
                    return this.subject.checked ? (this.subject.value || '1') : undefined;
                }

                const rawValue = this.subject.value == null ? '' : String(this.subject.value);
                return this.options.trim ? rawValue.trim() : rawValue;
            }

            if (this.subject instanceof HTMLSelectElement) {
                if (this.subject.multiple) {
                    return Array.from(this.subject.selectedOptions)
                        .map((option) => String(option.value || '').trim())
                        .filter(Boolean);
                }
                return this.subject.value;
            }

            const rawValue = this.subject.value == null ? '' : String(this.subject.value);
            return this.options.trim ? rawValue.trim() : rawValue;
        }

        writeElementValue(value) {
            if (!isElementSyncable(this.subject)) return;

            if (this.subject instanceof HTMLInputElement) {
                if (this.subject.type === 'radio') {
                    this.subject.checked = value != null && String(value) === String(this.subject.value);
                    return;
                }

                if (this.subject.type === 'checkbox') {
                    if (this.options.type === 'boolean') {
                        this.subject.checked = Boolean(value);
                    } else {
                        this.subject.checked = value != null && String(value) === String(this.subject.value || '1');
                    }
                    return;
                }

                this.subject.value = value == null ? '' : String(value);
                return;
            }

            if (this.subject instanceof HTMLSelectElement) {
                if (this.subject.multiple) {
                    const selectedValues = Array.isArray(value)
                        ? value.map((item) => String(item))
                        : String(value == null ? '' : value)
                            .split(',')
                            .map((item) => item.trim())
                            .filter(Boolean);

                    const selectedSet = new Set(selectedValues);
                    Array.from(this.subject.options).forEach((option) => {
                        option.selected = selectedSet.has(String(option.value));
                    });
                    return;
                }

                this.subject.value = value == null ? '' : String(value);
                return;
            }

            this.subject.value = value == null ? '' : String(value);
        }

        buildDetail(baseDetail = {}) {
            return {
                key: this.options.key,
                type: this.options.type,
                history: this.options.history,
                trigger: this.subject,
                ...baseDetail,
            };
        }

        syncFromUrl(source = 'url', originalEvent = null) {
            const currentParams = new URLSearchParams(window.location.search)
                , currentRaw = currentParams.get(this.options.key)
                , parsedValue = currentRaw === null
                    ? this.options.defaultValue
                    : parseByType(currentRaw, this.options.type)
                , nextValue = parsedValue === undefined ? this.options.defaultValue : parsedValue
                , detail = this.buildDetail({
                    source,
                    originalEvent,
                    rawValue: currentRaw,
                    value: nextValue,
                });

            try {
                this.isApplyingFromUrl = true;
                this.writeElementValue(nextValue);

                this.options.onSync && this.options.onSync(detail, this.subject);
                this.subject.dispatchEvent(new CustomEvent('sync.plugin.querySyncState', {
                    detail,
                }));

                return true;
            } catch (error) {
                const errorDetail = this.buildDetail({
                    source,
                    originalEvent,
                    error,
                });

                this.options.onError && this.options.onError(errorDetail, this.subject);
                this.subject.dispatchEvent(new CustomEvent('error.plugin.querySyncState', {
                    detail: errorDetail,
                }));

                return false;
            } finally {
                this.isApplyingFromUrl = false;

                const completeDetail = this.buildDetail({
                    source,
                    originalEvent,
                });

                this.options.onComplete && this.options.onComplete(completeDetail, this.subject);
                this.subject.dispatchEvent(new CustomEvent('complete.plugin.querySyncState', {
                    detail: completeDetail,
                }));
            }
        }

        syncToUrl(source = 'ui', originalEvent = null) {
            if (this.isApplyingFromUrl) return false;

            const elementValue = this.readElementValue();
            if (elementValue === NO_UPDATE) return false;

            const beforeDetail = this.buildDetail({
                source,
                originalEvent,
                value: elementValue,
            });

            this.options.onBeforeSync && this.options.onBeforeSync(beforeDetail, this.subject);
            const beforeEvent = new CustomEvent('before.plugin.querySyncState', {
                cancelable: true,
                detail: beforeDetail,
            });

            if (!this.subject.dispatchEvent(beforeEvent)) {
                return false;
            }

            try {
                const currentUrl = new URL(window.location.href)
                    , previousParams = new URLSearchParams(currentUrl.search)
                    , nextParams = new URLSearchParams(currentUrl.search)
                    , previousRaw = previousParams.get(this.options.key)
                    , omitByDefault = this.options.omitDefault
                        && this.options.defaultValue !== undefined
                        && areValuesEquivalent(elementValue, this.options.defaultValue, this.options.type);

                const normalizedValue = omitByDefault ? undefined : elementValue
                    , nextRaw = normalizedValue === undefined ? null : stringifyByType(normalizedValue, this.options.type);

                if (nextRaw === null || nextRaw === '') {
                    nextParams.delete(this.options.key);
                } else {
                    nextParams.set(this.options.key, nextRaw);
                }

                if (this.options.resetPageKey
                    && this.options.resetPageKey !== this.options.key
                    && previousRaw !== nextRaw
                ) {
                    nextParams.delete(this.options.resetPageKey);
                }

                const previousSearch = previousParams.toString()
                    , nextSearch = nextParams.toString();

                if (previousSearch === nextSearch) {
                    return false;
                }

                const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
                const historyState = {
                    ...(window.history.state && typeof window.history.state === 'object' ? window.history.state : {}),
                    qss: true,
                    key: this.options.key,
                };

                if (this.options.history === 'push') {
                    window.history.pushState(historyState, '', nextUrl);
                } else {
                    window.history.replaceState(historyState, '', nextUrl);
                }

                const syncDetail = this.buildDetail({
                    source,
                    originalEvent,
                    value: normalizedValue,
                    previousRaw,
                    nextRaw,
                    nextUrl,
                });

                this.options.onSync && this.options.onSync(syncDetail, this.subject);
                this.subject.dispatchEvent(new CustomEvent('sync.plugin.querySyncState', {
                    detail: syncDetail,
                }));

                return true;
            } catch (error) {
                const errorDetail = this.buildDetail({
                    source,
                    originalEvent,
                    error,
                });

                this.options.onError && this.options.onError(errorDetail, this.subject);
                this.subject.dispatchEvent(new CustomEvent('error.plugin.querySyncState', {
                    detail: errorDetail,
                }));

                return false;
            } finally {
                const completeDetail = this.buildDetail({
                    source,
                    originalEvent,
                });

                this.options.onComplete && this.options.onComplete(completeDetail, this.subject);
                this.subject.dispatchEvent(new CustomEvent('complete.plugin.querySyncState', {
                    detail: completeDetail,
                }));
            }
        }

        reset(options = {}) {
            const { syncToUrl = true } = options;
            this.writeElementValue(this.options.defaultValue);
            if (syncToUrl) {
                this.syncToUrl('reset', null);
            }
        }

        bind() {
            if (this.isBound) return;

            this.applyListeners('addEventListener');
            window.addEventListener('popstate', this.handlePopState);
            this.isBound = true;

            if (this.options.syncOnInit) {
                this.syncFromUrl('init', null);
            }
        }

        unbind() {
            if (!this.isBound) return;

            this.applyListeners('removeEventListener');
            window.removeEventListener('popstate', this.handlePopState);

            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
            this.isBound = false;
        }

        destroy() {
            this.unbind();
            INSTANCES.delete(this.subject);
        }

        static init(element, options = {}) {
            if (!(element instanceof HTMLElement)) {
                throw new Error('Error: QuerySyncState.init requiere un HTMLElement.');
            }

            const currentInstance = INSTANCES.get(element);
            if (currentInstance) return currentInstance;

            const validatedOptions = getValidatedOptions(element, options)
                , instance = new QuerySyncState(element, validatedOptions);

            INSTANCES.set(element, instance);
            instance.bind();
            return instance;
        }

        static getInstance(element) {
            if (!(element instanceof HTMLElement)) return null;
            return INSTANCES.get(element) || null;
        }

        static destroy(element) {
            const instance = QuerySyncState.getInstance(element);
            if (!instance) return false;

            instance.destroy();
            return true;
        }

        static initAll(root = document, options = {}) {
            return getSubjects(root).map((element) => QuerySyncState.init(element, options));
        }

        static destroyAll(root = document) {
            return getSubjects(root).reduce((destroyedCount, element) => {
                return QuerySyncState.destroy(element) ? destroyedCount + 1 : destroyedCount;
            }, 0);
        }
    }

    const startAutoInit = () => {
        QuerySyncState.initAll(document);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    PENDING_REMOVALS.delete(node);
                    QuerySyncState.initAll(node);
                });

                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    scheduleRemovalCheck(node);
                });
            });
        });

        const observeGlobal = (document.documentElement.getAttribute('data-pp-observe-global') || '').trim().toLowerCase();
        if (!['false', '0', 'off', 'no'].includes(observeGlobal)) {
            const observeRootSelector = (document.documentElement.getAttribute('data-pp-observe-root') || '').trim();
            const observeRootElement = document.querySelector('[data-pp-observe-root-query-sync-state]');
            let observeRoot = observeRootElement || document.body || document.documentElement;

            if (observeRootSelector && !observeRootElement) {
                try {
                    observeRoot = document.querySelector(observeRootSelector) || observeRoot;
                } catch (_error) {
                    observeRoot = document.body || document.documentElement;
                }
            }

            observer.observe(observeRoot, { childList: true, subtree: true });
        }
    };

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', startAutoInit, { once: true })
        : startAutoInit();

    window.QuerySyncState = QuerySyncState;
})();
