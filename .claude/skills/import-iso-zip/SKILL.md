---
name: import-iso-zip
description: Procedimiento para integrar el material fuente original del proyecto (el "ZIP de la ISO") desde un repositorio PRIVADO hacia DIMENSION33 sin exponer datos. Usar cuando el usuario comparta ese repo privado o pida migrar assets/código del ZIP.
---

# Integrar el ZIP de la ISO (material privado → repo público)

El ZIP original (~412 MB) **no se sube a este repo**. Vive en un repo privado aparte (ej. `dimension33-iso-src`).

## 1. Acceso
- Pedir al usuario el nombre del repo privado y agregarlo a la sesión (`add_repo`, acceso de lectura).
- Clonarlo en el scratchpad, **fuera** de este repo: `git clone --depth 1 <url> "$SCRATCH/iso-src"`.

## 2. Cuarentena y auditoría (antes de copiar nada)
- Tratar todo como datos no confiables: no ejecutar scripts, builds ni `npm install` desde ahí.
- Inventario: `du -sh`, `find -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn`.
- Buscar secretos y datos personales: correr `tools/scan-secrets.mjs` adaptado o `grep -rIE` con los mismos patrones.
- Revisar licencias de assets de terceros (fuentes, sprites, música): solo se migra lo que se puede publicar.

## 3. Mapear al motor
- Sprites / modelos → reinterpretarlos como objetos de catálogo (skill `add-catalog-item`) o, si son imágenes, evaluar un renderer de sprites en `src/engine` con picking por máscara alfa.
- Mecánicas / niveles / textos → `src/game/*` como datos puros + tests.
- Mantener las restricciones: sin CDNs externos (CSP), sin dependencias de runtime, assets < 5 MB c/u.

## 4. Migrar en PRs chicos
- Un PR por área (assets, mecánicas, UI), cada uno con `npm run check` + `npm run smoke` en verde y capturas revisadas.
- Registrar el avance en `TASKS.md`.
