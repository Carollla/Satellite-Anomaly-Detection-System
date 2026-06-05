function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(value: string) {
  const placeholders: string[] = []
  let text = escapeHtml(value)

  text = text.replace(/`([^`]+)`/g, (_match, code) => {
    const token = `@@CODE_${placeholders.length}@@`
    placeholders.push(`<code>${code}</code>`)
    return token
  })

  text = text
    .replace(/\\\[((?:.|\n)*?)\\\]/g, '<span class="math-block">$1</span>')
    .replace(/\\\((.*?)\\\)/g, '<span class="math-inline">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')

  placeholders.forEach((html, index) => {
    text = text.replace(`@@CODE_${index}@@`, html)
  })

  return text
}

function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function renderTable(lines: string[], start: number) {
  const header = splitTableRow(lines[start])
  const rows: string[][] = []
  let index = start + 2

  while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
    rows.push(splitTableRow(lines[index]))
    index += 1
  }

  const headHtml = header.map((cell) => `<th>${renderInline(cell)}</th>`).join('')
  const bodyHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`)
    .join('')

  return {
    html: `<div class="md-table-wrap"><table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
    next: index
  }
}

function renderList(lines: string[], start: number, ordered: boolean) {
  const tag = ordered ? 'ol' : 'ul'
  const items: string[] = []
  let index = start
  const pattern = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/

  while (index < lines.length) {
    const match = lines[index].match(pattern)
    if (!match) break
    items.push(`<li>${renderInline(match[1])}</li>`)
    index += 1
  }

  return {
    html: `<${tag}>${items.join('')}</${tag}>`,
    next: index
  }
}

export function renderMarkdown(source: string) {
  const raw = String(source || '')
  const normalized = (raw.includes('\n') ? raw : raw.replace(/\\n/g, '\n'))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let index = 0

  function flushParagraph() {
    if (!paragraph.length) return
    blocks.push(`<p>${paragraph.map((line) => renderInline(line)).join('<br>')}</p>`)
    paragraph = []
  }

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      index += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      flushParagraph()
      const lang = trimmed.slice(3).trim()
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index])
        index += 1
      }
      blocks.push(
        `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`
      )
      index += 1
      continue
    }

    if (index + 1 < lines.length && line.includes('|') && isTableSeparator(lines[index + 1])) {
      flushParagraph()
      const table = renderTable(lines, index)
      blocks.push(table.html)
      index = table.next
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      const level = Math.min(heading[1].length, 4)
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      index += 1
      continue
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph()
      blocks.push('<hr>')
      index += 1
      continue
    }

    if (/^\s*>\s+/.test(line)) {
      flushParagraph()
      const quoteLines: string[] = []
      while (index < lines.length && /^\s*>\s+/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s+/, ''))
        index += 1
      }
      blocks.push(`<blockquote>${quoteLines.map((quoteLine) => renderInline(quoteLine)).join('<br>')}</blockquote>`)
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph()
      const list = renderList(lines, index, false)
      blocks.push(list.html)
      index = list.next
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph()
      const list = renderList(lines, index, true)
      blocks.push(list.html)
      index = list.next
      continue
    }

    paragraph.push(trimmed)
    index += 1
  }

  flushParagraph()
  return blocks.join('')
}
