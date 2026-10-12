<h1 align="center">rea-casebook</h1>

<p align="center">
  Un mod de Claude Code que lleva en directo el expediente de lo que <a href="https://github.com/morluto/rea">rea</a> entrega al agente mientras hace ingeniería inversa de un binario
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-%E2%89%A5_2.1.296-D97757?logo=claude&logoColor=fff" alt="Claude Code 2.1.296 o posterior">
  <img src="https://img.shields.io/badge/versi%C3%B3n-0.1.2-blue" alt="Versión">
  <img src="https://img.shields.io/badge/tipo-mod-6f42c1" alt="Mod de Claude Code">
  <img src="https://img.shields.io/badge/licencia-MIT-green" alt="Licencia">
</p>

<p align="center"><a href="README.md">Read in English</a></p>

<p align="center">
  <img src="media/session-dark.png" alt="Una sesión de Claude Code con tema oscuro: a la izquierda, el agente analiza un binario de reto con rea y registra hallazgos con record_finding; a la derecha, el panel Casebook muestra el objetivo, un arranque en frío de Ghidra de 18 segundos, siete hallazgos, dos preguntas abiertas y dieciocho registros de evidencia" width="860">
</p>

rea responde a cada consulta de análisis con un registro de evidencia (Evidence): un `evidence_id`, qué se preguntó, qué seguridad tiene (observado, derivado o inferido) y de dónde sale. Esos registros viven en la memoria de rea mientras dura la conexión MCP y, en la conversación, se pierden entre el texto del modelo. rea-casebook los reúne en un panel a medida que llegan, hace visible la espera de Ghidra y da al modelo una herramienta para registrar hallazgos que **tienen que citar evidencia que rea haya entregado de verdad**.

Necesita rea registrado como servidor MCP con el nombre `rea` (sus herramientas aparecen como `mcp__rea__*`). Funciona con cualquier binario que rea abra; se ha construido en Windows con rea 6.4.0 y Ghidra 12.1.

## Qué muestra el panel

| Sección | Qué contiene |
|---|---|
| Objetivo | El binario que abrió `open_binary`: nombre del archivo, formato y arquitectura |
| Espera | Mientras una llamada a rea está en curso, cuánto lleva esperando. La primera consulta que usa Ghidra importa y analiza el objetivo y puede tardar minutos; el panel lo indica |
| Arranque en frío | Cuánto tardó esa primera consulta, guardado para toda la sesión |
| Hallazgos | Lo que el modelo registró con `record_finding`, cada uno con una marca de su confianza y el número de registros de evidencia que cita, y cuántos se rechazaron |
| Preguntas abiertas | Las preguntas que rea guarda como desconocidos residuales (`record_unknown`, `update_unknown`, `list_unknowns`) hasta que se resuelven |
| Evidencia | Los últimos registros, del más reciente al más antiguo: una marca de la confianza, la operación con sus parámetros principales y la autoridad cuando no es el propio binario |

La confianza se dibuja con una marca que cambia de forma además de color: ● observado, ◐ derivado, ○ inferido (con una leyenda al pie del panel). Los hallazgos y las preguntas largas ocupan dos líneas como mucho; la exportación los conserva enteros. El texto va en el color de texto del tema, y el color se reserva para las marcas.

<p align="center">
  <img src="media/casebook-light.png" alt="El panel con tema claro al final de la sesión: hallazgos F1 a F7 marcados como observados o derivados con su número de evidencias, dos preguntas abiertas, la lista de evidencia de la más reciente a la más antigua y la leyenda de las marcas" width="430">
  <img src="media/casebook-dark.png" alt="El mismo panel con tema oscuro" width="430">
</p>

<p align="center">
  <img src="media/waiting-dark.png" alt="El panel durante la primera consulta a Ghidra: lleva 7 segundos esperando a binary_overview, con el aviso de que la primera consulta importa y analiza el objetivo" width="430">
</p>

El panel se abre solo la primera vez que el agente abre un binario, y `/casebook` lo vuelve a abrir. Un pie indica la versión del mod, para saber qué código está dibujando.

## Hallazgos que citan evidencia real

El mod añade una herramienta para el modelo, `record_finding`, con una afirmación, los `evidence_id` que la respaldan y una confianza (`observed`, `derived` o `inferred`). Solo registra el hallazgo si todos los identificadores citados salieron de un resultado de rea en esta sesión. Un identificador inventado, o copiado de otra sesión, se rechaza, y el modelo lee qué identificadores no entregó rea, para que vuelva a buscar evidencia real. Los rechazos se cuentan en el panel.

Los identificadores de la evidencia de mutación que devuelven `record_unknown` y `update_unknown` también cuentan como entregados: «esto sigue sin saberse» es un hallazgo que puede citarlos.

## Cómo funciona

1. Cada llamada a una herramienta de rea pasa por un hook de `tool.call`. El mod anota cuándo empezó, la deja ejecutarse y lee el resultado que recibe el agente: un registro de evidencia, el objetivo de `open_binary`, los desconocidos de las herramientas de sesión o un error. El resultado vuelve al agente intacto, y un fallo dentro del mod nunca rechaza ni repite una llamada a rea.
2. Cuando un resultado es demasiado grande para el cliente y se guarda en un archivo, el mod lee la evidencia de ese archivo.
3. El mod nunca llama a rea por su cuenta. Todo lo que muestra es lo que el agente ya recibió.
4. El estado vive en la sesión (`$.state`) y lo dibuja el panel. Un segundo `open_binary` conserva la evidencia del primero, así que al comparar dos compilaciones se mantienen las dos.

## El comando

| Comando | Qué hace |
|---|---|
| `/casebook` | Abre el panel |
| `/casebook export` | Escribe el expediente en Markdown en `casebook-<objetivo>.md`, en la carpeta de la sesión |
| `/casebook export <archivo>` | Lo escribe en ese archivo |

La exportación incluye el objetivo (nombre, formato, arquitectura y SHA-256), el arranque en frío, los hallazgos con su evidencia, confianza y autoridad, las preguntas abiertas y la lista de evidencia. Nombra el archivo, nunca su ruta local.

## Idioma

En `/config`, dentro de rea-casebook, **Language** es `English` (el predeterminado) o `Español`. Afecta al panel, a la exportación y a lo que lee Claude cuando se rechaza un hallazgo. La descripción de la herramienta se queda en inglés, el idioma que mejor lee el modelo.

## Permisos

El panel no necesita reglas: el mod lee los resultados de llamadas a rea que tus propias reglas ya permitieron y no llama a nada por su cuenta.

`record_finding` la llama el modelo, así que pasa por tus permisos como cualquier otra herramienta: Claude Code puede pedirte confirmación cada vez o, en el modo automático, decidirlo el clasificador. Solo escribe en el panel, de modo que conviene permitirla en `.claude/settings.json` (el del proyecto) o en `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["mcp__rea-casebook__record_finding"]
  }
}
```

`/casebook export` escribe un archivo cuando lo ejecutas. El mod lo escribe a través del motor, sin pasar por tus reglas.

## Instalación

Dentro de una sesión de Claude Code:

```text
/plugin install rea-casebook --marketplace pablodiazjorge/rea-casebook
```

O en una terminal:

```bash
claude plugin marketplace add pablodiazjorge/rea-casebook
```

```bash
claude plugin install rea-casebook@rea-casebook
```

## Desarrollo

La lectura de los resultados de rea, el estado del expediente, la exportación y los textos son módulos sin dependencias del motor que se prueban directamente. Los hooks se prueban contra un motor simulado cuyo rea responde con resultados reales de rea 6.4.0, con las rutas locales sustituidas (`tests/fixtures/rea.ts`).

```bash
claude plugin validate .claude-plugin/plugin.json
```

```bash
claude plugin test .
```

La CI ejecuta las dos órdenes en Ubuntu, macOS y Windows con Claude Code 2.1.296.

Para probar un cambio en una sesión real, arranca Claude Code con la carpeta como directorio de plugins; recarga el mod cuando cambian sus archivos:

```bash
claude --plugin-dir .
```

## Estado

La versión 0.1 es el primer panel funcional. Lo siguiente: un diario por sesión fuera de tu proyecto, una exportación a artifact y una grabación corta. El diseño está documentado en [rea-lab](https://github.com/pablodiazjorge/rea-lab) (ADR 0015 a 0017).

## Licencia

[MIT](LICENSE)
