# RUTINA · Seguimiento

App web progresiva, adaptada a móvil, creada a partir de las pestañas Resumen, Rutina y Registro del Excel. Empieza con las ocho semanas de la hoja y permite añadir o quitar semanas desde el selector.

## Incluye
- Plan con cinco días y las indicaciones de cada ejercicio; el número de semanas es ajustable.
- Añadir ejercicios por día con series, objetivo de repeticiones y detalle técnico; eliminar ejercicios cuando ya no se necesiten.
- Registro por serie de carga, repeticiones y nota; conserva las series opcionales.
- Guardado automático en el navegador del dispositivo.
- Resumen por semana y día, historial de cargas y exportación a CSV.
- Copia y restauración de datos en JSON.
- Instalación en pantalla de inicio y uso sin conexión tras la primera visita, cuando se sirve por HTTPS.

## Abrirla en el móvil
Para instalarla como app y conservar el funcionamiento sin conexión, publica el contenido de esta carpeta en un alojamiento web con HTTPS, por ejemplo GitHub Pages o Netlify. Abre la dirección HTTPS en el móvil y elige Añadir a pantalla de inicio (Safari en iPhone) o Instalar aplicación (Chrome en Android).

También puedes abrir index.html en un navegador de escritorio para verla; desde un archivo local algunas funciones PWA no están disponibles.

## Datos
Los registros se guardan solamente en el almacenamiento local del navegador y no se sincronizan entre dispositivos. Usa Progreso → Descargar copia JSON para respaldar los datos y Restaurar copia en el otro dispositivo. Exportar a CSV crea un archivo que puedes abrir en Excel.

La app no modifica el Excel original.
