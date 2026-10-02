# Riot Pursuit · Actualizaciones oficiales

[Abrir la app](https://www.riotpursuit.com/movil) · [Descargar la última versión](https://github.com/ZalkionFX/riotpursuit-updates/releases/latest)

Paquetes oficiales para Android, separados por arquitectura: **arm64-v8a** para teléfonos de 64 bits, **armeabi-v7a** para ARM de 32 bits y **x86_64** para dispositivos y emuladores x86 de 64 bits.

La app consulta las versiones al abrirse y al volver al primer plano. Descarga el paquete de su arquitectura, muestra el progreso real, verifica SHA-256 y la firma oficial, y abre el instalador de Android. Android requiere confirmar la instalación y puede pedir permitir actualizaciones desde Riot Pursuit.

Las instalaciones anteriores a **2.0.2** necesitan instalar esta versión una vez para incorporar el actualizador. La sesión y los datos se conservan al actualizar con el mismo paquete y firma.

## Estable y beta

- **Estable:** versiones publicadas para todos los miembros.
- **Beta:** pruebas únicamente para quienes activan Beta en «Más opciones → Actualizar app». Si no hay una beta más reciente, reciben la última estable.
- Al salir de Beta, Android conserva la versión instalada hasta que una estable tenga un versionCode superior. No se fuerzan degradaciones.

La interfaz web se actualiza cuando se publica una versión estable del sitio. Las pruebas web se realizan en el entorno de pruebas antes de publicarlas. No hace falta descargar otro APK para cambios en la interfaz web.

## Publicar una versión

1. En el proyecto privado, incrementar la versión y el número de compilación, y ejecutar `flutter build apk --release --split-per-abi` con la clave oficial.
2. Ejecutar `node scripts/prepare-mobile-release.mjs --channel stable --out RUTA_ABSOLUTA --tag v2.0.3`. Para pruebas, usar `--channel beta` y un tag beta.
3. Crear una Release con el mismo tag y adjuntar los tres APK, `manifest.json` y `SHA256SUMS.txt` **antes de publicarla**. Marcar «Pre-release» únicamente para beta.
4. Publicar la Release. La acción «Publicar canal de actualización» verifica los paquetes y actualiza automáticamente `channels/stable.json` o `channels/beta.json`. La web y las apps consultan esos manifiestos.

Si falla la validación, el canal anterior sigue disponible. Se puede reintentar la acción manualmente indicando el tag. Nunca publicar claves de firma, contraseñas, datos de miembros o el código privado en este repositorio.

Certificado oficial SHA-256: `d6ec0e23e0b9d82c69e812708d479d8741fc2b3168c76d9e41a2fb6312af412d`.
