// Map file extensions to language + comment syntax, so the analyzer can
// compute LOC, blank lines, and comment lines correctly.

export interface LanguageDef {
  name: string
  lineComment?: string[]
  blockComment?: [string, string][]
  isSource: boolean
}

// Extensions we consider "source code" for LOC counting.
// Everything else is treated as binary/asset and skipped.
export const LANGUAGES: Record<string, LanguageDef> = {
  '.js':   { name: 'JavaScript', lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.mjs':  { name: 'JavaScript', lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.cjs':  { name: 'JavaScript', lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.jsx':  { name: 'JSX',        lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.ts':   { name: 'TypeScript', lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.tsx':  { name: 'TSX',        lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.php':  { name: 'PHP',        lineComment: ['//', '#'], blockComment: [['/*', '*/']], isSource: true },
  '.py':   { name: 'Python',     lineComment: ['#'], blockComment: [['"""', '"""'], ["'''", "'''"]], isSource: true },
  '.rb':   { name: 'Ruby',       lineComment: ['#'], blockComment: [['=begin', '=end']], isSource: true },
  '.go':   { name: 'Go',         lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.rs':   { name: 'Rust',       lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.java': { name: 'Java',       lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.kt':   { name: 'Kotlin',     lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.swift':{ name: 'Swift',      lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.c':    { name: 'C',          lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.h':    { name: 'C Header',   lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.cpp':  { name: 'C++',        lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.cs':   { name: 'C#',         lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.vue':  { name: 'Vue',        lineComment: ['//'], blockComment: [['/*', '*/'], ['<!--', '-->']], isSource: true },
  '.svelte':{ name: 'Svelte',    lineComment: ['//'], blockComment: [['/*', '*/'], ['<!--', '-->']], isSource: true },
  '.html': { name: 'HTML',       blockComment: [['<!--', '-->']], isSource: true },
  '.css':  { name: 'CSS',        blockComment: [['/*', '*/']], isSource: true },
  '.scss': { name: 'SCSS',       lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.sass': { name: 'Sass',       lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.less': { name: 'Less',       lineComment: ['//'], blockComment: [['/*', '*/']], isSource: true },
  '.sh':   { name: 'Shell',      lineComment: ['#'], isSource: true },
  '.bash': { name: 'Shell',      lineComment: ['#'], isSource: true },
  '.sql':  { name: 'SQL',        lineComment: ['--'], blockComment: [['/*', '*/']], isSource: true },
  '.yaml': { name: 'YAML',       lineComment: ['#'], isSource: true },
  '.yml':  { name: 'YAML',       lineComment: ['#'], isSource: true },
  '.json': { name: 'JSON',       isSource: true },
  '.md':   { name: 'Markdown',   isSource: false },
  '.txt':  { name: 'Text',       isSource: false },
}

export function getLanguageByExt(ext: string): LanguageDef | null {
  return LANGUAGES[ext.toLowerCase()] ?? null
}

// Paths we always skip (vendored code, build artifacts, version control)
export const IGNORED_PATH_PARTS = new Set([
  'node_modules',
  '.git',
  'vendor',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.turbo',
  'out',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  'target',
  'bin',
  'obj',
])

export function shouldIgnorePath(relPath: string): boolean {
  const parts = relPath.split(/[\\/]/)
  return parts.some((p) => IGNORED_PATH_PARTS.has(p))
}

// Auto-generated or vendored files that shouldn't count as "authored code".
// Skipping these stops lockfiles from dominating the LOC total.
export const GENERATED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'composer.lock',
  'Gemfile.lock',
  'poetry.lock',
  'Pipfile.lock',
  'Cargo.lock',
  'go.sum',
  'bun.lockb',
  '.pnp.cjs',
  '.pnp.loader.mjs',
])

// Patterns for minified / bundled / map files
const GENERATED_PATTERNS: RegExp[] = [
  /\.min\.(js|css|mjs)$/i,
  /\.bundle\.(js|css|mjs)$/i,
  /\.map$/i,
  /\.d\.ts$/i, // declaration files are generated in most cases
]

export function isGeneratedFile(fileName: string): boolean {
  if (GENERATED_FILENAMES.has(fileName)) return true
  return GENERATED_PATTERNS.some((re) => re.test(fileName))
}
