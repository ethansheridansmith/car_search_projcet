import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const existing = await prisma.savedSearch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      )
    }

    // Also delete associated alerts
    await prisma.alert.deleteMany({ where: { savedSearchId: id } })
    await prisma.savedSearch.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/searches/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const {
      emailAlert,
      desktopAlert,
      lastViewed,
      resetNewCount,
      name,
    } = body as {
      emailAlert?: boolean
      desktopAlert?: boolean
      lastViewed?: string | boolean
      resetNewCount?: boolean
      name?: string
    }

    const existing = await prisma.savedSearch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      )
    }

    const updateData: {
      emailAlert?: boolean
      desktopAlert?: boolean
      lastViewed?: Date
      newCount?: number
      name?: string
    } = {}

    if (emailAlert !== undefined) updateData.emailAlert = emailAlert
    if (desktopAlert !== undefined) updateData.desktopAlert = desktopAlert
    if (lastViewed === true || lastViewed === undefined) {
      updateData.lastViewed = new Date()
    } else if (typeof lastViewed === 'string') {
      updateData.lastViewed = new Date(lastViewed)
    }
    if (resetNewCount) updateData.newCount = 0
    if (name !== undefined && name.trim()) updateData.name = name.trim()

    const updated = await prisma.savedSearch.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/searches/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
