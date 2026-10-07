const ENABLED_LINE = /^enabled:.*?(\r?)$/

export function setEnabled(text: string, enabled: boolean): string {
  const lines = text.split('\n')
  const closing = lines.findIndex((line, index) => index > 0 && line.trimEnd() === '---')
  const frontmatterEnd = closing < 0 ? lines.length : closing
  const existing = lines.findIndex((line, index) => index > 0 && index < frontmatterEnd && ENABLED_LINE.test(line))
  if (existing >= 0) {
    lines[existing] = lines[existing].replace(ENABLED_LINE, `enabled: ${enabled}$1`)
  } else {
    const carriageReturn = lines[0].endsWith('\r') ? '\r' : ''
    lines.splice(1, 0, `enabled: ${enabled}${carriageReturn}`)
  }
  return lines.join('\n')
}
