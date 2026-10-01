# Mama Martina y Antonito

Sitio web del libro **«Relatos, historias y ensueños de Mama Martina y Antonito»** de **Freddy Córdova Ossio** (Potosí, 1943), y hogar de la memoria de su familia.

- **Leer el libro** en español, neerlandés e inglés, con las ilustraciones originales y los PDF descargables.
- **Árbol familiar** con dos vistas:
  - *Árbol del libro*: solo las personas del libro (`data/familia.json`).
  - *Familia hoy*: el árbol completo del libro **más** quienes no salen en él (marcados con 🌱).
  - En ambas se puede **editar** cualquier tarjeta y **agregar** hijos o parejas directamente en el árbol. Los cambios se ven al instante en el navegador de quien los hace (⏳) y se publican para todos cuando se aprueban. Una corrección a una persona del libro llega como propuesta que modifica `data/familia.json`; así el árbol del libro solo cambia con tu aprobación.
- **Aportar**: la familia envía personas, fotos, lugares y recuerdos **sin cuenta**. Nada se publica hasta que la administradora lo aprueba.
- **Álbum**, **Personajes**, **Potosí y lugares** (mapa, datos curiosos, línea de tiempo), **El autor**, **Privacidad y aviso legal**.

Es un sitio estático (HTML + CSS + JavaScript), publicado gratis en **GitHub Pages**.

---

## 1. Publicar en GitHub Pages

1. Crea un repositorio **público** (por ejemplo `mama-martina`) y sube **todo el contenido de esta carpeta**, incluidas las carpetas ocultas `.github/` y el archivo `.nojekyll`.
2. En GitHub: **Settings → Pages → Build and deployment → Source: *GitHub Actions***. (Importante: *no* «Deploy from a branch».)
3. Ve a la pestaña **Actions**: verás «Publicar sitio» corriendo. Al terminar, el sitio queda en `https://TU-USUARIO.github.io/mama-martina/`.

Cada vez que cambia la rama `main` (por ejemplo, al aprobar un aporte) el sitio se vuelve a publicar solo, en 1–2 minutos.

## 2. Activar el buzón de aportes

Sigue **`worker/LEEME.md`** (unos 15 minutos, una sola vez): creas un token en GitHub, un Worker gratuito en Cloudflare y pegas su dirección en `js/config.js`.

### Cómo funciona

```
Familiar llena el formulario ─▶ Buzón (Cloudflare) ─▶ Propuesta (pull request) en GitHub
                                                            │
                          tú pulsas «Merge» (aprobar) ◀─────┘  o «Close» (rechazar)
                                     │
                                     ▼
                 GitHub Actions junta los aportes y publica el sitio
```

- Cada aporte es un archivo propio en `data/aportes/<tipo>/` (y su foto en `img/aportes/`). Así dos aportes nunca se pisan.
- Antes de aprobar, una revisión automática comprueba que el archivo esté bien (✔ verde en la propuesta).
- Puedes corregir un aporte antes de aprobarlo: en la propuesta, *Files changed* → «…» → *Edit file*.
- GitHub te avisa por correo de cada propuesta. En el sitio, el pie de página y el árbol muestran un enlace de **Administración** a la lista de propuestas pendientes.
- Mientras el buzón no esté configurado, lo que se agrega o edita queda guardado en ese navegador (se ve en el árbol con ⏳). Cuando actives el buzón, aparece un botón «Enviar para aprobación» en el Árbol familiar que manda todo lo guardado. También se puede descargar como archivo.

## 3. Configuración (`js/config.js`)

| Campo | Para qué |
|---|---|
| `endpointAportes` | Dirección del Worker (buzón). |
| `repositorio` | `usuario/repositorio`, para el enlace de Administración. |
| `contacto` | Correo o WhatsApp para pedir cambios o retirar información (aparece en Privacidad). |
| `turnstileSiteKey` | Opcional, antispam de Cloudflare. |

---

## Estructura

```
index.html                 Página única (las secciones cambian con #/ruta)
404.html, robots.txt       Página de error y permiso para buscadores
css/estilos.css            Estilos (claro y oscuro)
js/config.js               ← CONFIGURACIÓN
js/i18n.js                 Textos de la interfaz (ES / NL / EN)
js/app.js                  Navegación, lector, autor, personajes, lugares
js/arbol.js                Árbol del libro y Familia hoy
js/aportes.js              Formulario de aportes, álbum, privacidad
data/libro-es|nl|en.json   El libro en tres idiomas
data/familia.json          Árbol DEL LIBRO (no mezclar con aportes)
data/personajes.json       Personajes que no son de la familia
data/lugares.json          Lugares del libro, datos curiosos, línea de tiempo
data/aportes/…             Aportes aprobados, un archivo por aporte
data/aportes.json          Se genera solo al publicar (no editar a mano)
img/libro/                 Ilustraciones del libro
img/aportes/               Fotos aportadas por la familia
img/familia/freddy.jpg     (añádela) foto del abuelo para la página del autor
libros/                    PDFs: español, neerlandés, inglés
scripts/                   Juntar aportes y preparar fuentes/mapa (los usa GitHub)
worker/                    Buzón de aportes para Cloudflare + instrucciones
.github/workflows/         Publicación automática y revisión de propuestas
```

## Verlo en tu computadora

```bash
node scripts/compilar-aportes.mjs      # junta los aportes
bash scripts/preparar-recursos.sh      # (opcional) fuentes y mapa locales; necesita npm e internet
python3 -m http.server 8000            # y abre http://localhost:8000
```

Sin el segundo paso el sitio funciona igual, con tipografías del sistema y sin mapa.

---

## Privacidad y requisitos de un sitio público

Ya está resuelto en el sitio:

- **Cookies**: el sitio **no usa cookies, ni analítica, ni publicidad**, así que no necesita banner de cookies. Solo guarda preferencias en el propio navegador (idioma, tema, etc.), lo que se considera estrictamente necesario.
- **Sin servicios externos al cargar**: las fuentes y el código del mapa se sirven desde el propio sitio (sin Google Fonts). El mapa de OpenStreetMap solo se carga si la persona pulsa «Cargar mapa».
- **Página de Privacidad y aviso legal** en tres idiomas: quién administra, qué datos se guardan, servicios de terceros, derechos de autor y cómo pedir que se retire información.
- **Aportes con consentimiento**: casilla obligatoria. De personas vivas se pide solo el año. Todo pasa por aprobación.
- **HTTPS** automático con GitHub Pages, página 404, `robots.txt`, diseño adaptable a celular y modo oscuro.

Recomendaciones:

- Completa `contacto` en `js/config.js` para que cualquiera pueda pedir correcciones o retiros.
- Antes de aprobar datos de personas vivas, confirma que estén de acuerdo; retira lo que te pidan.
- Parte de la familia vive en Países Bajos, donde rige el RGPD europeo: lo anterior (consentimiento, mínimo de datos, derecho a retiro) es justamente lo que pide. *No es asesoría legal.*
- Si algún día quieren estadísticas de visitas, usen una herramienta sin cookies (por ejemplo GoatCounter o Plausible) y mencionen su uso en la página de Privacidad.
- Si compran un dominio propio más adelante: **Settings → Pages → Custom domain** y siguen las instrucciones de DNS de GitHub.

## Pendientes sugeridos

- Foto del abuelo en `img/familia/freddy.jpg`.
- Confirmar los datos marcados con «?» en el árbol del libro (apellidos de Catalina y Primo, algunos hermanos).
- Revisar la traducción al inglés con la familia (ver notas de traducción en la entrega).

---

Texto e ilustraciones © Freddy Córdova Ossio. Todos los derechos reservados.
