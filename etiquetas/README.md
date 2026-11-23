# Etiquetas Naturalezam

Generador de etiquetas para los suplementos de [naturalezam.com](https://naturalezam.com), rediseñadas con la misma esencia visual (color vivo por producto, logo con hojas, tarjeta central) y ajustadas a la regulación sanitaria mexicana. Lee **[CUMPLIMIENTO.md](CUMPLIMIENTO.md)** para ver qué se cambió en cada etiqueta y qué falta antes de imprimir.

## Estructura

| Archivo | Qué es |
|---|---|
| `productos.json` | Textos, medidas (mm) y colores de cada etiqueta. Lo que va entre `[[ ]]` es un dato pendiente y se imprime resaltado en magenta. |
| `plantilla.html` | Diseño de la etiqueta: formato `envolvente` (frasco: nutrimental · frente · legal) o `bolsa` (frente + reverso). |
| `generar.mjs` | Genera con Playwright un PDF vectorial a tamaño real y un PNG de vista previa por producto. |
| `fuentes/` | Tipografías locales (Google Fonts, licencia OFL). |
| `salida/` | PDF y PNG generados, más `reporte.json` con los pendientes y avisos de legibilidad. |

## Uso

```bash
cd etiquetas
npm install            # instala Playwright (la primera vez también: npx playwright install chromium)
node generar.mjs              # todas las etiquetas
node generar.mjs 03-storm     # solo una
node generar.mjs --guias      # PNG con líneas de pliegue entre paneles
```

El script reduce el texto legal hasta que quepa, sin bajar de 5.5 pt, y avisa si un panel queda por debajo de 6 pt o no cabe.

## Para agregar otro producto

Copia uno de los objetos de `productos.json`, cambia `id`, medidas, `tema` (colores y `motivo`: hojas, cristales, diana, pez, rayo, loto, gota, burbujas, orbitas, molecula, alga o luna) y los textos. Luego corre `node generar.mjs`.
