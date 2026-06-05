import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false
})

const defaultRender =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
const defaultTableOpen =
  md.renderer.rules.table_open ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
const defaultTableClose =
  md.renderer.rules.table_close ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const targetIndex = token.attrIndex('target')
  const relIndex = token.attrIndex('rel')

  if (targetIndex < 0) token.attrPush(['target', '_blank'])
  else token.attrs![targetIndex][1] = '_blank'

  if (relIndex < 0) token.attrPush(['rel', 'noreferrer'])
  else token.attrs![relIndex][1] = 'noreferrer'

  return defaultRender(tokens, idx, options, env, self)
}

md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
  return `<div class="md-table-wrap">${defaultTableOpen(tokens, idx, options, env, self)}`
}

md.renderer.rules.table_close = (tokens, idx, options, env, self) => {
  return `${defaultTableClose(tokens, idx, options, env, self)}</div>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeSource(source: string) {
  const raw = String(source || '')
  return raw
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\([`*_{}#+\-.!|>])/g, '$1')
}

export function renderMarkdown(source: string) {
  const mathBlocks: string[] = []
  const normalized = normalizeSource(source)
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_match, body) => {
      const token = `@@MATH_BLOCK_${mathBlocks.length}@@`
      mathBlocks.push(`<div class="math-block">${escapeHtml(body)}</div>`)
      return token
    })
    .replace(/\\\((.*?)\\\)/g, (_match, body) => {
      const token = `@@MATH_INLINE_${mathBlocks.length}@@`
      mathBlocks.push(`<span class="math-inline">${escapeHtml(body)}</span>`)
      return token
    })

  let html = md.render(normalized)
  mathBlocks.forEach((block, index) => {
    html = html.replace(`@@MATH_BLOCK_${index}@@`, block)
    html = html.replace(`@@MATH_INLINE_${index}@@`, block)
  })
  return html
}
