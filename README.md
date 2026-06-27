# Blockout 3D 🧊

Clon jugable del clásico **Blockout** (1989, California Dreams): el Tetris en
**tres dimensiones**. Mirás dentro de un pozo rectangular y vas encajando los
*policubos* que caen. Cuando una **capa** (un *face*) se llena por completo sin
huecos, desaparece y todo lo de arriba cae. La partida termina cuando una pieza
nueva ya no entra por la boca del pozo.

Está hecho con HTML + CSS + JavaScript y render 3D real con
[Three.js](https://threejs.org/). No necesita instalación.

## Cómo jugar

Abrí `index.html` en cualquier navegador moderno (con conexión a internet la
primera vez, para cargar Three.js desde el CDN). Elegí el **tamaño del pozo** y
el **set de piezas** y tocá **JUGAR**.

### Controles

| Acción | Tecla |
| --- | --- |
| Mover la pieza en el plano | **Flechas** o **WASD** |
| Rotar sobre el eje X / Y / Z | **Q** / **E** / **R** |
| Caída rápida (soft drop) | **Shift** |
| Soltar de golpe (hard drop) | **Espacio** |
| Pausa | **P** |
| Girar la cámara | **arrastrar con el ratón** |

En móviles/tablet aparecen botones táctiles en pantalla.

### Ayudas de profundidad

Como en el original, leer la profundidad es clave. Para ayudar:

- Un **fantasma translúcido** muestra dónde aterrizaría la pieza si la soltás.
- Una **sombra en el suelo** marca la columna que ocupa.
- El pozo tiene **anillos por nivel** y rejilla en el suelo.

## Sets de piezas (fiel al original)

- **Flat Blocks** — poliominós con grosor 1 (se excluye el recto de 4 en línea).
- **Basic Blocks** — las 7 piezas del cubo Soma (tricubos y tetracubos).
- **Extended** — planas + Soma + una selección de tetracubos y pentacubos 3D.

## Tamaños de pozo

Desde `3 × 3 × 10` (3D Mania) hasta `7 × 7 × 18` (máximo), incluyendo el
clásico `5 × 5 × 12` y `5 × 5 × 10` (Out of Control).

## Puntuación

- Pequeño premio por colocar cada pieza.
- Bonus **exponencial** por limpiar varias capas con una sola pieza.
- Bonus **“Block Out”** por dejar el pozo completamente vacío.
- El **nivel** sube cada 10 capas y acelera la caída.

## Archivos

- `index.html` — estructura y HUD.
- `styles.css` — estilos (tema neón oscuro).
- `blockout.js` — lógica del juego y render 3D.

---

Basado en *Blockout*, desarrollado por Aleksander Ustaszewski y Mirosław
Zabłocki, publicado por California Dreams en 1989. Este es un homenaje/clon
educativo, sin afiliación con los autores originales.
