import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: { status: string; latency_ms: number }
    memory: { used_mb: number; rss_mb: number; heap_total_mb: number }
    environment: { node_version: string; next_env: string }
  }
}

const startTime = Date.now()

export async function GET() {
  const checks: HealthCheck['checks'] = {
    database: { status: 'unknown', latency_ms: 0 },
    memory: { used_mb: 0, rss_mb: 0, heap_total_mb: 0 },
    environment: {
      node_version: process.version,
      next_env: process.env.NODE_ENV || 'unknown',
    },
  }

  let overallStatus: HealthCheck['status'] = 'healthy'

  // Database check
  try {
    const dbStart = Date.now()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('products').select('id').limit(1)
    const dbLatency = Date.now() - dbStart

    if (error) {
      checks.database = { status: 'error', latency_ms: dbLatency }
      overallStatus = 'unhealthy'
    } else {
      checks.database = {
        status: dbLatency > 1000 ? 'slow' : 'ok',
        latency_ms: dbLatency,
      }
      if (dbLatency > 1000) overallStatus = 'degraded'
    }
  } catch {
    checks.database = { status: 'unreachable', latency_ms: 0 }
    overallStatus = 'unhealthy'
  }

  // Memory check
  const mem = process.memoryUsage()
  checks.memory = {
    used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    rss_mb: Math.round(mem.rss / 1024 / 1024),
    heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
  }

  if (checks.memory.used_mb > 450) {
    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus
  }

  const health: HealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: Math.round((Date.now() - startTime) / 1000),
    checks,
  }

  return NextResponse.json(health, {
    status: overallStatus === 'unhealthy' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
