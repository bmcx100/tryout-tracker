import * as cheerio from "cheerio"

export interface ParsedSession {
  level: string
  round_number: number
  group_number: number
  date: string
  start_time: string
  end_time: string
  rink: string
  player_numbers: number[]
}

export interface ParsedPlayer {
  number: number
  name?: string
}

export interface ParseResult {
  sessions: ParsedSession[]
  players: ParsedPlayer[]
  raw_text: string
}

export function parseHtml(html: string): ParseResult {
  const $ = cheerio.load(html)
  const sessions: ParsedSession[] = []
  const players: ParsedPlayer[] = []
  const seenNumbers = new Set<number>()

  // Extract text content for raw preview
  const rawText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000)

  // Look for tables with player numbers
  $("table").each((_, table) => {
    $(table).find("tr").each((_, row) => {
      const cells = $(row).find("td, th")
      cells.each((_, cell) => {
        const text = $(cell).text().trim()
        // Look for player numbers (1-3 digit numbers)
        const numberMatch = text.match(/^#?(\d{1,3})$/)
        if (numberMatch) {
          const num = parseInt(numberMatch[1], 10)
          if (num > 0 && num < 1000 && !seenNumbers.has(num)) {
            seenNumbers.add(num)
            players.push({ number: num })
          }
        }
      })
    })
  })

  // Also look for numbers in lists
  $("li, span, div, p").each((_, el) => {
    const text = $(el).text().trim()
    const numberMatch = text.match(/^#?(\d{1,3})\b/)
    if (numberMatch) {
      const num = parseInt(numberMatch[1], 10)
      if (num > 0 && num < 1000 && !seenNumbers.has(num)) {
        seenNumbers.add(num)
        players.push({ number: num })
      }
    }
  })

  return { sessions, players, raw_text: rawText }
}

// --- Continuations Parser ---

export interface ParsedContinuationSession {
  session_number: number
  label: string
  date: string
  start_time: string
  end_time: string
  player_numbers: number[]
  flagged_players: Array<{ number: number; note: string }>
}

export interface ContinuationsParseResult {
  level_label: string
  title: string
  sessions: ParsedContinuationSession[]
  all_continuing_numbers: number[]
  raw_text: string
}

function parseTimeStr(t: string): string {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i)
  if (!m) return ""
  let h = parseInt(m[1])
  if (m[3].toLowerCase() === "pm" && h !== 12) h += 12
  if (m[3].toLowerCase() === "am" && h === 12) h = 0
  return `${h.toString().padStart(2, "0")}:${m[2]}`
}

function parseSessionLabel(text: string) {
  const sessionMatch = text.match(/Session\s+(\d+)/i)

  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  }

  const dateMatch = text.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i
  )

  let date = ""
  if (dateMatch) {
    const month = months[dateMatch[1].toLowerCase()] || "01"
    const day = dateMatch[2].padStart(2, "0")
    date = `${dateMatch[3]}-${month}-${day}`
  }

  const timeMatch = text.match(
    /(\d{1,2}:\d{2}\s*(?:am|pm))\s*to\s*(\d{1,2}:\d{2}\s*(?:am|pm))/i
  )

  return {
    session_number: sessionMatch ? parseInt(sessionMatch[1]) : 0,
    date,
    start_time: timeMatch ? parseTimeStr(timeMatch[1]) : "",
    end_time: timeMatch ? parseTimeStr(timeMatch[2]) : "",
  }
}

export function parseContinuationsHtml(html: string): ContinuationsParseResult {
  const $ = cheerio.load(html)

  const title = $("h1").first().text().trim()
  const levelMatch = title.match(/(U\d+)/i)
  const level_label = levelMatch ? levelMatch[1] : ""
  const rawText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000)

  const sessions: ParsedContinuationSession[] = []
  const allNumbers: number[] = []

  $("strong").each((_, el) => {
    const text = $(el).text().trim()
    if (!text.match(/Session\s+\d+/i)) return

    const parsed = parseSessionLabel(text)

    // Find the next table — the <strong> is typically the last child of a
    // wrapper <div>, so we walk siblings of the parent container, not the
    // <strong> itself.
    let tableEl: ReturnType<typeof $> | null = null
    const startEl = $(el).parent().is("div") ? $(el).parent() : $(el)
    let sibling = startEl.next()
    while (sibling.length) {
      if (sibling.is("table")) {
        tableEl = sibling
        break
      }
      if (sibling.find("strong").length || sibling.is("strong")) break
      const inner = sibling.find("table").first()
      if (inner.length) {
        tableEl = inner
        break
      }
      sibling = sibling.next()
    }

    const player_numbers: number[] = []
    const flagged_players: Array<{ number: number; note: string }> = []

    if (tableEl && tableEl.length) {
      tableEl.find("td").each((_, cell) => {
        const cellText = $(cell).text().trim()
        const match = cellText.match(/^(\d{1,4})\s*(.*)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          const suffix = match[2].trim()
          if (num > 0) {
            player_numbers.push(num)
            allNumbers.push(num)
            if (suffix) {
              flagged_players.push({ number: num, note: suffix })
            }
          }
        }
      })
    }

    sessions.push({
      session_number: parsed.session_number,
      label: text,
      date: parsed.date,
      start_time: parsed.start_time,
      end_time: parsed.end_time,
      player_numbers,
      flagged_players,
    })
  })

  return { level_label, title, sessions, all_continuing_numbers: allNumbers, raw_text: rawText }
}
