import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Settings } from '@/lib/types'

const DEFAULT_SETTINGS = {
  postcode: 'SW1A 1AA',
  scrapeIntervalMinutes: 60,
  maxResultsPerSource: 100,
  autotraderEnabled: true,
  motorsEnabled: true,
  gumtreeEnabled: true,
  ebayEnabled: true,
  emailEnabled: false,
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  smtpPass: null,
  alertEmail: null,
} as const

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({ where: { id: 1 } })

    if (!settings) {
      // Create default settings on first run
      settings = await prisma.settings.create({
        data: {
          id: 1,
          ...DEFAULT_SETTINGS,
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Settings>

    // Validate numeric fields if provided
    if (body.scrapeIntervalMinutes !== undefined) {
      const val = Number(body.scrapeIntervalMinutes)
      if (isNaN(val) || val < 1) {
        return NextResponse.json(
          { error: 'scrapeIntervalMinutes must be a positive number' },
          { status: 400 }
        )
      }
    }
    if (body.maxResultsPerSource !== undefined) {
      const val = Number(body.maxResultsPerSource)
      if (isNaN(val) || val < 1) {
        return NextResponse.json(
          { error: 'maxResultsPerSource must be a positive number' },
          { status: 400 }
        )
      }
    }

    // Ensure settings row exists
    const existing = await prisma.settings.findUnique({ where: { id: 1 } })
    if (!existing) {
      await prisma.settings.create({ data: { id: 1, ...DEFAULT_SETTINGS } })
    }

    const updated = await prisma.settings.update({
      where: { id: 1 },
      data: {
        ...(body.postcode !== undefined && { postcode: body.postcode }),
        ...(body.scrapeIntervalMinutes !== undefined && {
          scrapeIntervalMinutes: Number(body.scrapeIntervalMinutes),
        }),
        ...(body.maxResultsPerSource !== undefined && {
          maxResultsPerSource: Number(body.maxResultsPerSource),
        }),
        ...(body.autotraderEnabled !== undefined && {
          autotraderEnabled: Boolean(body.autotraderEnabled),
        }),
        ...(body.motorsEnabled !== undefined && {
          motorsEnabled: Boolean(body.motorsEnabled),
        }),
        ...(body.gumtreeEnabled !== undefined && {
          gumtreeEnabled: Boolean(body.gumtreeEnabled),
        }),
        ...(body.ebayEnabled !== undefined && {
          ebayEnabled: Boolean(body.ebayEnabled),
        }),
        ...(body.emailEnabled !== undefined && {
          emailEnabled: Boolean(body.emailEnabled),
        }),
        ...(body.smtpHost !== undefined && { smtpHost: body.smtpHost }),
        ...(body.smtpPort !== undefined && {
          smtpPort: body.smtpPort != null ? Number(body.smtpPort) : null,
        }),
        ...(body.smtpUser !== undefined && { smtpUser: body.smtpUser }),
        ...(body.smtpPass !== undefined && { smtpPass: body.smtpPass }),
        ...(body.alertEmail !== undefined && { alertEmail: body.alertEmail }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
