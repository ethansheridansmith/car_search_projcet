"use client"

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { formatPrice } from '@/lib/utils'

// ─── Colour palette (mirrors Tailwind chart-1…5 CSS vars) ────────────────────
const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e']

// ─── Shared tooltip formatter ─────────────────────────────────────────────────
const priceTooltip = (value: number) => formatPrice(value)

// ─── 1. Average Price by Year/Model (Line Chart) ──────────────────────────────
interface AvgPricePoint {
  year: number
  model: string
  avgPrice: number
  count: number
}

export function AvgPriceChart({ data }: { data: AvgPricePoint[] }) {
  // Pivot: rows = years, columns = unique models
  const years = Array.from(new Set(data.map(d => d.year))).sort()
  const models = Array.from(new Set(data.map(d => d.model)))

  const pivoted = years.map(year => {
    const row: Record<string, number | string> = { year }
    models.forEach(model => {
      const match = data.find(d => d.year === year && d.model === model)
      if (match) row[model] = match.avgPrice
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={pivoted} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="year" />
        <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={priceTooltip} />
        <Legend />
        {models.map((model, i) => (
          <Line
            key={model}
            type="monotone"
            dataKey={model}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── 2. Price Distribution (Bar Chart) ────────────────────────────────────────
interface PriceDistPoint { range: string; count: number }

export function PriceDistributionChart({ data }: { data: PriceDistPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="range" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" name="Listings" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── 3. Days on Market Distribution (Bar Chart) ───────────────────────────────
interface DaysOnMarketPoint { range: string; count: number }

export function DaysOnMarketChart({ data }: { data: DaysOnMarketPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="range" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" name="Listings" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── 4. Price Drop Frequency by Make (Bar Chart) ──────────────────────────────
interface PriceDropPoint { make: string; dropCount: number; totalListings: number }

export function PriceDropFrequencyChart({ data }: { data: PriceDropPoint[] }) {
  const enriched = data.map(d => ({
    ...d,
    percentage: d.totalListings > 0
      ? Math.round((d.dropCount / d.totalListings) * 100)
      : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={enriched} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="make" tick={{ fontSize: 12 }} />
        <YAxis unit="%" domain={[0, 100]} />
        <Tooltip
          formatter={(value: number, name: string) =>
            name === 'percentage' ? [`${value}%`, 'With Price Drop'] : [value, name]
          }
        />
        <Bar dataKey="percentage" name="% With Price Drop" fill="#22c55e" radius={[4, 4, 0, 0]}>
          {enriched.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── 5. Source Count (Bar Chart) ──────────────────────────────────────────────
interface SourceCountPoint { source: string; count: number }

const SOURCE_COLORS: Record<string, string> = {
  autotrader: '#f97316',
  motors:     '#3b82f6',
  gumtree:    '#22c55e',
  ebay:       '#eab308',
}

const SOURCE_LABELS: Record<string, string> = {
  autotrader: 'AutoTrader',
  motors:     'Motors',
  gumtree:    'Gumtree',
  ebay:       'eBay',
}

export function SourceCountChart({ data }: { data: SourceCountPoint[] }) {
  const labelled = data.map(d => ({ ...d, label: SOURCE_LABELS[d.source] ?? d.source }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={labelled} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" name="Listings" radius={[4, 4, 0, 0]}>
          {labelled.map((d, i) => (
            <Cell key={i} fill={SOURCE_COLORS[d.source] ?? COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
