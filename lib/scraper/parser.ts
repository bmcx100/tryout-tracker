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
