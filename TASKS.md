# Tareas · DIMENSION33

Orden de ejecución. Marcá `[x]` al completar y mové lo nuevo al bloque que corresponda.

## ✅ Fase 0 · Base (hecho)
- [x] Repo seguro para ser público: `.gitignore`, escáner de secretos, hook pre-commit, `SECURITY.md`
- [x] Motor isométrico pixel-art propio (rasterizador nítido, orden topológico, picking por píxel)
- [x] Catálogo de 41 objetos en 6 categorías, con variantes de color, rotación y apilado sobre superficies
- [x] Modo construir: colocar, rotar, recolorear, mover, duplicar, borrar, deshacer/rehacer
- [x] Modo jugar: personaje con A*, sentarse, encender lámparas/TV/tocadiscos, música lo-fi generativa
- [x] Día / noche con luces dinámicas
- [x] Controles PC (mouse + teclado) y celular (touch, pellizco, doble toque para colocar)
- [x] Guardado automático + link compartible (`#r=…`) validado contra manipulación
- [x] PWA instalable y offline (manifest + service worker)
- [x] Tests unitarios (Node) + prueba de humo en navegador (escritorio + iPhone)
- [x] CI (secretos + tests + navegador) y deploy a GitHub Pages
- [x] Skills del proyecto en `.claude/skills/`

## 🔜 Fase 1 · Integrar el ZIP de la ISO (bloqueado: necesita el repo privado)
- [ ] **Usuario:** descomprimir el ZIP, quitar `node_modules`/builds/videos, subir a un repo **privado** (ej. `dimension33-iso-src`)
- [ ] **Usuario:** pasar el nombre del repo a Claude
- [ ] Auditar el contenido en cuarentena (secretos, licencias, tamaños) — skill `import-iso-zip`
- [ ] Mapear assets/mecánicas de la ISO al motor y migrar en PRs chicos

## 🔜 Fase 2 · Publicación
- [ ] **Usuario:** activar *Settings → Pages → Source: GitHub Actions* (una sola vez)
- [ ] Mergear el PR a `main` → queda jugable en `https://vepamusic11.github.io/DIMENSION33/`
- [ ] Probar instalación como app en Android (Chrome) e iPhone (Safari → Compartir → Agregar a inicio)
- [ ] Configurar el email anónimo de GitHub en la PC del usuario (ver `SECURITY.md`)

## 💡 Fase 3 · Ideas para crecer (priorizar con el usuario)
- [ ] Varias habitaciones conectadas por puertas
- [ ] Más objetos: baño, estudio de música (consola, micrófono, monitores), plantas colgantes
- [ ] Editor de colores libre para paredes y piso
- [ ] Mascota que deambula sola
- [x] Paredes con estilo: rayas, ladrillo, boiserie y azulejos (viajan en el link, compatibles con links viejos)
- [ ] Modo "foto" con marco y exportación para redes
- [ ] Logros / objetivos en modo jugar
