// Genera las etiquetas Naturalezam a tamaño real.
//   node generar.mjs              -> todas
//   node generar.mjs 03-storm     -> solo las que contengan ese texto en su id
//   node generar.mjs --guias      -> PNG con líneas de pliegue entre paneles
// Salida: salida/<id>.pdf (vector, mm reales), salida/<id>.png (vista previa) y salida/reporte.json
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// require() para usar el Playwright instalado (local en node_modules o global)
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const guias = args.includes('--guias');
const filtro = args.find(a => !a.startsWith('--'));

const { comun, productos } = JSON.parse(await readFile(path.join(dir, 'productos.json'), 'utf8'));
const lista = productos.filter(p => !filtro || p.id.includes(filtro));
const salida = path.join(dir, 'salida');
await mkdir(salida, { recursive: true });

const FUENTES = ["'Alfa Slab One'", "'Bebas Neue'", "'Lobster Two'", "'Oswald'", "'Playfair Display'", "'Roboto Condensed'"];
const MM = 96 / 25.4;

const navegador = await chromium.launch();
const reporte = [];
for (const producto of lista) {
  const pagina = await navegador.newPage({
    viewport: { width: Math.ceil(producto.ancho * MM), height: Math.ceil(producto.alto * MM) },
    deviceScaleFactor: 3,   // vista previa a ~290 ppp; el PDF es vectorial
  });
  await pagina.addInitScript(d => { window.__DATOS = d; }, { comun, producto, guias });
  await pagina.goto(pathToFileURL(path.join(dir, 'plantilla.html')).href);
  const r = await pagina.evaluate(async (fuentes) => {
    await Promise.all(fuentes.flatMap(f => [`10pt ${f}`, `italic 700 10pt ${f}`, `italic 900 10pt ${f}`, `700 10pt ${f}`, `800 10pt ${f}`].map(s => document.fonts.load(s))));
    await document.fonts.ready;
    return window.__renderizar();
  }, FUENTES);

  const etiqueta = pagina.locator('.etiqueta');
  await etiqueta.screenshot({ path: path.join(salida, `${producto.id}.png`) });
  if (!guias) {
    await pagina.pdf({
      path: path.join(salida, `${producto.id}.pdf`),
      width: `${producto.ancho}mm`, height: `${producto.alto}mm`,
      printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1',
    });
  }
  await pagina.close();
  reporte.push({ id: producto.id, medida_mm: `${producto.ancho} x ${producto.alto}`, formato: producto.formato, ...r });
  console.log(`${producto.id.padEnd(26)} ${String(r.pendientes).padStart(3)} pendientes  ${r.avisos.join(' | ')}`);
}
await navegador.close();
if (!filtro && !guias) await writeFile(path.join(salida, 'reporte.json'), JSON.stringify(reporte, null, 2) + '\n');
