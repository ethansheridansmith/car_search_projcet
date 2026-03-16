"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import type { Settings } from '@/lib/types'
import {
  Settings2, Wifi, Mail, Play, CheckCircle2,
  AlertCircle, Loader2, Clock, Eye, EyeOff,
} from 'lucide-react'

type ScraperStatus = {
  is_running: boolean
  last_run: string | null
  total_scraped: number
  errors: string[]
}

export default function SettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus | null>(null)
  const [showSmtpPass, setShowSmtpPass] = useState(false)

  useEffect(() => {
    fetchSettings()
    fetchScraperStatus()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      setSettings(await res.json())
    } catch (e) {
      toast({ title: 'Error', description: 'Could not load settings.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function fetchScraperStatus() {
    try {
      const res = await fetch('/api/scrape')
      if (res.ok) setScraperStatus(await res.json())
    } catch {
      // scraper may not be running
    }
  }

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Saved', description: 'Settings updated successfully.' })
    } catch {
      toast({ title: 'Error', description: 'Could not save settings.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function triggerScrape() {
    setScraping(true)
    try {
      const res = await fetch('/api/scrape', { method: 'POST' })
      if (!res.ok) throw new Error()
      toast({ title: 'Scrape started', description: 'The scraper is now running in the background.' })
      setTimeout(fetchScraperStatus, 3000)
    } catch {
      toast({ title: 'Scraper offline', description: 'Could not reach the scraper. Is it running?', variant: 'destructive' })
    } finally {
      setScraping(false)
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="h-6 w-6" /> Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configure CarTrack defaults and integrations.</p>
      </div>

      {/* ── Section 1: Search Defaults ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Defaults</CardTitle>
          <CardDescription>Pre-fill values used across all searches.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="postcode">Default Postcode</Label>
              <Input
                id="postcode"
                value={settings.postcode}
                onChange={e => update('postcode', e.target.value)}
                placeholder="BS7 8NE"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Scraper ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-4 w-4" /> Scraper
          </CardTitle>
          <CardDescription>Configure scraping schedule and sources.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Status banner */}
          <div className={`flex items-center gap-3 p-3 rounded-lg text-sm ${
            scraperStatus
              ? scraperStatus.is_running
                ? 'bg-blue-50 text-blue-800'
                : 'bg-green-50 text-green-800'
              : 'bg-gray-50 text-gray-600'
          }`}>
            {scraperStatus ? (
              scraperStatus.is_running ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Scraper is running…</>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Idle{scraperStatus.last_run
                    ? ` · Last run: ${new Date(scraperStatus.last_run).toLocaleTimeString('en-GB')}`
                    : ''}
                  {scraperStatus.total_scraped > 0 && ` · ${scraperStatus.total_scraped} listings scraped`}
                </>
              )
            ) : (
              <><AlertCircle className="h-4 w-4" /> Scraper offline — start it with <code className="font-mono bg-gray-100 px-1 rounded">uvicorn main:app --port 8001</code></>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Scrape Interval</Label>
              <Select
                value={String(settings.scrapeIntervalMinutes)}
                onValueChange={v => update('scrapeIntervalMinutes', Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every 60 minutes</SelectItem>
                  <SelectItem value="120">Every 2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max Results per Source</Label>
              <Select
                value={String(settings.maxResultsPerSource)}
                onValueChange={v => update('maxResultsPerSource', Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 results</SelectItem>
                  <SelectItem value="50">50 results</SelectItem>
                  <SelectItem value="100">100 results</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Enabled Sources</Label>
            {(
              [
                { key: 'autotraderEnabled' as const, label: 'AutoTrader UK' },
                { key: 'motorsEnabled' as const, label: 'Motors.co.uk' },
                { key: 'gumtreeEnabled' as const, label: 'Gumtree Cars' },
                { key: 'ebayEnabled' as const, label: 'eBay Motors UK' },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={settings[key]}
                  onCheckedChange={v => update(key, v)}
                />
              </div>
            ))}
          </div>

          <Separator />

          <Button
            onClick={triggerScrape}
            disabled={scraping}
            className="flex items-center gap-2"
            variant="secondary"
          >
            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Scrape Now
          </Button>
        </CardContent>
      </Card>

      {/* ── Section 3: Email Alerts ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Email Alerts
          </CardTitle>
          <CardDescription>Receive email notifications for new matching listings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="emailEnabled">Enable Email Alerts</Label>
            <Switch
              id="emailEnabled"
              checked={settings.emailEnabled}
              onCheckedChange={v => update('emailEnabled', v)}
            />
          </div>

          {settings.emailEnabled && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    value={settings.smtpHost ?? ''}
                    onChange={e => update('smtpHost', e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={settings.smtpPort ?? 587}
                    onChange={e => update('smtpPort', Number(e.target.value))}
                    placeholder="587"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="smtpUser">Username</Label>
                  <Input
                    id="smtpUser"
                    value={settings.smtpUser ?? ''}
                    onChange={e => update('smtpUser', e.target.value)}
                    placeholder="you@gmail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtpPass">Password</Label>
                  <div className="relative">
                    <Input
                      id="smtpPass"
                      type={showSmtpPass ? 'text' : 'password'}
                      value={settings.smtpPass ?? ''}
                      onChange={e => update('smtpPass', e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alertEmail">Send Alerts To</Label>
                <Input
                  id="alertEmail"
                  type="email"
                  value={settings.alertEmail ?? ''}
                  onChange={e => update('alertEmail', e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end pb-8">
        <Button onClick={saveSettings} disabled={saving} size="lg" className="flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Save Settings
        </Button>
      </div>

      <Toaster />
    </div>
  )
}
