/**
 * @fileoverview Plugin nativo para remover elementos HTML de una lista o colección.
 * @module ItemRemover
 * @version 3.0
 * @since 2026
 * @author Samuel Montenegro
 * @license MIT
 * @copyright (c) 2026 Samuel Montenegro
 */
(function () {
	'use strict';

	/**
	 * Selector declarativo de triggers de eliminacion.
	 * @type {string}
	 */
	const SELECTOR_ROLE = '[data-role="remove-item"]'
		/**
		 * Defaults de configuracion para ItemRemover.
		 * @type {Object}
		 */
		, ITEM_REMOVER_DEFAULTS = Object.freeze({
			targetItemSelector: '[data-remove-item="item"]',
		})
		/**
		 * Registro de instancias por trigger.
		 * @type {WeakMap<HTMLElement, ItemRemover>}
		 */
		, INSTANCES = new WeakMap()
		/**
		 * Nodos removidos pendientes de limpieza diferida.
		 * @type {Set<Element>}
		 */
		, PENDING_REMOVALS = new Set();

	/**
	 * Lee opciones declarativas desde dataset (`data-remove-*`).
	 * @param {HTMLElement} element Trigger.
	 * @returns {{targetItemSelector:string}|Object}
	 */
	const getOptionsFromData = (element) => {
		const targetItemSelector = element.dataset.removeTarget;

		if (!targetItemSelector) return {};
		return {
			targetItemSelector, // data-remove-target
		};
	};

	/**
	 * Obtiene triggers compatibles en un root.
	 * @param {ParentNode|Element|Document} [root=document] Nodo raiz.
	 * @returns {HTMLElement[]}
	 */
	const getSubjects = (root = document) => {
		const subjects = [];

		if (root.nodeType === 1 && root.matches(SELECTOR_ROLE)) {
			subjects.push(root);
		}

		if (typeof root.querySelectorAll === 'function') {
			subjects.push(...root.querySelectorAll(SELECTOR_ROLE));
		}

		return subjects;
	};

	/**
	 * Opciones publicas de ItemRemover.
	 * @typedef {Object} ItemRemoverOptions
	 * @property {string} [targetItemSelector='[data-remove-item="item"]'] Selector del nodo a eliminar.
	 */

	/**
	 * Clase principal del plugin ItemRemover.
	 *
	 * Flujo:
	 * 1. Resuelve elemento objetivo con `data-remove-target`.
	 * 2. Intercepta click del trigger.
	 * 3. Elimina el nodo objetivo del DOM.
	 * @class ItemRemover
	 */
	class ItemRemover {
		/**
		 * Crea una instancia de ItemRemover.
		 * @param {HTMLElement} element - Elemento sobre el que se inicializa el plugin.
		 * @param {ItemRemoverOptions} options - Opciones de configuración del plugin.
		 */
		constructor(element, options) {
			this.subject = element;
			this.options = { ...ITEM_REMOVER_DEFAULTS, ...options };
			this.isBound = false;
			this.handleClick = this.handleClick.bind(this);
		}

		/**
		 * Obtiene el elemento objetivo que será eliminado.
		 * @returns {HTMLElement|null}
		 */
		getTargetElement() {
			if (!this.options.targetItemSelector) return null;
			return this.subject.closest(this.options.targetItemSelector);
		}

		/**
		 * Vincula el evento de clic al elemento a remover.
		 * @returns {void}
		 */
		bind() {
			if (this.isBound) return;
			this.subject.addEventListener('click', this.handleClick);
			this.isBound = true;
		}

		/**
		 * Desmonta la instancia y libera sus listeners.
		 * @returns {void}
		 */
		destroy() {
			if (!this.isBound) return;	
			this.subject.removeEventListener('click', this.handleClick);
			this.isBound = false;
			INSTANCES.delete(this.subject);
		}

		/**
		 * Maneja el evento click para remover el elemento configurado.
		 * @param {MouseEvent} evt - Evento click.
		 * @returns {void}
		 */
		handleClick(evt) {
			evt.preventDefault();
			const target = this.getTargetElement();
			if (!target) return;
			target.remove();
		}

		/**
		 * Inicializa (o reutiliza) una instancia del plugin.
		 * @param {HTMLElement} element Elemento trigger.
		 * @param {ItemRemoverOptions} [options={}] Opciones de inicialización.
		 * @returns {ItemRemover}
		 */
		static init(element, options = {}) {
			if (!(element instanceof HTMLElement)) {
				throw new Error('Error: ItemRemover.init requiere un HTMLElement.');
			}

			const currentInstance = INSTANCES.get(element);
			if (currentInstance) {
				return currentInstance;
			}

			const mergedOptions = { ...getOptionsFromData(element), ...options }
				, instance = new ItemRemover(element, mergedOptions);
			INSTANCES.set(element, instance);
			instance.bind();
			return instance;
		}

		/**
		 * Obtiene la instancia asociada a un trigger.
		 * @param {HTMLElement} element Elemento trigger.
		 * @returns {ItemRemover|null}
		 */
		static getInstance(element) {
			if (!(element instanceof HTMLElement)) return null;	
			return INSTANCES.get(element) || null;
		}

		/**
		 * Destruye la instancia asociada a un trigger.
		 * @param {HTMLElement} element Elemento trigger.
		 * @returns {boolean}
		 */
		static destroy(element) {
			const instance = ItemRemover.getInstance(element);
			if (!instance) return false;
			instance.destroy();
			return true;
		}

		/**
		 * Inicializa todas las coincidencias dentro de un root.
		 * @param {ParentNode|Element|Document} [root=document] Nodo raiz.
		 * @param {ItemRemoverOptions} [options={}] Opciones compartidas.
		 * @returns {ItemRemover[]}
		 */
		static initAll(root = document, options = {}) {
			return getSubjects(root).map((element) => ItemRemover.init(element, options));
		}

		/**
		 * Destruye todas las instancias encontradas dentro de un root.
		 * @param {ParentNode|Element|Document} [root=document] Nodo raiz.
		 * @returns {number}
		 */
		static destroyAll(root = document) {
			return getSubjects(root).reduce((destroyedCount, element) => {
				return ItemRemover.destroy(element) ? destroyedCount + 1 : destroyedCount;
			}, 0);
		}
	}

 	/**
     * ObserverDispatcher avanzado: permite a cada plugin observar solo el root que le corresponde,
     * evitando múltiples MutationObserver redundantes y respetando la configuración global.
     */
    if (!window.Plugins) window.Plugins = {};
    if (!window.Plugins.ObserverDispatcher) {
        window.Plugins.ObserverDispatcher = (function() {
            // Mapa: rootElement => { observer, handlers[] }
            const roots = new WeakMap();

            /**
             * Obtiene el root adecuado para un plugin según la prioridad documentada.
             * @param {string} pluginKey Ej: 'item-remover'
             * @returns {Element}
             */
            function resolveRoot(pluginKey) {
                // 1. data-pp-observe-root-{plugin}
                const attr = 'data-pp-observe-root-' + pluginKey
                    , specific = document.querySelector('[' + attr + ']');
                if (specific) return specific;

                // 2. data-pp-observe-root en <html>
                const html = document.documentElement
                    , selector = html.getAttribute('data-pp-observe-root');
                if (selector) {
                    try {
                        const el = document.querySelector(selector);
                        if (el) return el;
                    } catch (_) {}
                }

                // 3. Fallback seguro
                return document.body || html;
            }

            /**
             * Registra un handler para un plugin sobre el root adecuado.
             * @param {string} pluginKey
             * @param {function} handler
             */
            function register(pluginKey, handler) {
                const html = document.documentElement
                    , observeGlobal = (html.getAttribute('data-pp-observe-global') || '').trim().toLowerCase();
                if (["false", "0", "off", "no"].includes(observeGlobal)) return; // Observación global desactivada

                const root = resolveRoot(pluginKey);
                let entry = roots.get(root);
                if (!entry) {
                    entry = { handlers: [], observer: null };
                    entry.observer = new MutationObserver((mutations) => {
                        entry.handlers.forEach(fn => {
                            try { fn(mutations); } catch (e) {}
                        });
                    });
                    entry.observer.observe(root, { childList: true, subtree: true });
                    roots.set(root, entry);
                }
                entry.handlers.push(handler);
            }

            return { register };
        })();
    }

    /**
     * Limpia instancias cuyos nodos fueron removidos del DOM.
     * @returns {void}
     */
    const flushPendingRemovals = () => {
        PENDING_REMOVALS.forEach((node) => {
            if (!node.isConnected) {
                ItemRemover.destroyAll(node);
            }
            PENDING_REMOVALS.delete(node);
        });
    };

    /**
     * Agenda chequeo diferido para evitar destroy en reubicaciones temporales.
     * @param {Element} node Nodo removido en mutacion.
     * @returns {void}
     */
    const scheduleRemovalCheck = (node) => {
        PENDING_REMOVALS.add(node);
        queueMicrotask(flushPendingRemovals);
    };

    // Handler para mutaciones DOM (alta/baja de elementos)
    const itemRemoverDomHandler = (mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return;
                PENDING_REMOVALS.delete(node);
                ItemRemover.initAll(node);
            });
            mutation.removedNodes.forEach((node) => {
                if (node.nodeType !== 1) return;
                scheduleRemovalCheck(node);
            });
        });
    };

    const startAutoInit = () => {
        ItemRemover.initAll(document);
        // Usar ObserverDispatcher para registrar el handler solo sobre el root adecuado
        window.Plugins.ObserverDispatcher.register('item-remover', itemRemoverDomHandler);
    };

	document.readyState === 'loading'
		? document.addEventListener('DOMContentLoaded', startAutoInit, { once: true })
		: startAutoInit();

	window.Plugins.ItemRemover = ItemRemover;
})();
