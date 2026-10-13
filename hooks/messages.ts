// Every word the person and Claude read from the casebook, in English and Spanish.
// No `$`: tested directly.

export type Lang = 'en' | 'es'

/** The userConfig value, or anything else, as a language: Spanish only when it says so. */
export const langOf = (option: unknown): Lang =>
  typeof option === 'string' && /^(es|español|espanol|spanish)\b/iu.test(option.trim()) ? 'es' : 'en'

/** Seconds as the pane shows them: "42 s" or "3 min 05 s". */
export function formatSeconds(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`
}

/** A text cut to `max` characters, at a space when one is near, ending in an ellipsis when it was cut. */
export function clip(value: string, max: number): string {
  if (value.length <= max) return value
  const cut = value.slice(0, Math.max(1, max - 1))
  const space = cut.lastIndexOf(' ')
  return `${(space > cut.length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

type Words = {
  name: string
  command: string
  noTarget: string
  target: (name: string, format: string, architecture: string) => string
  ghidraWaiting: (tool: string, elapsed: string) => string
  waiting: (tool: string, elapsed: string) => string
  coldStart: (elapsed: string) => string
  timeline: (count: number) => string
  noEvidence: string
  unknowns: (count: number) => string
  findings: (count: number) => string
  noFindings: string
  refused: (count: number) => string
  toolDescription: string
  claimField: string
  evidenceField: string
  confidenceField: string
  findingRecorded: (id: string) => string
  invalidFinding: (problems: string[]) => string
  unknownEvidence: (ids: string[]) => string
  findingFailed: string
  opened: string
  exported: (path: string) => string
  exportFailed: (path: string) => string
  /** Before rea opens a binary: nothing to export or publish yet. */
  caseEmpty: string
  /** The page is written; the person gives Claude the request to publish it. */
  artifactWritten: (page: string, request: string) => string
  /** What to ask Claude: a new private artifact, or an update of the one already published. */
  artifactRequest: (page: string, url: string | null, description: string) => string
  artifactDescription: (target: string) => string
  usage: string
  htmlTitle: (target: string) => string
  htmlIntro: string
  htmlFooter: (version: string) => string
  markdownTitle: (target: string) => string
  markdownTarget: string
  markdownFindings: string
  markdownEvidence: string
  markdownUnknowns: string
  markdownNone: string
  confidence: { observed: string; derived: string; inferred: string }
  markdownColumns: { finding: string; evidence: string; confidence: string; operation: string; authority: string; question: string; severity: string; status: string }
}

const EN = {
  name: 'Casebook',
  command: 'Show the rea casebook pane; "/casebook export" writes it as Markdown and "/casebook artifact" writes a page to publish as an artifact, both under ~/.rea-casebook/',
  noTarget: 'No binary open yet. The pane fills in as rea delivers Evidence.',
  target: (name, format, architecture) => `${name} - ${format} ${architecture}`,
  ghidraWaiting: (tool, elapsed) => `Waiting for ${tool}: ${elapsed} (the first Ghidra query imports and analyses the target)`,
  waiting: (tool, elapsed) => `Waiting for ${tool}: ${elapsed}`,
  coldStart: (elapsed) => `Ghidra cold start: ${elapsed}`,
  timeline: (count) => `Evidence (${count})`,
  noEvidence: 'No Evidence yet.',
  unknowns: (count) => `Open unknowns (${count})`,
  findings: (count) => `Findings (${count})`,
  noFindings: 'No findings recorded yet.',
  refused: (count) => `${count} finding(s) refused for citing evidence rea never delivered`,
  toolDescription:
    'Record one finding in the rea casebook pane. Cite only evidence_id values that rea returned in this session; a finding that cites any other id is refused. Use it for conclusions you would put in a report, not for every observation.',
  claimField: 'The finding, in one or two sentences.',
  evidenceField: 'The evidence_id values from rea results that support the finding.',
  confidenceField: 'observed (seen directly), derived (computed from observations) or inferred (your interpretation).',
  findingRecorded: (id) => `Recorded as ${id} in the casebook.`,
  invalidFinding: (problems) => `Not recorded: check ${problems.join(', ')}.`,
  unknownEvidence: (ids) =>
    `Not recorded: rea did not deliver ${ids.length === 1 ? 'this evidence_id' : 'these evidence_id values'} in this session: ${ids.join(', ')}. Cite only ids from rea results you received.`,
  findingFailed: 'Not recorded: the casebook could not save the finding. Try again.',
  opened: 'Casebook pane opened.',
  exported: (path) => `Casebook exported to ${path}.`,
  exportFailed: (path) => `Could not write ${path}.`,
  caseEmpty: 'Nothing to write yet: the casebook fills in once rea opens a binary.',
  artifactWritten: (page, request) => `Casebook page written to ${page}. To publish it as an artifact, ask Claude:\n${request}`,
  artifactRequest: (page, url, description) =>
    url
      ? `Publish ${page} with the Artifact tool to my existing artifact ${url}, without changing its content.`
      : `Publish ${page} with the Artifact tool as a new private artifact with the icon "search" and the description "${description}", without changing its content.`,
  artifactDescription: (target) => `The rea casebook of ${target}: findings with the Evidence they cite, open unknowns and every Evidence record.`,
  usage: 'Usage: /casebook, /casebook export or /casebook artifact',
  htmlTitle: (target) => `Casebook ${target}`,
  htmlIntro: 'What rea delivered to the agent in one Claude Code session. Every finding cites evidence_id values that rea returned in that session; any of them can be checked with rea.',
  htmlFooter: (version) => `Exported by rea-casebook ${version}.`,
  markdownTitle: (target) => `Casebook: ${target}`,
  markdownTarget: 'Target',
  markdownFindings: 'Findings',
  markdownEvidence: 'Evidence',
  markdownUnknowns: 'Open unknowns',
  markdownNone: 'None.',
  confidence: { observed: 'observed', derived: 'derived', inferred: 'inferred' },
  markdownColumns: { finding: 'Finding', evidence: 'Evidence', confidence: 'Confidence', operation: 'Operation', authority: 'Authority', question: 'Question', severity: 'Severity', status: 'Status' },
} satisfies Words

const ES = {
  name: 'Casebook',
  command: 'Muestra el panel del casebook de rea; "/casebook export" lo escribe en Markdown y "/casebook artifact" escribe una página para publicarlo como artifact, los dos en ~/.rea-casebook/',
  noTarget: 'Todavía no hay ningún binario abierto. El panel se rellena a medida que rea entrega evidencia.',
  target: (name, format, architecture) => `${name} - ${format} ${architecture}`,
  ghidraWaiting: (tool, elapsed) => `Esperando a ${tool}: ${elapsed} (la primera consulta a Ghidra importa y analiza el objetivo)`,
  waiting: (tool, elapsed) => `Esperando a ${tool}: ${elapsed}`,
  coldStart: (elapsed) => `Arranque en frío de Ghidra: ${elapsed}`,
  timeline: (count) => `Evidencia (${count})`,
  noEvidence: 'Todavía no hay evidencia.',
  unknowns: (count) => `Preguntas abiertas (${count})`,
  findings: (count) => `Hallazgos (${count})`,
  noFindings: 'Todavía no hay hallazgos registrados.',
  refused: (count) => `${count} hallazgo(s) rechazado(s) por citar evidencia que rea no entregó`,
  toolDescription:
    'Record one finding in the rea casebook pane. Cite only evidence_id values that rea returned in this session; a finding that cites any other id is refused. Use it for conclusions you would put in a report, not for every observation.',
  claimField: 'The finding, in one or two sentences.',
  evidenceField: 'The evidence_id values from rea results that support the finding.',
  confidenceField: 'observed (seen directly), derived (computed from observations) or inferred (your interpretation).',
  findingRecorded: (id) => `Registrado como ${id} en el casebook.`,
  invalidFinding: (problems) => `No registrado: revisa ${problems.join(', ')}.`,
  unknownEvidence: (ids) =>
    `No registrado: rea no ha entregado ${ids.length === 1 ? 'este evidence_id' : 'estos evidence_id'} en esta sesión: ${ids.join(', ')}. Cita solo identificadores de resultados de rea que hayas recibido.`,
  findingFailed: 'No registrado: el casebook no ha podido guardar el hallazgo. Inténtalo de nuevo.',
  opened: 'Panel del casebook abierto.',
  exported: (path) => `Casebook exportado a ${path}.`,
  exportFailed: (path) => `No se ha podido escribir ${path}.`,
  caseEmpty: 'Todavía no hay nada que escribir: el casebook se rellena cuando rea abre un binario.',
  artifactWritten: (page, request) => `Página del casebook escrita en ${page}. Para publicarla como artifact, pídele a Claude:\n${request}`,
  artifactRequest: (page, url, description) =>
    url
      ? `Publica ${page} con la herramienta Artifact en mi artifact ${url}, sin cambiar su contenido.`
      : `Publica ${page} con la herramienta Artifact como artifact privado nuevo, con el icono "search" y la descripción "${description}", sin cambiar su contenido.`,
  artifactDescription: (target) => `El casebook de rea de ${target}: hallazgos con la evidencia que citan, preguntas abiertas y todos los registros de evidencia.`,
  usage: 'Uso: /casebook, /casebook export o /casebook artifact',
  htmlTitle: (target) => `Casebook ${target}`,
  htmlIntro: 'Lo que rea entregó al agente en una sesión de Claude Code. Cada hallazgo cita evidence_id que rea devolvió en esa sesión; cualquiera de ellos se puede comprobar con rea.',
  htmlFooter: (version) => `Exportado por rea-casebook ${version}.`,
  markdownTitle: (target) => `Casebook: ${target}`,
  markdownTarget: 'Objetivo',
  markdownFindings: 'Hallazgos',
  markdownEvidence: 'Evidencia',
  markdownUnknowns: 'Preguntas abiertas',
  markdownNone: 'Ninguno.',
  confidence: { observed: 'observado', derived: 'derivado', inferred: 'inferido' },
  markdownColumns: { finding: 'Hallazgo', evidence: 'Evidencia', confidence: 'Confianza', operation: 'Operación', authority: 'Autoridad', question: 'Pregunta', severity: 'Gravedad', status: 'Estado' },
} satisfies Words

const WORDS: Record<Lang, Words> = { en: EN, es: ES }

export const words = (lang: Lang): Words => WORDS[lang]
