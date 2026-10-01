# Buzón de aportes: configuración (unos 15 minutos, una sola vez)

La familia llena el formulario del sitio **sin necesitar cuenta**. El buzón (un pequeño programa gratuito en Cloudflare) convierte cada envío en una **propuesta** (*pull request*) en tu repositorio de GitHub. Tú la revisas y:

- **Merge pull request** → se aprueba y se publica sola en 1–2 minutos.
- **Close pull request** → se rechaza y no se publica nada.

GitHub te avisa por correo de cada propuesta nueva.

```
Familiar ──formulario──▶ Buzón (Cloudflare) ──▶ Propuesta en GitHub ──tú apruebas──▶ Sitio actualizado
```

---

## 1. Crear un token de GitHub (la «llave» del buzón)

1. GitHub → tu foto → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Nombre: `buzon-mama-martina`. Caducidad: 1 año (pon un recordatorio para renovarlo).
3. **Repository access** → *Only select repositories* → elige el repositorio del sitio.
4. **Permissions → Repository permissions**:
   - **Contents**: Read and write
   - **Pull requests**: Read and write
5. **Generate token** y copia el texto que empieza con `github_pat_…` (solo se muestra una vez).

## 2. Crear el buzón en Cloudflare

1. Crea una cuenta gratuita en <https://dash.cloudflare.com/sign-up>.
2. **Workers & Pages** → **Create** → **Create Worker** → nombre `buzon-mama-martina` → **Deploy**.
3. **Edit code**: borra todo, pega el contenido de `worker/aportes.js` y pulsa **Deploy**.
4. En el Worker → **Settings** → **Variables and Secrets** → agrega:

| Nombre | Tipo | Valor |
|---|---|---|
| `GITHUB_TOKEN` | Secret | el token `github_pat_…` |
| `REPOSITORIO` | Text | `tu-usuario/tu-repositorio` |
| `ORIGEN_PERMITIDO` | Text | `https://tu-usuario.github.io` (sin barra al final) |

5. Copia la dirección del Worker (algo como `https://buzon-mama-martina.tu-nombre.workers.dev`).

## 3. Conectar el sitio con el buzón

En `js/config.js`:

```js
endpointAportes: "https://buzon-mama-martina.tu-nombre.workers.dev",
repositorio: "tu-usuario/tu-repositorio",
contacto: "tu correo o WhatsApp",
```

Sube el cambio a GitHub. Listo: prueba el formulario en *Aportar* y deberías ver la propuesta en la pestaña **Pull requests** del repositorio.

## 4. (Opcional) Antispam con Turnstile

Si algún día llegan envíos basura: Cloudflare → **Turnstile** → *Add widget* con el dominio `tu-usuario.github.io`.
- La **Site key** va en `js/config.js` → `turnstileSiteKey`.
- La **Secret key** va en el Worker como secreto `TURNSTILE_SECRET`.

El formulario ya trae una trampa sencilla para robots, así que al principio no hace falta.

## Límites y costos

El plan gratuito de Cloudflare Workers permite muchísimos más envíos de los que una familia hará. Cada foto se reduce en el navegador antes de enviarse (máx. ~900 px).

## Si algo falla

- *«No se pudo guardar el aporte»*: revisa que el token no haya caducado y que tenga los dos permisos.
- *«Origen no permitido»*: `ORIGEN_PERMITIDO` debe ser exactamente la dirección del sitio, sin `/` final y sin la carpeta del repositorio.
- En la propuesta aparece un ✖ rojo: la revisión automática encontró un error en el archivo (por ejemplo, un padre que no existe). Ábrela para ver el detalle, corrígelo con *Edit file* y vuelve a intentarlo.
