---
name: secure-commit
description: Checklist obligatorio antes de commitear o pushear en DIMENSION33, que es un repositorio PÚBLICO. Usar siempre antes de git commit / git push, y al integrar archivos externos (ZIPs, assets, código de otro repo).
---

# Commit seguro (repo público)

Antes de cada commit/push:

1. **Hook activo**: `git config core.hooksPath` debe devolver `.githooks`. Si no: `npm run hooks`.
2. **Escaneo completo**: `npm run check` (secretos + emails personales + archivos grandes + tests). Debe terminar en verde.
3. **Identidad anónima**: `git config user.email` debe ser `…@users.noreply.github.com` o el email anónimo del agente. Nunca un email personal.
4. **Revisá el diff**, no solo el resumen: `git diff --cached --stat` y luego el contenido. Buscá rutas locales (`C:\Users\<nombre>`, `/home/<nombre>`), nombres reales, IPs internas, URLs privadas.
5. **Sin binarios pesados ni paquetes**: nada de `.zip`, `.iso`, `.rar` ni archivos > 5 MB. El material fuente privado vive en un repo privado.
6. **Mensaje de commit** descriptivo, en imperativo, sin datos personales.

Si el escáner marca algo:
- Secreto real → quitarlo, **rotarlo** (darlo por comprometido aunque no se haya pusheado) y moverlo a GitHub Secrets.
- Falso positivo → agregar `scan-secrets: allow` en esa línea, con un comentario que explique por qué.

Si un secreto llegó a pushearse: rotarlo de inmediato. Borrarlo del historial no alcanza (pudo ser clonado o cacheado).
