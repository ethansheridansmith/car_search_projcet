import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const existing = await prisma.savedCar.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Saved car not found' }, { status: 404 })
    }

    await prisma.savedCar.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/saved/[id] error:', error)
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
    const { notes } = body as { notes?: string | null }

    const existing = await prisma.savedCar.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Saved car not found' }, { status: 404 })
    }

    const updated = await prisma.savedCar.update({
      where: { id },
      data: {
        notes: notes !== undefined ? notes : existing.notes,
      },
      include: {
        listing: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/saved/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
