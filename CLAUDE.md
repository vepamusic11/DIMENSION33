# DIMENSION33 · guía para Claude

Juego web de habitaciones isométricas en pixel-art (construir + jugar) para PC y celular.
JavaScript puro con módulos ES, **sin dependencias de runtime ni paso de build**.

## Comandos
- `npm test` — tests unitarios (Node ≥ 20, `node:test`)
- `npm run check` — escáner de secretos + tests (correr antes de cada commit)
- `npm run smoke` — prueba en Chromium real, escritorio + iPhone, con capturas en `smoke-output/`
- `npm start` — servidor local en http://localhost:5173
- `npm run preview` — regenera `docs/preview-*.png`
- `npm run icons` — regenera los íconos PNG de la PWA

## Reglas del proyecto
- **El repo es PÚBLICO.** Nada de secretos, emails personales, rutas locales ni archivos grandes. Seguir la skill `secure-commit`.
- `src/engine` y `src/game` son lógica pura: sin DOM, testeable en Node.
- CSP estricta en `index.html`: sin scripts inline, sin CDNs externos, sin `innerHTML` con datos.
- Los `id` del catálogo se guardan en los links compartidos: nunca reutilizarlos ni cambiarlos.
- Cajas de un mismo objeto no deben intersecarse en 3D (rompe el orden de pintado).
- Textos de la UI en español rioplatense (vos), claros y cortos.
- Si se agregan archivos al shell de la app, sumarlos a `sw.js` y subir `CACHE_VERSION`.

## Skills del proyecto (`.claude/skills/`)
`iso-engine` · `add-catalog-item` · `secure-commit` · `qa-game` · `import-iso-zip`

## Tareas
Ver `TASKS.md` (orden de ejecución y pendientes).
