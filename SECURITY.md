# Seguridad

DIMENSION33 es un repositorio **público**. Estas reglas protegen al proyecto y a quienes lo usan.

## Reglas para contribuir

1. **Nunca** se suben claves, tokens, contraseñas, archivos `.env` ni credenciales. Si algo necesita un secreto, va en *GitHub → Settings → Secrets and variables*.
2. **Sin datos personales**: nada de emails, teléfonos ni nombres reales en el código o en los commits. Configurá git con tu email anónimo de GitHub:
   ```sh
   git config user.email "<id>+<usuario>@users.noreply.github.com"
   ```
   (Lo encontrás en *GitHub → Settings → Emails → Keep my email address private*).
3. **Sin archivos pesados ni paquetes** (`.zip`, `.iso`, `.rar`): el material fuente privado vive en un repositorio **privado** aparte.
4. Activá el hook que revisa cada commit: `npm run hooks`.

## Defensas incluidas en la app

| Riesgo | Mitigación |
|---|---|
| Inyección de scripts (XSS) | Content-Security-Policy estricta: solo scripts propios, sin `eval`, sin inline. La UI usa `textContent`, nunca `innerHTML` con datos. |
| Links manipulados (`#r=...`) | El decodificador valida longitud, alfabeto, versión, límites de tamaño y cada objeto. Si algo falla, se descarta sin romper nada. |
| Rastreo | Sin analytics, sin cookies, sin CDNs de terceros, `referrer` desactivado. Todo corre en el navegador. |
| Almacenamiento local | `localStorage` envuelto en try/catch; si no está disponible el juego sigue funcionando. |
| Service worker | Solo cachea archivos del mismo origen y solo se registra en contextos seguros (HTTPS). |
| Secretos en el repo | `tools/scan-secrets.mjs` corre en el hook pre-commit y en CI. |

## Reportar una vulnerabilidad

No abras un issue público. Usá **GitHub → Security → Report a vulnerability** (aviso privado al mantenedor).
