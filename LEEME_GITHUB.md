# Reemplazo puntual en GitHub

Repositorio: `altumlumen-design/Altum-Lumen-S.A.C.`.

Reemplace únicamente `verificacion.html` por el archivo de esta carpeta, después de actualizar el despliegue del SGD conservando la URL `/exec` actual. No reemplace `transparencia.html`, `sitemap.xml`, imágenes ni otros archivos del portal.

El código consulta el SGD mediante JSONP. La consulta es pública y devuelve exclusivamente la lista de datos de emisión autorizada. No se publican PDFs, enlaces de Drive, DNI, certificados privados, contraseñas ni listados completos.

No cree un despliegue nuevo con otra URL: actualice la versión del despliegue existente. Si decide cambiar la URL, cambie también la constante ENDPOINT en verificacion.html.

Verifique tras publicar: código inexistente, código emitido, código anulado (sin resultados), borrador (sin resultados) y desconexión temporal. Solo una versión vigente emitida puede arrojar resultados. Una consulta por código no compara los bytes de un PDF presentado por un tercero.
