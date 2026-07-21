import { readdirSync, readFileSync, writeFileSync } from 'fs'
import type { FsEntry, ReadFileResult } from '../shared/types'

export function listDir(dir: string): FsEntry[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.name !== '.git')
      .map((e) => ({ name: e.name, dir: e.isDirectory() }))
      .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
  } catch {
    return []
  }
}

function swapBytes(buf: Buffer): Buffer {
  const out = Buffer.from(buf)
  for (let i = 0; i + 1 < out.length; i += 2) {
    const tmp = out[i]
    out[i] = out[i + 1]
    out[i + 1] = tmp
  }
  return out
}

/** Detect dominant line endings, then normalize to LF for editing. */
function finalize(content: string, encoding: string): ReadFileResult {
  const crlf = (content.match(/\r\n/g) ?? []).length
  const lf = (content.match(/(?<!\r)\n/g) ?? []).length
  const eol: 'lf' | 'crlf' = crlf > lf ? 'crlf' : 'lf'
  return {
    content: content.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    encoding,
    eol
  }
}

/** Read with IDE-style encoding detection: BOMs, strict UTF-8, latin1 fallback. */
export function readFileSmart(path: string, forced?: string): ReadFileResult {
  let buf: Buffer
  try {
    buf = readFileSync(path)
  } catch (error) {
    return { error: (error as Error).message }
  }
  if (buf.subarray(0, 8000).includes(0) && !forced?.startsWith('utf16')) {
    // NUL bytes → binary, unless the caller explicitly asked for UTF-16
    if (!forced) return { binary: true, size: buf.length }
  }
  if (forced) {
    if (forced === 'utf16be') return finalize(swapBytes(buf).toString('utf16le'), 'utf16be')
    return finalize(buf.toString(forced as BufferEncoding), forced)
  }
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return finalize(buf.subarray(3).toString('utf8'), 'utf8-bom')
  }
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return finalize(buf.subarray(2).toString('utf16le'), 'utf16le')
  }
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    return finalize(swapBytes(buf.subarray(2)).toString('utf16le'), 'utf16be')
  }
  try {
    return finalize(new TextDecoder('utf-8', { fatal: true }).decode(buf), 'utf8')
  } catch {
    return finalize(buf.toString('latin1'), 'latin1')
  }
}

/** Write preserving the encoding and line endings the file was opened with. */
export function writeFileSmart(
  path: string,
  content: string,
  encoding: string,
  eol: string = 'lf'
): void {
  if (eol === 'crlf') content = content.replace(/\r?\n/g, '\r\n')
  if (encoding === 'utf8-bom') {
    writeFileSync(path, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content, 'utf8')]))
  } else if (encoding === 'utf16le') {
    writeFileSync(path, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, 'utf16le')]))
  } else if (encoding === 'utf16be') {
    writeFileSync(
      path,
      Buffer.concat([Buffer.from([0xfe, 0xff]), swapBytes(Buffer.from(content, 'utf16le'))])
    )
  } else if (encoding === 'latin1') {
    writeFileSync(path, Buffer.from(content, 'latin1'))
  } else {
    writeFileSync(path, content, 'utf8')
  }
}
