---
name: iso-engine
description: Arquitectura del motor isométrico pixel-art de DIMENSION33 (proyección, rasterizador, orden de pintado, escena, App). Usar antes de tocar cualquier archivo de src/engine, src/game o src/app.js, o al depurar errores visuales (objetos que se tapan mal, huecos, picking que falla).
---

# Motor isométrico de DIMENSION33

## Mapa de módulos

| Archivo | Responsabilidad | ¿Toca el DOM? |
|---|---|---|
| `src/engine/config.js` | Constantes (tamaños, límites, IDs reservados) | No |
| `src/engine/color.js` | Colores empaquetados RGBA, sombreado de caras | No |
| `src/engine/raster.js` | Rasterizador por software: `color`, `id` (picking), `glow` (emisivo) | No |
| `src/engine/iso.js` | Proyección 2:1, caras de cajas, orden topológico | No |
| `src/game/catalog.js` | Definiciones de objetos (todo son cajas) | No |
| `src/game/room.js` | Modelo, reglas de colocación, codificación en URL | No |
| `src/game/scene.js` | Composición de la escena por capas | No |
| `src/game/avatar.js`, `pathfind.js` | Personaje y A* | No |
| `src/app.js` | Estado, acciones, cámara, bucle | Sí (canvas) |
| `src/main.js`, `src/ui/*` | DOM, entrada, audio, storage | Sí |

Regla: **engine/ y game/ son puros** → se testean en Node (`npm test`). No importes nada del DOM ahí.

## Coordenadas

- Mundo en tiles: `x` → abajo-derecha, `y` → abajo-izquierda, `z` → arriba. 1 tile = 32×16 px, 1 unidad z = 16 px.
- Se ven 3 caras por caja: tapa (`z1`), derecha (`x = x1`, sombra), izquierda (`y = y1`, base).
- Paredes: `SIDE_L` es el plano `x = 0` (corre por `y`), `SIDE_R` es el plano `y = 0` (corre por `x`).
- Objetos de pared en el catálogo usan `(u, v, z)`: `u` a lo largo de la pared, `v` hacia afuera.

## Pipeline de render (scene.js → renderScene)

1. Paredes + losa + piso (patrón) + oclusión ambiental + zócalos
2. Alfombras (capa `rug`, nunca se ordenan con muebles)
3. Luz de ventanas (día) y sombras de contacto (`mul` solo sobre piso/alfombras)
4. Cajas de muebles, deco, pared y personaje → **orden topológico** (`sortBoxes`)
5. Iluminación nocturna (`applyLighting`, los píxeles `glow` no se oscurecen)
6. Contorno de silueta → resaltados (hover/selección) → fantasma de colocación → notas musicales

## Orden de pintado

`sortBoxes` compara solo cajas cuyas envolventes en pantalla se tocan. Si existe un eje que las separa, la de menor coordenada se dibuja antes. **Las cajas de un mismo objeto no deben intersecarse en 3D**: si dos cajas comparten volumen el orden queda indefinido y aparecen parpadeos. Separalas por al menos un eje (ej.: patas hasta z=0.72, tapa desde z=0.72).

## Picking

Cada píxel guarda en `raster.id` el índice del item + 1 (o `ID_FLOOR`, `ID_WALL_L/R`, `ID_AVATAR`). Para saber qué tocó el usuario: `app.itemIndexAt(rx, ry)`. Es pixel-perfect: no hace falta geometría de colisión.

## Estado y deshacer

- Toda mutación pasa por `app.mutate(draft => …)`: guarda el estado anterior codificado (string compacto), persiste en localStorage y en `#r=` de la URL.
- `mutate` conserva la identidad de los objetos que no cambian (el personaje guarda referencias para sentarse).

## Depurar

- `node tools/render-demo.mjs <carpeta>` → PNG día/noche sin navegador.
- Abrí `index.html?debug` → `window.d33` es la instancia de App.
