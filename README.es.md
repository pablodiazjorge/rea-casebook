<h1 align="center">rea-casebook</h1>

<p align="center">
  Un mod de Claude Code que lleva en directo el expediente de lo que <a href="https://github.com/morluto/rea">rea</a> entrega al agente mientras hace ingeniería inversa de un binario
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-%E2%89%A5_2.1.296-D97757?logo=claude&logoColor=fff" alt="Claude Code 2.1.296 o posterior">
  <img src="https://img.shields.io/badge/versi%C3%B3n-1.0.1-blue" alt="Versión">
  <img src="https://img.shields.io/badge/tipo-mod-6f42c1" alt="Mod de Claude Code">
  <img src="https://img.shields.io/badge/licencia-MIT-green" alt="Licencia">
</p>

<p align="center"><a href="README.md">Read in English</a></p>

![Una sesión de Claude Code con tema oscuro: a la izquierda, el agente analiza un binario de reto con rea y registra hallazgos con record_finding; a la derecha, el panel Casebook muestra el objetivo, un arranque en frío de Ghidra de 18 segundos, siete hallazgos, dos preguntas abiertas y dieciocho registros de evidencia](media/session-dark.png)

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

![El panel con tema claro al final de la sesión: hallazgos F1 a F7 marcados como observados o derivados con su número de evidencias, dos preguntas abiertas, la lista de evidencia de la más reciente a la más antigua y la leyenda de las marcas](media/casebook-light.png)
![El mismo panel con tema oscuro](media/casebook-dark.png)

![El panel durante la primera consulta a Ghidra: lleva 7 segundos esperando a binary_overview, con el aviso de que la primera consulta importa y analiza el objetivo](media/waiting-dark.png)

El panel se abre solo la primera vez que el agente abre un binario, y `/casebook` lo vuelve a abrir. Un pie indica la versión del mod, para saber qué código está dibujando.

## Hallazgos que citan evidencia real

El mod añade una herramienta para el modelo, `record_finding`, con una afirmación, los `evidence_id` que la respaldan y una confianza (`observed`, `derived` o `inferred`). Solo registra el hallazgo si todos los identificadores citados salieron de un resultado de rea en esta sesión. Un identificador inventado, o copiado de otra sesión, se rechaza, y el modelo lee qué identificadores no entregó rea, para que vuelva a buscar evidencia real. Los rechazos se cuentan en el panel.

Los identificadores de la evidencia de mutación que devuelven `record_unknown` y `update_unknown` también cuentan como entregados: «esto sigue sin saberse» es un hallazgo que puede citarlos.

## Cómo funciona

1. Cada llamada a una herramienta de rea pasa por un hook de `tool.call`. El mod anota cuándo empezó, la deja ejecutarse y lee el resultado que recibe el agente: un registro de evidencia, el objetivo de `open_binary`, los desconocidos de las herramientas de sesión o un error. El resultado vuelve al agente intacto, y un fallo dentro del mod nunca rechaza ni repite una llamada a rea.
2. Cuando un resultado es demasiado grande para el cliente y se guarda en un archivo, el mod lee la evidencia de ese archivo.
3. El mod nunca llama a rea por su cuenta. Todo lo que muestra es lo que el agente ya recibió.
4. El estado vive en la sesión (`$.state`) y lo dibuja el panel. Un segundo `open_binary` conserva la evidencia del primero, así que al comparar dos compilaciones se mantienen las dos.
5. Cada cambio reescribe el diario de la sesión, `~/.rea-casebook/<fecha>/<sesión>.jsonl`: una línea para la sesión y sus contadores, otra para el objetivo con su ruta local completa y una por cada registro de evidencia, pregunta y hallazgo, en el orden en que ocurrieron. El diario se queda en tu carpeta personal; solo `/casebook export` y `/casebook artifact` sacan el expediente de ahí.

## El comando

| Comando | Qué hace |
|---|---|
| `/casebook` | Abre el panel |
| `/casebook export` | Escribe el expediente en Markdown en `casebook-<objetivo>.md`, en la carpeta de la sesión |
| `/casebook export <archivo>` | Lo escribe en ese archivo, siempre como `.md` |
| `/casebook artifact` | Publica el expediente como artifact privado de claude.ai; las siguientes veces actualiza el mismo artifact |

La exportación incluye el objetivo (nombre, formato, arquitectura y SHA-256), el arranque en frío, los hallazgos con su evidencia, confianza y autoridad, las preguntas abiertas y la lista de evidencia. Nombra el archivo, nunca su ruta local.

El artifact es una página con las mismas secciones, con tema claro y oscuro y cada `evidence_id` completo. El mod la escribe junto al diario y la publica él mismo con la herramienta Artifact cuando tus permisos ya permiten esa herramienta; si no, le pide a Claude que la publique en un turno visible, donde decides como en cualquier otra llamada. Necesita una sesión que ofrezca la herramienta Artifact, como la app de escritorio de Claude; en otra, el comando lo indica y remite a `/casebook export`.

## Idioma

En `/config`, dentro de rea-casebook, **Language** es `English` (el predeterminado) o `Español`. Afecta al panel, a la exportación y a lo que lee Claude cuando se rechaza un hallazgo. La descripción de la herramienta se queda en inglés, el idioma que mejor lee el modelo.

## Permisos

El panel no necesita reglas: el mod lee los resultados de llamadas a rea que tus propias reglas ya permitieron y no llama a nada por su cuenta.

`record_finding` la llama el modelo, así que pasa por tus permisos como cualquier otra herramienta: Claude Code puede pedirte confirmación cada vez o, en el modo automático, decidirlo el clasificador. Solo escribe en el panel, de modo que conviene permitirla en `.claude/settings.json` (el del proyecto) o en `~/.claude/settings.json`.

Cuando Claude publica el artifact por ti, antes lee la página que el mod escribió en `~/.rea-casebook/`, fuera de tu proyecto, y Claude Code te pregunta por esa lectura. La segunda regla de abajo permite leer solo esa carpeta, para que la publicación no se detenga ahí:

```json
{
  "permissions": {
    "allow": ["mcp__rea-casebook__record_finding", "Read(~/.rea-casebook/**)"]
  }
}
```

El mod escribe archivos a través del motor, sin pasar por tus reglas: el diario en `~/.rea-casebook/` tras cada cambio, la página del artifact a su lado y el archivo que indiques a `/casebook export` cuando lo ejecutas. `/casebook artifact` llama a la herramienta Artifact por su cuenta solo si tus reglas ya la permiten sin preguntar; si no, la llamada la hace Claude y se aplican tus reglas.

## Qué ejecuta, escribe y envía

Todo lo que el mod hace por su cuenta, para quien quiera revisarlo antes de instalarlo:

- **Hooks.**
  - `tool.call` sobre las herramientas de rea (`mcp__rea__*`): lee cada resultado para actualizar el expediente y se lo devuelve al agente sin cambios.
  - `tool.call` sobre `mcp__rea-casebook__record_finding`: responde a la herramienta propia del mod, como se describe más arriba.
  - `tool.call` sobre `Artifact`: cuando una llamada publica la página del expediente, lee la URL del artifact en su resultado y devuelve el resultado sin cambios. Cualquier otra llamada a Artifact pasa sin tocarse.
  - `command.run` para `/casebook`, `ui.render` para el panel y `session.start` para registrar la herramienta, el comando y un temporizador de un segundo que solo vuelve a dibujar el contador de espera.
- **Archivos que escribe.**
  - `~/.rea-casebook/<día>/<sesión>.jsonl`, el diario, tras cada cambio.
  - `~/.rea-casebook/<día>/<sesión>.html`, la página del artifact, cuando ejecutas `/casebook artifact`.
  - El archivo `.md` de `/casebook export`. La exportación nunca escribe `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` ni nada dentro de `.claude/`.

  No escribe configuración, scripts ni instrucciones.
- **Qué lee.** Los resultados de las llamadas a rea que el agente ya hizo, un resultado de rea que el cliente guardó en un archivo por ser demasiado grande y la variable de entorno `USERPROFILE` o `HOME`, solo para encontrar tu carpeta personal. No lee credenciales.
- **La herramienta que llama por su cuenta.** Solo `Artifact`, solo cuando ejecutas `/casebook artifact` y solo si tus reglas ya la permiten sin preguntar. Publica la página del expediente en tu propia cuenta de claude.ai como artifact privado. Nunca llama a rea ni a ninguna otra herramienta.
- **El prompt que envía.** Solo después de `/casebook artifact`, cuando tus reglas no permiten la llamada a Artifact: un mensaje marcado con `[rea-casebook]` que pide a Claude que publique la página, con su ruta y, en las siguientes veces, la URL del artifact. No lleva nada más de la conversación.
- **Red.** Ninguna propia. Lo único que sale de tu equipo es la página del artifact que decides publicar, a través de la herramienta Artifact de Claude Code.

[PRIVACY.md](PRIVACY.md) lo resume como aviso de privacidad (en inglés).

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

La lectura de los resultados de rea, el estado del expediente, el diario, las dos exportaciones y los textos son módulos sin dependencias del motor que se prueban directamente. Los hooks se prueban contra un motor simulado cuyo rea responde con resultados reales de rea 6.4.0, con las rutas locales sustituidas (`tests/fixtures/rea.ts`).

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

Versión 1.0: el panel, los hallazgos que tienen que citar evidencia real, el diario de la sesión y las exportaciones a Markdown y a artifact, probados en Ubuntu, macOS y Windows y usados en sesiones reales con rea 6.4.0. El diseño está documentado en [rea-lab](https://github.com/pablodiazjorge/rea-lab) (ADR 0015 a 0017).

## Licencia

[MIT](LICENSE)
