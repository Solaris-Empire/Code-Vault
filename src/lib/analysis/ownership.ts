// Ownership & authenticity detection — Phase 4.
//
// Collects local evidence from the uploaded archive to answer: "is this code
// really the seller's, or did they steal/repackage it?" Returns a verdict
// + explanatory signals. Pure Node — no network calls in this module (GitHub
// match and internal fingerprint live in sibling modules).
//
// Signals we build:
//   1. Git authorship — distinct committer emails/names from .git objects
//      or fallback text in packed log files.
//   2. LICENSE compatibility — detect LICENSE/COPYING/LICENCE text and
//      classify as commercial-safe (MIT/Apache/BSD/Unlicense/WTFPL/ISC/etc.)
//      vs copyleft-restrictive (GPL/AGPL/SSPL) vs non-commercial (CC-NC).
//   3. Copyright headers — scan source files for "Copyright (c) <name>"
//      lines; multiple distinct holders hints at bundled/stolen code.
//   4. Obfuscation / minification — ratio of huge single-line files and
//      files with telltale minifier patterns.

import type { IZipEntry } from 'adm-zip'

// ─── Public types ──────────────────────────────────────────────────

export type OwnershipVerdict = 'verified' | 'ok' | 'suspicious' | 'stolen' | 'unknown'
export type OwnershipSignalStrength = 'ok' | 'info' | 'warn' | 'critical'

export interface OwnershipSignal {
  kind: string
  strength: OwnershipSignalStrength
  description: string
  evidence?: string[]
}

export interface GitAuthorshipInfo {
  hasGitFolder: boolean
  uniqueAuthors: string[]
  commitCount: number
  note?: string
}

export interface LicenseInfo {
  found: boolean
  file?: string
  classification: 'commercial-safe' | 'copyleft' | 'non-commercial' | 'proprietary' | 'unknown'
  name: string
  /** True if this license allows the product to be resold on CodeVault. */
  allowsResale: boolean
}

export interface CopyrightHeaderInfo {
  filesScanned: number
  filesWithHeaders: number
  distinctHolders: string[]
}

export interface ObfuscationInfo {
  obfuscatedFiles: number
  /** Files scanned for obfuscation heuristics (source files only). */
  filesScanned: number
  ratio: number
  examples: string[]
}

export interface OwnershipResult {
  verdict: OwnershipVerdict
  /** 0-100 confidence that the seller legitimately owns this code. */
  authenticityScore: number
  signals: OwnershipSignal[]
  git: GitAuthorshipInfo
  license: LicenseInfo
  headers: CopyrightHeaderInfo
  obfuscation: ObfuscationInfo
}

// ─── Git authorship extraction ─────────────────────────────────────

// Matches bytes like "author Jane Doe <jane@example.com> 1700000000 +0000"
// in packed git objects and loose commit blobs. We don't decode zlib — we
// grep the whole archive bytes in utf8 with a non-destructive lossy decode,
// because AdmZip entries are already accessible as buffers.
const AUTHOR_RE = /(?:author|committer)\s+([^<\n]+?)\s*<([^>\n]+)>/g

export class OwnershipCollector {
  private readonly authorIds = new Set<string>()
  private commitCount = 0
  private hasGitFolder = false

  // License detection
  private licenseFile: string | undefined
  private licenseText: string | undefined

  // Copyright headers
  private filesScanned = 0
  private filesWithHeaders = 0
  private readonly holders = new Set<string>()

  // Obfuscation
  private obfFilesScanned = 0
  private obfFiles = 0
  private readonly obfExamples: string[] = []

  /** Feed an archive entry that lives under .git/. We scan its bytes for
   *  author/committer lines. Safe to call on any .git/** path. */
  scanGitEntry(entry: IZipEntry, relPath: string): void {
    this.hasGitFolder = true
    // Cap per-entry bytes examined to keep this cheap.
    let buf: Buffer
    try {
      buf = entry.getData()
    } catch {
      return
    }
    if (buf.length === 0) return
    const slice = buf.length > 200_000 ? buf.subarray(0, 200_000) : buf
    // lossy utf8 — author lines are ASCII-safe anyway
    const text = slice.toString('utf8')
    AUTHOR_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = AUTHOR_RE.exec(text))) {
      const name = m[1].trim()
      const email = m[2].trim().toLowerCase()
      if (email) {
        this.authorIds.add(`${name} <${email}>`)
        this.commitCount++
      }
    }
    // Cap the size of the set so a malicious archive can't blow up memory
    if (this.authorIds.size > 500) {
      const first500 = Array.from(this.authorIds).slice(0, 500)
      this.authorIds.clear()
      for (const a of first500) this.authorIds.add(a)
    }
    void relPath
  }

  /** Feed a potential LICENSE file (LICENSE, LICENSE.md, COPYING, LICENCE, …). */
  scanLicenseFile(relPath: string, content: string): void {
    // If we already recorded a top-level license, don't let a nested one override.
    if (this.licenseFile && this.licenseFile.split('/').length <= relPath.split('/').length) return
    this.licenseFile = relPath
    this.licenseText = content.slice(0, 8000)
  }

  /** Feed a source file so we can scan its first few KB for copyright headers
   *  and obfuscation tells. */
  scanSourceFile(relPath: string, content: string): void {
    this.filesScanned++

    // Copyright header detection — first 60 lines is plenty
    const head = content.split(/\r?\n/).slice(0, 60).join('\n')
    // Accept © or Copyright, optional (c), optional years, then a name
    const re = /(?:©|\(c\)|copyright)\s*(?:\(c\)\s*)?(?:\d{2,4}(?:\s*[-–,]\s*\d{2,4})?\s+)?([A-Za-z][A-Za-z0-9 ,.'&-]{2,80})/gi
    let matched = false
    let m: RegExpExecArray | null
    while ((m = re.exec(head))) {
      const raw = m[1].trim().replace(/\.+$/, '')
      // Filter obvious junk: sentences, long paragraphs, all-lowercase noise
      if (raw.length < 3 || raw.length > 80) continue
      if (/^(the|this|all|see|for|and|or|any|by the|under|holder|holders)\b/i.test(raw)) continue
      matched = true
      this.holders.add(raw)
    }
    if (matched) this.filesWithHeaders++

    // Obfuscation heuristic — only check files that are plausibly source.
    this.obfFilesScanned++
    if (looksObfuscated(content)) {
      this.obfFiles++
      if (this.obfExamples.length < 8) this.obfExamples.push(relPath)
    }
  }

  finalize(sellerDisplayName: string | null, sellerEmail: string | null): OwnershipResult {
    const git = this.buildGitInfo()
    const license = classifyLicense(this.licenseFile, this.licenseText)
    const headers = this.buildHeadersInfo()
    const obfuscation = this.buildObfuscationInfo()
    const signals: OwnershipSignal[] = []

    scoreGitSignals(signals, git, sellerDisplayName, sellerEmail)
    scoreLicenseSignals(signals, license)
    scoreHeaderSignals(signals, headers, sellerDisplayName)
    scoreObfuscationSignals(signals, obfuscation)

    const authenticityScore = computeAuthenticityScore(signals, git, license, headers)
    const verdict = verdictFromScore(authenticityScore, signals)

    return { verdict, authenticityScore, signals, git, license, headers, obfuscation }
  }

  private buildGitInfo(): GitAuthorshipInfo {
    return {
      hasGitFolder: this.hasGitFolder,
      uniqueAuthors: Array.from(this.authorIds).slice(0, 25),
      commitCount: this.commitCount,
      note: this.hasGitFolder && this.authorIds.size === 0
        ? 'Git folder present but no author lines could be parsed (likely packed/zlib-compressed objects).'
        : undefined,
    }
  }

  private buildHeadersInfo(): CopyrightHeaderInfo {
    return {
      filesScanned: this.filesScanned,
      filesWithHeaders: this.filesWithHeaders,
      distinctHolders: Array.from(this.holders).slice(0, 25),
    }
  }

  private buildObfuscationInfo(): ObfuscationInfo {
    const ratio = this.obfFilesScanned > 0 ? this.obfFiles / this.obfFilesScanned : 0
    return {
      obfuscatedFiles: this.obfFiles,
      filesScanned: this.obfFilesScanned,
      ratio: Math.round(ratio * 1000) / 1000,
      examples: this.obfExamples,
    }
  }
}

// ─── License classification ────────────────────────────────────────

interface LicenseMatcher {
  name: string
  classification: LicenseInfo['classification']
  allowsResale: boolean
  patterns: RegExp[]
}

// Order matters: more specific matchers first (AGPL before GPL, etc.)
const LICENSE_MATCHERS: LicenseMatcher[] = [
  { name: 'AGPL-3.0', classification: 'copyleft', allowsResale: false, patterns: [/GNU\s+AFFERO\s+GENERAL\s+PUBLIC\s+LICENSE/i, /\bAGPL[- ]?3\b/i] },
  { name: 'GPL-3.0', classification: 'copyleft', allowsResale: false, patterns: [/GNU\s+GENERAL\s+PUBLIC\s+LICENSE[\s\S]{0,200}Version\s+3/i, /\bGPL[- ]?3\b/i] },
  { name: 'GPL-2.0', classification: 'copyleft', allowsResale: false, patterns: [/GNU\s+GENERAL\s+PUBLIC\s+LICENSE[\s\S]{0,200}Version\s+2/i, /\bGPL[- ]?2\b/i] },
  { name: 'LGPL', classification: 'copyleft', allowsResale: false, patterns: [/GNU\s+LESSER\s+GENERAL\s+PUBLIC\s+LICENSE/i, /\bLGPL\b/i] },
  { name: 'SSPL', classification: 'copyleft', allowsResale: false, patterns: [/Server\s+Side\s+Public\s+License/i, /\bSSPL\b/i] },
  { name: 'CC-BY-NC', classification: 'non-commercial', allowsResale: false, patterns: [/Creative\s+Commons[\s\S]{0,80}Non[- ]?Commercial/i, /CC[- ]BY[- ]NC/i] },
  { name: 'Creative Commons', classification: 'non-commercial', allowsResale: false, patterns: [/Creative\s+Commons/i] },
  { name: 'MIT', classification: 'commercial-safe', allowsResale: true, patterns: [/Permission is hereby granted, free of charge/i, /\bMIT License\b/i] },
  { name: 'Apache-2.0', classification: 'commercial-safe', allowsResale: true, patterns: [/Apache License[\s\S]{0,200}Version\s+2/i] },
  { name: 'BSD', classification: 'commercial-safe', allowsResale: true, patterns: [/Redistribution and use in source and binary forms/i, /\bBSD\s+License\b/i] },
  { name: 'ISC', classification: 'commercial-safe', allowsResale: true, patterns: [/\bISC License\b/i, /Permission to use, copy, modify/i] },
  { name: 'Unlicense', classification: 'commercial-safe', allowsResale: true, patterns: [/This is free and unencumbered software released into the public domain/i, /\bunlicense\b/i] },
  { name: 'WTFPL', classification: 'commercial-safe', allowsResale: true, patterns: [/DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE/i, /\bWTFPL\b/i] },
  { name: 'MPL-2.0', classification: 'commercial-safe', allowsResale: true, patterns: [/Mozilla Public License[\s\S]{0,80}Version\s+2/i] },
  { name: 'Proprietary / All rights reserved', classification: 'proprietary', allowsResale: true, patterns: [/All rights reserved/i, /proprietary/i] },
]

function classifyLicense(file: string | undefined, text: string | undefined): LicenseInfo {
  if (!file || !text) {
    return { found: false, classification: 'unknown', name: 'No LICENSE file detected', allowsResale: true }
  }
  for (const m of LICENSE_MATCHERS) {
    if (m.patterns.some((re) => re.test(text))) {
      return { found: true, file, classification: m.classification, name: m.name, allowsResale: m.allowsResale }
    }
  }
  return { found: true, file, classification: 'unknown', name: 'Unrecognized license', allowsResale: true }
}

// ─── Obfuscation heuristic ─────────────────────────────────────────

function looksObfuscated(content: string): boolean {
  if (content.length < 2000) return false
  const lines = content.split(/\r?\n/)
  // Extremely long single line is the #1 minification tell
  const maxLine = lines.reduce((m, l) => (l.length > m ? l.length : m), 0)
  if (maxLine > 5000 && lines.length < Math.ceil(content.length / 2500)) return true
  // Heavy density of one-letter identifiers followed by punctuation
  const shortIdMatches = content.match(/\b[a-z_]\b[=(.,;]/g)
  if (shortIdMatches && shortIdMatches.length > 500) return true
  // Hex string walls
  if (/(?:\\x[0-9a-f]{2}){50,}/i.test(content)) return true
  // Common webpack minifier sigil
  if (/!function\([a-zA-Z],[a-zA-Z]\)\{/.test(content) && maxLine > 3000) return true
  return false
}

// ─── Signal scoring ────────────────────────────────────────────────

function scoreGitSignals(
  signals: OwnershipSignal[],
  git: GitAuthorshipInfo,
  sellerDisplayName: string | null,
  sellerEmail: string | null,
): void {
  if (!git.hasGitFolder) {
    signals.push({
      kind: 'git.no-history',
      strength: 'info',
      description: 'No .git folder in the archive — git authorship cannot be verified. This is normal for most uploads.',
    })
    return
  }

  if (git.uniqueAuthors.length === 0) {
    signals.push({
      kind: 'git.opaque-history',
      strength: 'info',
      description: git.note || 'Git folder present but no author lines could be parsed.',
    })
    return
  }

  const sellerMatches = findSellerAuthorMatch(git.uniqueAuthors, sellerDisplayName, sellerEmail)
  if (sellerMatches.length > 0) {
    signals.push({
      kind: 'git.seller-authored',
      strength: 'ok',
      description: `Git history contains commits from the seller's account (${sellerMatches.join(', ')}).`,
      evidence: sellerMatches,
    })
  } else {
    signals.push({
      kind: 'git.author-mismatch',
      strength: 'warn',
      description: `Seller's name/email does not appear in the git history (${git.uniqueAuthors.length} committer${git.uniqueAuthors.length === 1 ? '' : 's'} found, none match).`,
      evidence: git.uniqueAuthors.slice(0, 5),
    })
  }

  if (git.uniqueAuthors.length >= 5) {
    signals.push({
      kind: 'git.many-authors',
      strength: 'info',
      description: `${git.uniqueAuthors.length} distinct git committers — could be a team project or a fork of someone else's repo.`,
      evidence: git.uniqueAuthors.slice(0, 5),
    })
  }
}

function findSellerAuthorMatch(authors: string[], name: string | null, email: string | null): string[] {
  const nameLc = name?.toLowerCase().trim() ?? ''
  const emailLc = email?.toLowerCase().trim() ?? ''
  const out: string[] = []
  for (const a of authors) {
    const al = a.toLowerCase()
    if (emailLc && al.includes(emailLc)) out.push(a)
    else if (nameLc && nameLc.length >= 3 && al.includes(nameLc)) out.push(a)
  }
  return out
}

function scoreLicenseSignals(signals: OwnershipSignal[], license: LicenseInfo): void {
  if (!license.found) {
    signals.push({
      kind: 'license.missing',
      strength: 'info',
      description: 'No LICENSE file detected. Buyers prefer clear licensing terms.',
    })
    return
  }
  if (license.classification === 'copyleft') {
    signals.push({
      kind: 'license.copyleft',
      strength: 'critical',
      description: `${license.name} is a copyleft license that generally forbids closed-source commercial resale — verify with seller.`,
      evidence: license.file ? [license.file] : [],
    })
  } else if (license.classification === 'non-commercial') {
    signals.push({
      kind: 'license.non-commercial',
      strength: 'critical',
      description: `${license.name} explicitly forbids commercial resale.`,
      evidence: license.file ? [license.file] : [],
    })
  } else if (license.classification === 'commercial-safe') {
    signals.push({
      kind: 'license.commercial-safe',
      strength: 'ok',
      description: `${license.name} is commercial-friendly — resale is permitted.`,
      evidence: license.file ? [license.file] : [],
    })
  } else if (license.classification === 'proprietary') {
    signals.push({
      kind: 'license.proprietary',
      strength: 'info',
      description: `${license.name} — seller must hold copyright or have distribution rights.`,
      evidence: license.file ? [license.file] : [],
    })
  } else {
    signals.push({
      kind: 'license.unknown',
      strength: 'info',
      description: 'LICENSE file present but text did not match any known license.',
      evidence: license.file ? [license.file] : [],
    })
  }
}

function scoreHeaderSignals(
  signals: OwnershipSignal[],
  headers: CopyrightHeaderInfo,
  sellerDisplayName: string | null,
): void {
  if (headers.distinctHolders.length === 0) return

  const sellerLc = sellerDisplayName?.toLowerCase().trim() ?? ''
  const sellerMatch = sellerLc && headers.distinctHolders.some((h) => h.toLowerCase().includes(sellerLc))

  if (headers.distinctHolders.length === 1) {
    signals.push({
      kind: 'headers.single-holder',
      strength: sellerMatch ? 'ok' : 'info',
      description: sellerMatch
        ? `Copyright headers consistently credit the seller ("${headers.distinctHolders[0]}").`
        : `Copyright headers credit a single holder ("${headers.distinctHolders[0]}") — seller may need to confirm ownership.`,
      evidence: headers.distinctHolders,
    })
    return
  }

  if (headers.distinctHolders.length >= 4) {
    signals.push({
      kind: 'headers.many-holders',
      strength: 'warn',
      description: `${headers.distinctHolders.length} distinct copyright holders across source files — hint at bundled or lifted code.`,
      evidence: headers.distinctHolders.slice(0, 6),
    })
  } else {
    signals.push({
      kind: 'headers.multiple-holders',
      strength: 'info',
      description: `${headers.distinctHolders.length} distinct copyright holders — could be legitimate collaborators or third-party code.`,
      evidence: headers.distinctHolders,
    })
  }
}

function scoreObfuscationSignals(signals: OwnershipSignal[], ob: ObfuscationInfo): void {
  if (ob.obfuscatedFiles === 0) return
  const pct = (ob.ratio * 100).toFixed(1)
  const strength: OwnershipSignalStrength = ob.ratio > 0.2 ? 'warn' : 'info'
  signals.push({
    kind: 'obfuscation.minified-source',
    strength,
    description: `${ob.obfuscatedFiles} source file${ob.obfuscatedFiles === 1 ? '' : 's'} look minified or obfuscated (${pct}% of scanned). Repackaged or hidden-origin code is a theft red flag.`,
    evidence: ob.examples.slice(0, 5),
  })
}

// ─── Verdict ───────────────────────────────────────────────────────

function computeAuthenticityScore(
  signals: OwnershipSignal[],
  git: GitAuthorshipInfo,
  license: LicenseInfo,
  headers: CopyrightHeaderInfo,
): number {
  let score = 70 // neutral start
  for (const s of signals) {
    if (s.strength === 'ok') score += 10
    else if (s.strength === 'warn') score -= 15
    else if (s.strength === 'critical') score -= 30
  }
  // Bonus when git history is present AND matches seller AND single holder
  if (git.hasGitFolder && git.uniqueAuthors.length > 0 && signals.some((s) => s.kind === 'git.seller-authored')) {
    score += 10
  }
  if (license.classification === 'commercial-safe' && headers.distinctHolders.length <= 1) {
    score += 5
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

function verdictFromScore(score: number, signals: OwnershipSignal[]): OwnershipVerdict {
  const hasCritical = signals.some((s) => s.strength === 'critical')
  if (hasCritical) return 'stolen'
  if (score >= 85) return 'verified'
  if (score >= 65) return 'ok'
  if (score >= 40) return 'suspicious'
  return 'stolen'
}

// ─── Path helpers ──────────────────────────────────────────────────

/** True for `.git/…` entries — scanned for authorship. */
export function isGitPath(relPath: string): boolean {
  return relPath === '.git' || relPath.startsWith('.git/') || relPath.includes('/.git/')
}

/** Match typical license-file names (LICENSE, LICENSE.md, COPYING, LICENCE, UNLICENSE …). */
export function isLicenseFile(relPath: string): boolean {
  const base = (relPath.split('/').pop() || '').toLowerCase()
  if (!base) return false
  return /^(license|licence|copying|unlicense)(\.(md|txt|rst))?$/.test(base)
}
