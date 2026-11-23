# Etiquetas Naturalezam

Generador de etiquetas para los suplementos de [naturalezam.com](https://naturalezam.com), rediseñadas con la misma esencia visual (color vivo por producto, logo con hojas, tarjeta central) y ajustadas a la regulación sanitaria mexicana. La **tabla nutrimental no va en el diseño**: cada etiqueta trae un recuadro punteado del tamaño reservado para pegarla. Lee **[CUMPLIMIENTO.md](CUMPLIMIENTO.md)** para ver qué se cambió en cada etiqueta y qué falta antes de imprimir.

## Estructura

| Archivo | Qué es |
|---|---|
| `productos.json` | Textos, medidas (mm) y colores de cada etiqueta. Lo que va entre `[[ ]]` es un dato pendiente y se imprime resaltado en magenta. |
| `plantilla.html` | Diseño de la etiqueta: formato `envolvente` (frasco: nutrimental · frente · legal) o `bolsa` (frente + reverso). |
| `generar.mjs` | Genera con Playwright el PowerPoint editable, un PDF de referencia y un PNG de vista previa de cada producto. |
| `editables/` | **Archivos para la imprenta**: un `.pptx` por etiqueta, a tamaño real con 3 mm de sangrado. Los textos son editables, el arte de fondo va como imagen de 480 ppp y hay un recuadro reservado para la tabla nutrimental. |
| `fuentes/` | Tipografías: `woff2` para generar y `ttf/` para instalar en la computadora que abra los PowerPoint (licencia OFL). |
| `salida/` | PDF y PNG de referencia, más `reporte.json` con los pendientes, avisos y la medida del espacio para la tabla. |
| `LEEME-IMPRENTA.txt` | Instrucciones para quien edite e imprima. |

## Uso

```bash
cd etiquetas
npm install            # Playwright, pptxgenjs y sharp (la primera vez también: npx playwright install chromium)
node generar.mjs              # todas las etiquetas
node generar.mjs 03-storm     # solo una
```

El script reduce el texto legal hasta que quepa, sin bajar de 5.5 pt, y avisa si un panel queda por debajo de 6 pt o no cabe.

## Para agregar otro producto

Copia uno de los objetos de `productos.json`, cambia `id`, medidas, `tema` (colores y `motivo`: hojas, cristales, diana, pez, rayo, loto, gota, burbujas, orbitas, molecula, alga o luna) y los textos. Luego corre `node generar.mjs`.
