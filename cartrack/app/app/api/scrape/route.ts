import { NextRequest, NextResponse } from 'next/server'

function getScraperUrl(): string {
  return process.env.NEXT_PUBLIC_SCRAPER_URL ?? 'http://localhost:8001'
}

export async function POST(request: NextRequest) {
  const scraperUrl = getScraperUrl()

  try {
    // Forward any body from the caller to the scraper
    let body: unknown = undefined
    try {
      body = await request.json()
    } catch {
      // No body — that's fine
    }

    const scraperResponse = await fetch(`${scraperUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // Allow up to 5 minutes for a scrape run
      signal: AbortSignal.timeout(300_000),
    })

    const data = await scraperResponse.json().catch(() => ({}))

    return NextResponse.json(data, { status: scraperResponse.status })
  } catch (error) {
    if (
      error instanceof TypeError &&
      (error.message.includes('fetch failed') ||
        error.message.includes('ECONNREFUSED'))
    ) {
      return NextResponse.json(
        {
          error: 'Scraper is not running',
          detail: `Could not connect to scraper at ${scraperUrl}`,
        },
        { status: 503 }
      )
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Scraper request timed out' },
        { status: 504 }
      )
    }

    console.error('POST /api/scrape error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  const scraperUrl = getScraperUrl()

  try {
    const scraperResponse = await fetch(`${scraperUrl}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    })

    const data = await scraperResponse.json().catch(() => ({}))

    return NextResponse.json(data, { status: scraperResponse.status })
  } catch (error) {
    if (
      error instanceof TypeError &&
      (error.message.includes('fetch failed') ||
        error.message.includes('ECONNREFUSED'))
    ) {
      return NextResponse.json(
        {
          running: false,
          error: 'Scraper is not running',
          detail: `Could not connect to scraper at ${scraperUrl}`,
        },
        { status: 503 }
      )
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { running: false, error: 'Scraper status request timed out' },
        { status: 504 }
      )
    }

    console.error('GET /api/scrape error:', error)
    return NextResponse.json(
      { running: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
