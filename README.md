# Altum-Lumen-S.A.C.
Altum Lumen es un ecosistema de servicios integrales: impulsa proyectos con visión desde la idea hasta la ejecución; fortalece educación con posgrado y actualización; y brinda respaldo legal y contable a personas, empresas e instituciones públicas y privadas, para que crezcan con seguridad y resultados. Somos Altum Lumen, excelencia que transforma.

## Publicaciones y directorio

El Portal de Transparencia y el Directorio se generan a partir de `data/publicaciones.json` y `data/directorio.json`. Registra allí solo los datos y PDF destinados a publicación. `issuedOn` es la fecha del acto y `publishedAt` la fecha de incorporación al repositorio público, con zona horaria.

El contenido de la portada y las páginas corporativas está en `scripts/portal-pages.cjs`. Ejecuta `node scripts/build-institucional.cjs` para regenerar el portal, el catálogo, el directorio y los actos recientes de la portada. Ejecuta `node scripts/build-institucional.cjs --check` antes de subir los cambios a GitHub Pages.
