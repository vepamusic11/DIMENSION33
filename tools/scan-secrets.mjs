// Escáner de secretos y datos personales, sin dependencias.
// El repo es PÚBLICO: cualquier token, clave o email personal que se suba queda expuesto.
//
// Uso:
//   node tools/scan-secrets.mjs            → escanea todos los archivos versionados (CI)
//   node tools/scan-secrets.mjs --staged   → escanea lo que está por commitearse (hook pre-commit)
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const staged = process.argv.includes('--staged');
const MAX_BYTES = 5 * 1024 * 1024; // archivos > 5 MB no deberían estar en este repo

const RULES = [
  ['Clave privada', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/],
  ['Token de GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['Clave de AWS', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Clave de Google/Firebase', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Token de Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Clave de Stripe', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/],
  ['Clave de OpenAI/Anthropic', /\b(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9]{32,})\b/],
  ['Webhook de Discord', /discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['URL con credenciales', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@'"]+:[^\s/@'"]+@[^\s'"]+/i],
  ['Asignación de secreto', /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i],
];

// Emails permitidos (anónimos o de ejemplo). Cualquier otro se considera dato personal.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_OK = [/@users\.noreply\.github\.com$/i, /^noreply@anthropic\.com$/i, /@example\.(com|org|net)$/i];

const FORBIDDEN_NAMES = [/(^|\/)\.env(\.|$)(?!example)/, /\.(pem|key|p12|pfx|keystore|jks)$/i, /(^|\/)id_(rsa|ed25519)/, /credentials.*\.json$/i, /service-account.*\.json$/i, /\.(zip|rar|7z|iso)$/i];
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp3|ogg|wav|mp4|webm|pdf)$/i;
const SELF = 'tools/scan-secrets.mjs';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const files = (staged ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']) : git(['ls-files']))
  .split('\n')
  .filter(Boolean);

const findings = [];
for (const f of files) {
  if (FORBIDDEN_NAMES.some((re) => re.test(f))) findings.push([f, 0, 'Tipo de archivo prohibido en un repo público']);
  let size = 0;
  try {
    size = staged ? Number(git(['cat-file', '-s', `:${f}`]).trim()) : statSync(f).size;
  } catch {
    continue;
  }
  if (size > MAX_BYTES) findings.push([f, 0, `Archivo demasiado grande (${(size / 1048576).toFixed(1)} MB)`]);
  if (BINARY.test(f) || f === SELF) continue;
  let text;
  try {
    text = staged ? git(['show', `:${f}`]) : readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('scan-secrets: allow')) return; // excepción explícita y auditable
    for (const [name, re] of RULES) if (re.test(line)) findings.push([f, i + 1, name]);
    for (const m of line.match(EMAIL) || []) {
      if (!EMAIL_OK.some((re) => re.test(m))) findings.push([f, i + 1, `Email personal (${m.replace(/^(.).*(@.*)$/, '$1***$2')})`]);
    }
  });
}

if (findings.length) {
  console.error('\n✘ Se encontraron posibles secretos o datos personales:\n');
  for (const [f, l, why] of findings) console.error(`  ${f}${l ? ':' + l : ''}  →  ${why}`);
  console.error('\nQuitá el dato (usá variables de entorno / secretos de GitHub) y volvé a intentar.');
  console.error('Si es un falso positivo, agregá el comentario  scan-secrets: allow  en esa línea.\n');
  process.exit(1);
}
console.log(`✔ Sin secretos ni datos personales (${files.length} archivos revisados)`);
