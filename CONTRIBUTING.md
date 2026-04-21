# Guía para Contribuidores

¡Gracias por tu interés en contribuir a JavaScript-Plugins-Library!

Sigue estas pautas para asegurar una colaboración ordenada y coherente con el estilo del repositorio.

## ¿Cómo contribuir?

1. **Forkea** este repositorio y crea una rama para tu cambio.
2. Realiza tus modificaciones en la rama.
3. Asegúrate de que tu código siga las convenciones y buenas prácticas del repo.
4. Si agregas un nuevo plugin, incluye:
   - Carpeta con el nombre del plugin.
   - Archivo fuente `.js` y versión minificada `.min.js`.
   - `README.md` explicando uso, opciones y ejemplos.
   - Archivo de prueba HTML si aplica.
5. Si modificas un plugin existente, mantén la compatibilidad y actualiza la documentación si es necesario.
6. Haz un Pull Request describiendo claramente tu aporte.

## Estilo de Código

- Usa JavaScript nativo (ECMAScript 2020).
- Sigue el patrón de observer y la estructura recomendada (ver README principal).
- Documenta funciones públicas y clases con JSDoc.
- Mantén los nombres de archivos y carpetas en formato consistente.
- No agregues dependencias externas.

## Minificación

- Genera la versión minificada usando `npx terser` o el script batch provisto.
- El archivo `.min.js` debe estar actualizado respecto al `.js` fuente.

## Documentación

- Explica claramente qué hace el plugin, sus opciones y ejemplos de uso.
- Si tu cambio afecta la inicialización automática, revisa la sección de observers en el README principal.

## Reporte de Issues

- Describe el problema, pasos para reproducirlo y, si es posible, adjunta un ejemplo mínimo.

## Contacto

Para dudas o sugerencias, abre un issue, un pull request o contacta directamente a los mantenedores.

¡Gracias por ayudar a mejorar esta colección de plugins!
