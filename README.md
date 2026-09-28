# Mama Martina y Antonito

Sitio web del libro **«Relatos, historias y ensueños de Mama Martina y Antonito»** de **Freddy Córdova Ossio** (Potosí, 1943), y hogar del árbol familiar de sus descendientes.

- **Leer el libro** en español y neerlandés (el inglés está en camino), capítulo a capítulo, con las ilustraciones originales y descarga en PDF.
- **El autor**: biografía de Freddy Córdova Ossio, el «Antoñito» del libro.
- **Personajes**: la familia, las figuras históricas y las leyendas de Potosí.
- **Árbol familiar** interactivo: desde los padres de Martina hasta hoy, con botón para agregar personas, fotos e historias.
- **Potosí y lugares**: mapa, datos curiosos y línea de tiempo.

Es un sitio **estático** (HTML + CSS + JavaScript, sin compilación), pensado para **GitHub Pages**.

---

## Publicar en GitHub Pages

1. Crea un repositorio nuevo (por ejemplo `mama-martina`) y sube **todo el contenido de esta carpeta** a la raíz.
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. En uno o dos minutos el sitio estará en `https://TU-USUARIO.github.io/mama-martina/`.

El archivo `.nojekyll` evita que GitHub procese el sitio con Jekyll.

## Verlo en tu computadora

El sitio carga sus datos con `fetch`, así que abrir `index.html` con doble clic no funciona. Desde esta carpeta:

```bash
python3 -m http.server 8000
# y abre http://localhost:8000
```

---

## Estructura

```
index.html            Página única (las secciones se cambian con #/ruta)
css/estilos.css       Estilos (claro y oscuro)
js/i18n.js            Textos de la interfaz en ES / NL / EN
js/app.js             Navegación, lector, autor, personajes, lugares
js/arbol.js           Árbol familiar, formulario y exportación
data/libro-es.json    Libro en español, dividido en capítulos
data/libro-nl.json    Libro en neerlandés
data/familia.json     ÁRBOL FAMILIAR  ← el archivo que más se va a editar
data/personajes.json  Personajes que no son de la familia
data/lugares.json     Lugares (mapa), datos curiosos y línea de tiempo
img/libro/            Ilustraciones del libro
img/familia/          Fotos de la familia (nombre = id de la persona, ej. freddy.jpg)
libros/               PDFs descargables
```

## Cómo crece el árbol familiar

No hay base de datos: el árbol vive en `data/familia.json`.

**Desde el sitio (sin tocar código):**
1. Abre *Árbol familiar* → **Agregar persona**, o haz clic en alguien → *Editar / completar* / *Agregar hijo/a*.
2. Lo que guardes queda como **borrador en tu navegador** (borde dorado punteado).
3. Pulsa **Exportar para GitHub**: se descargan `familia.json` y las fotos nuevas (`id.jpg`).
4. En GitHub, reemplaza `data/familia.json` y sube las fotos a `img/familia/`. Listo.

**Editando el JSON directamente**, cada persona se ve así:

```json
{
  "id": "nombre-apellido",
  "nombre": "Nombre Apellido",
  "apodo": "Cómo le decían",
  "nacimiento": "1970",
  "fallecimiento": "",
  "lugar": "Cochabamba",
  "padres": ["freddy"],
  "pareja": ["id-de-su-pareja"],
  "foto": "img/familia/nombre-apellido.jpg",
  "fuente": "familia",
  "rol": { "es": "…", "nl": "…", "en": "…" },
  "bio": { "es": "…", "nl": "…", "en": "…" }
}
```

- `padres` y `pareja` apuntan a los `id` de otras personas; así se dibujan las ramas.
- `por_confirmar: true` pone un «?» en la tarjeta. Se usó para datos deducidos del libro (por ejemplo, los apellidos de Catalina y Primo, o algunos hermanos) que la familia debe confirmar.
- `capitulos` enlaza a los capítulos del libro donde aparece la persona.
- La tarjeta «Hijos y nietos de Freddy» es un espacio vacío (`placeholder: true`) para empezar la rama actual; se puede borrar cuando haya personas reales.
- Si solo escribes un idioma en `rol` / `bio`, el sitio lo usa para los tres.

## Añadir la edición en inglés

Cuando la traducción esté lista, genera `data/libro-en.json` con la misma estructura que `libro-nl.json` (`chapters` → `id`, `num`, `part`, `title`, `blocks`) y, en `js/app.js`, habilita la edición `en` en el lector (hoy muestra un aviso de «próximamente»).

## Pendientes sugeridos

- Foto del abuelo en `img/familia/freddy.jpg` (la página del autor la usa automáticamente).
- Confirmar nombres y apellidos marcados con «?» en el árbol.
- Revisar y ampliar los datos curiosos de `data/lugares.json` con la familia.
- Portada y texto en inglés.

---

Texto e ilustraciones © Freddy Córdova Ossio. Todos los derechos reservados.
