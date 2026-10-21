import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(__dirname, 'dist');
const srcDir = path.resolve(__dirname, 'src');

console.log('🚀 Iniciando build da extensão GAL Gestão...');

// 1. Carregar variáveis de ambiente do .env na raiz
function carregarEnv() {
  const envPath = path.resolve(rootDir, '.env');
  const envVars = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx !== -1) {
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envVars[key] = val;
      }
    }
  }
  return envVars;
}

const env = carregarEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://qakzboejxxegpodkffgr.supabase.co';
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseKey) {
  console.warn('⚠️ AVISO: VITE_SUPABASE_PUBLISHABLE_KEY não encontrada no .env');
} else {
  console.log(`✓ Supabase URL detectada: ${supabaseUrl}`);
}

// 2. Preparar diretório de saída extension/dist
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(path.join(distDir, 'icons'), { recursive: true });

// 3. Gerador de PNG puro em Node.js (sem dependências externas)
function gerarPngComLetraG(size) {
  const width = size;
  const height = size;
  const scanlines = [];
  const radius = Math.floor(size * 0.22);

  // Mapa 5x7 simples para a letra G
  const gMap = [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ];

  for (let y = 0; y < height; y++) {
    scanlines.push(0); // filter type 0 (None)
    for (let x = 0; x < width; x++) {
      // Checar cantos arredondados
      let inside = true;
      if (x < radius && y < radius) {
        inside = (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2;
      } else if (x >= width - radius && y < radius) {
        inside = (x - (width - radius)) ** 2 + (y - radius) ** 2 <= radius ** 2;
      } else if (x < radius && y >= height - radius) {
        inside = (x - radius) ** 2 + (y - (height - radius)) ** 2 <= radius ** 2;
      } else if (x >= width - radius && y >= height - radius) {
        inside = (x - (width - radius)) ** 2 + (y - (height - radius)) ** 2 <= radius ** 2;
      }

      if (!inside) {
        scanlines.push(0, 0, 0, 0); // Transparente
        continue;
      }

      // Gradiente azul royal elegante (GAL brand)
      const grad = (y / height) * 0.4 + (x / width) * 0.3;
      let r = Math.floor(37 + grad * 15);
      let g = Math.floor(99 - grad * 35);
      let b = Math.floor(235 - grad * 50);

      // Desenhar letra G estilizada no centro
      const marginX = Math.floor(width * 0.25);
      const marginY = Math.floor(height * 0.22);
      const targetW = width - 2 * marginX;
      const targetH = height - 2 * marginY;

      if (x >= marginX && x < width - marginX && y >= marginY && y < height - marginY) {
        const gridX = Math.floor(((x - marginX) / targetW) * 5);
        const gridY = Math.floor(((y - marginY) / targetH) * 7);
        if (gMap[gridY] && gMap[gridY][gridX]) {
          r = 255;
          g = 255;
          b = 255;
        }
      }

      scanlines.push(r, g, b, 255);
    }
  }

  const idatData = zlib.deflateSync(Buffer.from(scanlines));

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

[16, 48, 128].forEach((size) => {
  const iconBuffer = gerarPngComLetraG(size);
  fs.writeFileSync(path.join(distDir, 'icons', `icon${size}.png`), iconBuffer);
});
console.log('✓ Ícones gerados em extension/dist/icons/');

// 4. Gerar manifest.json
let supabaseHostPermission = `${supabaseUrl}/*`;
try {
  const parsed = new URL(supabaseUrl);
  supabaseHostPermission = `${parsed.origin}/*`;
} catch {}

const manifest = {
  manifest_version: 3,
  name: 'GAL Gestão - WhatsApp',
  version: '1.0.0',
  description: 'Painel lateral de inteligência comercial para WhatsApp Web no CRM GAL Gestão.',
  permissions: ['sidePanel', 'storage', 'tabs'],
  host_permissions: [
    'https://web.whatsapp.com/*',
    supabaseHostPermission,
  ],
  background: {
    service_worker: 'background.js',
  },
  side_panel: {
    default_path: 'sidepanel.html',
  },
  action: {
    default_title: 'Abrir GAL Gestão',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  options_ui: {
    page: 'options.html',
    open_in_tab: true,
  },
  content_scripts: [
    {
      matches: ['https://web.whatsapp.com/*'],
      js: ['content.js'],
      run_at: 'document_idle',
    },
  ],
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
};

fs.writeFileSync(
  path.join(distDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);
console.log('✓ manifest.json criado');

// 5. Copiar arquivos estáticos HTML e CSS
const staticFiles = [
  'sidepanel.html',
  'options.html',
  'sidepanel.css',
  'options.css',
];

for (const file of staticFiles) {
  const src = path.join(srcDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  } else {
    console.warn(`⚠️ Arquivo não encontrado: ${src}`);
  }
}
console.log('✓ Arquivos estáticos HTML/CSS copiados');

// 6. Bundles com esbuild
const commonConfig = {
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ['chrome120'],
  define: {
    'process.env.NODE_ENV': '"production"',
    '__SUPABASE_URL__': JSON.stringify(supabaseUrl),
    '__SUPABASE_ANON_KEY__': JSON.stringify(supabaseKey),
  },
};

async function buildAll() {
  // a) Background worker (IIFE)
  await esbuild.build({
    ...commonConfig,
    entryPoints: [path.join(srcDir, 'background.ts')],
    outfile: path.join(distDir, 'background.js'),
    format: 'iife',
  });
  console.log('✓ background.js compilado');

  // b) Content script (IIFE)
  await esbuild.build({
    ...commonConfig,
    entryPoints: [path.join(srcDir, 'content.ts')],
    outfile: path.join(distDir, 'content.js'),
    format: 'iife',
  });
  console.log('✓ content.js compilado');

  // c) SidePanel App (React / TSX)
  await esbuild.build({
    ...commonConfig,
    entryPoints: [path.join(srcDir, 'sidepanel.tsx')],
    outfile: path.join(distDir, 'sidepanel.js'),
    format: 'iife',
    jsx: 'automatic',
  });
  console.log('✓ sidepanel.js compilado');

  // d) Options Page (React / TSX)
  await esbuild.build({
    ...commonConfig,
    entryPoints: [path.join(srcDir, 'options.tsx')],
    outfile: path.join(distDir, 'options.js'),
    format: 'iife',
    jsx: 'automatic',
  });
  console.log('✓ options.js compilado');

  console.log('\n🎉 Build da extensão concluído com sucesso em extension/dist/\n');
}

buildAll().catch((err) => {
  console.error('❌ Erro durante o build da extensão:', err);
  process.exit(1);
});
