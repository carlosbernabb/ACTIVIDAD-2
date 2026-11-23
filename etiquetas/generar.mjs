// Genera las etiquetas Naturalezam a tamaño real.
//   node generar.mjs              -> todas
//   node generar.mjs 03-storm     -> solo las que contengan ese texto en su id
// Salida por producto:
//   editables/<id>.pptx   PowerPoint editable: arte de fondo (480 ppp) + textos editables + recuadro de la tabla
//   salida/<id>.pdf       prueba de color a tamaño real (sin sangrado)
//   salida/<id>.png       vista previa
//   salida/reporte.json   pendientes, avisos y medida del espacio para la tabla nutrimental
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PptxGenJS = require('pptxgenjs');
const sharp = require('sharp');
const JSZip = require('jszip');   // viene con pptxgenjs

const dir = path.dirname(fileURLToPath(import.meta.url));
const filtro = process.argv.slice(2).find(a => !a.startsWith('--'));
const { comun, productos } = JSON.parse(await readFile(path.join(dir, 'productos.json'), 'utf8'));
const lista = productos.filter(p => !filtro || p.id.includes(filtro));
const [salida, editables] = ['salida', 'editables'].map(d => path.join(dir, d));
await mkdir(salida, { recursive: true });
await mkdir(editables, { recursive: true });

const SANGRADO = 3;                 // mm por lado
const ESCALA = 5;                   // 96 ppp × 5 = 480 ppp para el arte de fondo
const PX_MM = 96 / 25.4;
const pulg = mm => mm / 25.4;
const FUENTES = ["'Alfa Slab One'", "'Bebas Neue'", "'Lobster Two'", "'Oswald'", "'Playfair Display'", "'Roboto Condensed'"];

// Nombre de cada fuente tal como la ve PowerPoint (familia de los TTF en fuentes/ttf)
function fuente(familia, peso, italica) {
  switch (familia) {
    case 'Alfa Slab One': return { fontFace: 'Alfa Slab One', bold: false, italic: false };
    case 'Bebas Neue': return { fontFace: 'Bebas Neue', bold: false, italic: false };
    case 'Lobster Two': return { fontFace: 'Lobster Two', bold: true, italic: true };
    case 'Oswald': return peso >= 600 ? { fontFace: 'Oswald', bold: true, italic: false } : { fontFace: 'Oswald Medium', bold: false, italic: false };
    case 'Playfair Display': return { fontFace: 'Playfair Display Black', bold: false, italic: true };
    default: return peso >= 800 ? { fontFace: 'Roboto Condensed ExtraBold', bold: false, italic: italica }
      : { fontFace: 'Roboto Condensed', bold: peso >= 600, italic: italica };
  }
}

// "rgb(r, g, b) 1.3px 1.3px 0px" -> { color, dx, dy } en mm
function sombra(css) {
  const m = css && css.match(/rgba?\(([^)]+)\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px/);
  if (!m) return null;
  const color = m[1].split(',').slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('').toUpperCase();
  return { color, dx: +m[2] / PX_MM, dy: +m[3] / PX_MM };
}

function tramosPptx(bloque, colorForzado) {
  const salida = [];
  for (const t of bloque.tramos) {
    if (t.salto) { if (salida.length) salida[salida.length - 1].options.breakLine = true; continue; }
    const enRecuadro = String(bloque.clase).includes('leyendas');
    salida.push({ text: t.texto, options: {
      ...fuente(t.familia, t.peso, t.italica), fontSize: +(t.pt * (enRecuadro ? .95 : 1)).toFixed(2), color: colorForzado || (t.pendiente ? 'C2006B' : t.color),
      ...(t.espaciado ? { charSpacing: t.espaciado } : {}),
      ...(t.pendiente && !colorForzado ? { highlight: 'FFE0F2', bold: true } : {}),
    } });
  }
  return salida;
}

function agregarTexto(slide, b, extra = {}) {
  const { dx = 0, dy = 0, color, contorno } = extra;
  // holgura: PowerPoint mide el texto un poco distinto que el navegador
  // (en el recuadro de leyendas no hay holgura: el texto no debe tocar el borde)
  const enRecuadro = String(b.clase).includes('leyendas');
  const holgura = b.unaLinea ? b.w * .12 : enRecuadro ? 0 : b.w * .03;
  let x = b.x + SANGRADO + dx, w = b.w + holgura;
  if (b.alinear === 'center') x -= holgura / 2; else if (b.alinear === 'right') x -= holgura;
  slide.addText(tramosPptx(b, color), {
    x: pulg(x), y: pulg(b.y + SANGRADO + dy), w: pulg(w), h: pulg(b.h + .6),
    margin: 0, valign: b.centrarV ? 'middle' : 'top', align: b.alinear, wrap: !b.unaLinea, fit: 'none',
    lineSpacing: b.interlineado, paraSpaceBefore: 0, paraSpaceAfter: 0, isTextBox: true,
    ...(b.rotacion ? { rotate: b.rotacion } : {}),
    ...(contorno ? { outline: { size: contorno.mm * 72 / 25.4, color: contorno.color } } : {}),
    objectName: (color ? 'Sombra ' : 'Texto ') + String(b.clase).split(' ')[0],
  });
}

const navegador = await chromium.launch();
const reporte = [];
for (const producto of lista) {
  const pagina = await navegador.newPage({
    viewport: { width: Math.ceil(producto.ancho * PX_MM), height: Math.ceil(producto.alto * PX_MM) },
    deviceScaleFactor: ESCALA,
  });
  await pagina.addInitScript(d => { window.__DATOS = d; }, { comun, producto, guias: false });
  await pagina.goto(pathToFileURL(path.join(dir, 'plantilla.html')).href);
  const r = await pagina.evaluate(async (fuentes) => {
    await Promise.all(fuentes.flatMap(f => [`10pt ${f}`, `italic 700 10pt ${f}`, `italic 900 10pt ${f}`, `700 10pt ${f}`, `800 10pt ${f}`].map(s => document.fonts.load(s))));
    await document.fonts.ready;
    return window.__renderizar();
  }, FUENTES);
  const etiqueta = pagina.locator('.etiqueta');

  // 1) Vista previa y prueba en PDF
  const completa = await etiqueta.screenshot();
  await sharp(completa).resize({ width: Math.round(producto.ancho * PX_MM * 3) }).png().toFile(path.join(salida, `${producto.id}.png`));
  await pagina.pdf({ path: path.join(salida, `${producto.id}.pdf`), width: `${producto.ancho}mm`, height: `${producto.alto}mm`,
    printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1' });

  // 2) Textos y arte de fondo por separado
  const datos = await pagina.evaluate(() => window.__extraer());
  await pagina.evaluate(() => document.body.classList.add('solo-fondo'));
  const fondo = await etiqueta.screenshot();
  const px = Math.round(SANGRADO * PX_MM * ESCALA);
  const fondoConSangrado = await sharp(fondo).extend({ top: px, bottom: px, left: px, right: px, extendWith: 'copy' }).png().toBuffer();
  await pagina.close();

  // 3) PowerPoint editable a tamaño real + sangrado
  const pres = new PptxGenJS();
  const W = producto.ancho + 2 * SANGRADO, H = producto.alto + 2 * SANGRADO;
  pres.defineLayout({ name: 'ETIQUETA', width: pulg(W), height: pulg(H) });
  pres.layout = 'ETIQUETA';
  pres.title = `Etiqueta ${producto.nombre} - Naturalezam`;
  pres.author = 'Naturalezam';
  const slide = pres.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addImage({ data: 'image/png;base64,' + fondoConSangrado.toString('base64'), x: 0, y: 0, w: pulg(W), h: pulg(H),
    altText: `Arte de fondo de la etiqueta ${producto.nombre}`, objectName: 'Arte de fondo' });

  const e = datos.espacioTabla;
  slide.addText([
    { text: 'ESPACIO PARA TABLA NUTRIMENTAL', options: { bold: true, breakLine: true } },
    { text: `${e.medida} · reemplaza este recuadro por la tabla` },
  ], { shape: pres.shapes.RECTANGLE, x: pulg(e.x + SANGRADO), y: pulg(e.y + SANGRADO), w: pulg(e.w), h: pulg(e.h),
    fill: { color: 'FFFFFF' }, line: { color: e.tinta, width: .75, dashType: 'dash' },
    fontFace: 'Roboto Condensed', fontSize: 7, color: e.tinta, align: 'center', valign: 'middle', margin: 2,
    objectName: 'Espacio tabla nutrimental' });

  for (const b of datos.bloques) {
    const s = sombra(b.sombra);
    if (s) agregarTexto(slide, b, { dx: s.dx, dy: s.dy, color: s.color, contorno: b.contorno });
    agregarTexto(slide, b, { contorno: b.contorno });
  }

  slide.addNotes([
    `Etiqueta: ${producto.nombre} (${producto.id})`,
    `Medida final (corte): ${producto.ancho} × ${producto.alto} mm. La diapositiva mide ${W} × ${H} mm porque incluye ${SANGRADO} mm de sangrado por lado: el corte va ${SANGRADO} mm hacia adentro de cada borde.`,
    `Espacio para la tabla nutrimental: ${e.medida}. Reemplaza el recuadro punteado por la tabla.`,
    'Los textos en magenta con fondo rosa son datos pendientes: complétalos y cámbialos al color del texto que los rodea antes de imprimir.',
    'Fuentes: instala las de la carpeta "fuentes" antes de abrir el archivo (Alfa Slab One, Bebas Neue, Lobster Two, Oswald, Playfair Display, Roboto Condensed).',
    'Para imprenta: Archivo > Exportar > PDF, calidad máxima.',
  ].join('\n'));
  // Sin entradas de carpeta en el ZIP: algunos servicios en la nube (OneDrive, Drive) fallan al abrirlas
  const original = await JSZip.loadAsync(await pres.write({ outputType: 'nodebuffer' }));
  const limpio = new JSZip();
  for (const [nombre, f] of Object.entries(original.files)) {
    if (!f.dir) limpio.file(nombre, await f.async('nodebuffer'), { createFolders: false });
  }
  await writeFile(path.join(editables, `${producto.id}.pptx`),
    await limpio.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }));

  reporte.push({ id: producto.id, medida_mm: `${producto.ancho} x ${producto.alto}`, formato: producto.formato, ...r });
  console.log(`${producto.id.padEnd(26)} ${String(r.pendientes).padStart(3)} pendientes  tabla ${r.espacioTabla.padEnd(14)} ${r.avisos.join(' | ')}`);
}
await navegador.close();
if (!filtro) await writeFile(path.join(salida, 'reporte.json'), JSON.stringify(reporte, null, 2) + '\n');
