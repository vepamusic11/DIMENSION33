---
name: add-catalog-item
description: Paso a paso para agregar un mueble, objeto decorativo, alfombra u objeto de pared al catálogo de DIMENSION33 sin romper links compartidos. Usar cuando se pida "agregar un objeto", "nuevo mueble", "más decoración" o similar.
---

# Agregar un objeto al catálogo

1. **Elegí un `id` nuevo** (1-255) que no exista en `src/game/catalog.js`. Los ids se guardan en los links: **nunca reutilices ni cambies uno existente**.
2. **Elegí la capa**:
   - `floor`: mueble que ocupa celdas (`w`×`d`). Si se le pueden apoyar cosas, agregá `surface` (altura de la tapa).
   - `deco`: objeto chico de 1 celda; se apoya en el piso o sobre un `floor` con `surface`. Sus cajas deben caber en 0..1.
   - `rug`: alfombra; usá `rugBoxes(w, d)`.
   - `wall`: objeto de pared con `w` (ancho) y `h` (alto), `z` por defecto; `fixedZ: true` si va al ras del piso (puertas).
3. **Modelá con cajas** `b(x0, y0, z0, x1, y1, z1, color, opciones)`:
   - Rotación 0 = el frente del objeto mira a `+y`.
   - Colores: letra de slot (`'a'`, `'b'`, …) que se resuelve con `variants`, o `'#hex'` fijo.
   - Cajas del mismo objeto **sin volumen compartido** (separalas por un eje).
   - Detalles que deben brillar de noche: `{ glow: true, on: '#hex' }` + `interact: 'toggle'`.
4. **Interacción opcional**: `interact: 'sit'` (+ `seat`), `'toggle'` (+ `light` y/o `music: true`), `'look'`.
5. **Variantes**: 1 a 8 paletas. La primera es la del catálogo.
6. **Verificá**:
   ```sh
   npm test                              # el test de catálogo valida ids, huellas y colores
   node tools/render-demo.mjs /tmp/prev  # o agregalo temporalmente a la demo para verlo
   ```
7. Si lo agregás a la habitación de ejemplo (`src/game/demo.js`), confirmá que `canPlace` lo acepta (el test de la demo falla si se pierde un objeto).
