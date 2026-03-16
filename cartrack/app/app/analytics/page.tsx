"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice, formatMileage } from "@/lib/utils"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface AnalyticsData {
  totalListings: number
  avgPrice: number
  avgMileage: number
  activeSources: string[]
  priceByYearModel: Array<{ year: number; [model: string]: number }>
  priceDistribution: Array<{ range: string; count: number }>
  daysOnMarketDistribution: Array<{ range: string; count: number }>
  priceDropByMake: Array<{ make: string; dropCount: number; total: number }>
}

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(270, 60%, 58%)",
  "hsl(186, 80%, 42%)",
]

function StatCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function SkeletonStatCard() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="h-4 w-28 mb-2" />
        <Skeleton className="h-9 w-36" />
      </CardContent>
    </Card>
  )
}

function SkeletonChart() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const { toast } = useToast()
  const [data, setData] = React.useState<AnalyticsData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch("/api/analytics")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => setData(d))
      .catch(() => {
        toast({ title: "Error", description: "Failed to load analytics", variant: "destructive" })
      })
      .finally(() => setLoading(false))
  }, [])

  // Derive model keys for the line chart
  const modelKeys = React.useMemo(() => {
    if (!data?.priceByYearModel) return []
    const keys = new Set<string>()
    data.priceByYearModel.forEach((row) => {
      Object.keys(row).forEach((k) => { if (k !== "year") keys.add(k) })
    })
    return Array.from(keys)
  }, [data])

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Market insights from your tracked listings</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Listings"
              value={(data?.totalListings ?? 0).toLocaleString()}
              sub="across all sources"
            />
            <StatCard
              title="Average Price"
              value={data ? formatPrice(Math.round(data.avgPrice)) : "—"}
              sub="across active listings"
            />
            <StatCard
              title="Average Mileage"
              value={data ? formatMileage(Math.round(data.avgMileage)) : "—"}
              sub="across active listings"
            />
            <StatCard
              title="Active Sources"
              value={String(data?.activeSources?.length ?? 0)}
              sub={data?.activeSources?.join(", ") ?? ""}
            />
          </>
        )}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Average Price by Year & Model */}
        {loading ? (
          <SkeletonChart />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Average Price by Year & Model</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data?.priceByYearModel ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                    width={50}
                  />
                  <Tooltip formatter={(v: number) => formatPrice(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {modelKeys.map((model, i) => (
                    <Line
                      key={model}
                      type="monotone"
                      dataKey={model}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 2. Price Distribution */}
        {loading ? (
          <SkeletonChart />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Price Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.priceDistribution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Listings" radius={[4, 4, 0, 0]}>
                    {(data?.priceDistribution ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[0]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 3. Days on Market Distribution */}
        {loading ? (
          <SkeletonChart />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Days on Market Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.daysOnMarketDistribution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Listings" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 4. Price Drop Frequency by Make */}
        {loading ? (
          <SkeletonChart />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Price Drop Frequency by Make</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.priceDropByMake ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="make" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total" name="Total listings" fill={COLORS[4]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="dropCount" name="With price drop" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
