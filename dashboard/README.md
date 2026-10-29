# dashboard/: tablero de Power BI (trabajo previo)

Esta carpeta guarda la **primera versión del tablero**, hecha en Power BI Desktop.
Fue reemplazada por el sitio web de [`web/`](../web/) (publicado en
https://ifylopez.github.io/practica-imond/web/), que usa los mismos marts y la misma
lógica. Se conserva como registro del trabajo y para poder comparar las dos versiones.

| Archivo | Tipo | Para qué sirve |
|---|---|---|
| `ecobottle.pbix` | **Binario** (proyecto de Power BI Desktop) | El tablero: consultas, relaciones, medidas DAX y visuales |
| `ecobottle_tema.json` | Texto (JSON) | Tema de colores y tipografías que se importa en Power BI |
| `tablero.png` | **Binario** (imagen PNG) | Captura del tablero para verlo sin abrir Power BI |

## Qué es un `.pbix` y por qué es binario

Un `.pbix` es un archivo comprimido (internamente es un ZIP) que guarda el modelo de
datos, el diseño de las páginas y una copia de los datos importados. No es texto, así
que:

- **Git no puede mostrar diferencias.** `git diff` solo dice "Binary files differ":
  no se ve qué medida o qué visual cambió.
- **No se pueden combinar cambios.** Si dos personas modifican el `.pbix` en ramas
  distintas, Git no puede mezclarlos; hay que elegir una de las dos versiones.
- **Cada versión se guarda entera.** Cada commit que lo modifica agrega el archivo
  completo al historial, que crece aunque el cambio sea mínimo.

Por eso el `.pbix` se considera trabajo terminado y **no se sigue editando**. Toda la
lógica que importa (cálculos, granos, filtros) está en SQL (`sql/`), que sí es texto y
se puede revisar línea por línea.

En [`.gitattributes`](../.gitattributes) los `.pbix` y las imágenes están marcados
como `binary`: Git no intenta convertir finales de línea ni calcular diferencias de
texto sobre ellos, y así no los corrompe.

## Qué pasa al clonar el repositorio

- El `.pbix` (unos 130 KB) se descarga completo junto con el resto del repo. No hace
  falta Power BI para nada más: el ETL y el sitio web funcionan sin él.
- Para abrirlo se necesita **Power BI Desktop** (gratis, solo para Windows). En Mac o
  Linux no se puede abrir; para ver el tablero alcanza con `tablero.png` o con el
  sitio web.
- El `.pbix` lee los CSV de `dw/` desde la ruta de la computadora donde se armó. En
  otra computadora, Power BI va a pedir actualizar la ruta: **Transformar datos →
  Configuración de origen de datos → Cambiar origen** y apuntar a la carpeta `dw/`
  del clon.

## Cómo actualizarlo si se regeneran los datos

1. Correr `python run_sql.py` en la raíz del repo (regenera `dw/*.csv`).
2. Abrir `ecobottle.pbix` y usar **Inicio → Actualizar**.
3. Con Power BI en español, la configuración regional de importación de los CSV debe
   ser *Inglés (Estados Unidos)*, porque los CSV usan punto decimal.

## Cómo estaba armado

- **Fuentes:** `mart_ventas`, `mart_productos`, `mart_usuarios`, `mart_nps` y las
  cuatro tablas `filtro_*` de `dw/`.
- **Relaciones:** 10 relaciones 1 a muchos, de cada tabla `filtro_` a cada mart que
  tiene esa columna, con filtrado en una sola dirección.
- **Medidas DAX** (solo suman y dividen; el resto viene calculado del ETL):

```
Total Ventas     = SUM(mart_ventas[ventas])
Total Pedidos    = SUM(mart_ventas[pedidos])
Ticket Promedio  = DIVIDE([Total Ventas], [Total Pedidos])
Ventas Productos = SUM(mart_productos[ventas_productos])
Total Unidades   = SUM(mart_productos[unidades])
Ranking Producto = RANKX(ALL(filtro_producto[producto]), [Ventas Productos])
Respuestas NPS   = SUM(mart_nps[respuestas])
NPS              = DIVIDE(SUM(mart_nps[promotores]) - SUM(mart_nps[detractores]), [Respuestas NPS]) * 100
Usuarios Activos (prom. mensual) = AVERAGE(mart_usuarios[usuarios_activos])
```

El sitio web reproduce estas mismas medidas en JavaScript (ver la sección *Tablero
web* del [README principal](../README.md#tablero-web)).
