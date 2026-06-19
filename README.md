# Memo Test ⭐ Selección Argentina

Juego de memoria (Memotest) **visual y jugable** con **20 pares** (40 cartas) de
las caras de los jugadores de la Selección Argentina.

## Cómo jugar

1. Abrí `index.html` en cualquier navegador (doble clic).
2. Tocá dos cartas para darlas vuelta. Si las caras coinciden, el par queda
   descubierto. Si no, se vuelven a dar vuelta.
3. Encontrá los 20 pares en la menor cantidad de movimientos y tiempo posible.

Tenés contador de **pares**, **movimientos** y **cronómetro**, y un botón de
**Reiniciar** que baraja el tablero de nuevo.

## Las caras de los jugadores

Para mostrar las fotos reales de cada jugador, el juego pide la foto de portada
de cada uno a la **API pública de Wikipedia** al cargar (no hace falta descargar
imágenes ni configurar nada). Por eso, la **primera carga necesita conexión a
internet**.

Si alguna foto no estuviera disponible, esa carta muestra automáticamente un
respaldo con el ⚽ y el nombre del jugador, así el juego siempre es jugable.

El plantel se define en `players.js`; podés editar nombres, números o el título
de Wikipedia (`wiki`) de cada jugador.

## Archivos

- `index.html` — estructura de la página.
- `styles.css` — estilos (tema celeste y blanco).
- `players.js` — los 20 jugadores.
- `game.js` — lógica del juego y carga de las caras.
