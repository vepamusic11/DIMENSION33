---
name: qa-game
description: Verificar DIMENSION33 en un navegador real en escritorio y celular (Playwright + Chromium), con capturas. Usar después de cualquier cambio visual, de controles o de UI, y antes de abrir un PR.
---

# QA del juego (PC + celular)

## Rápido
```sh
npm test                  # lógica pura (Node)
npm run smoke             # navegador real: escritorio 1366×820 + iPhone 13 (touch)
```
`npm run smoke` deja capturas en `smoke-output/` (ignorada por git). **Miralas**: el test valida comportamiento, no estética.

## Qué revisar a ojo
- Sin scroll horizontal en celular (el layout no debe hacer zoom-out).
- La barra flotante no tapa el catálogo; el catálogo se pliega.
- Colocar en touch: 1er toque previsualiza (verde/rojo), 2º toque o ✓ coloca.
- Modo noche: lámparas, TV y notebook iluminan; las ventanas se oscurecen.
- Objetos que se tapan mal → ver la skill `iso-engine` (cajas que se intersecan).

## Pruebas dirigidas
Abrí `index.html?debug` y usá `window.d33` (instancia de App) para ubicar puntos del mundo en pantalla:
```js
const a = d33, o = a.layout.origin, v = a.view;
const sx = o.x + (x - y) * 16, sy = o.y + (x + y) * 8 - z * 16;
const px = (sx * v.zoom + v.panX) / v.dpr, py = (sy * v.zoom + v.panY) / v.dpr;
```

## Entorno
- En la nube de Claude Code: Chromium ya está instalado (no correr `playwright install`).
- Local: `npm i --no-save playwright@1.56.1 && npx playwright install chromium`.
