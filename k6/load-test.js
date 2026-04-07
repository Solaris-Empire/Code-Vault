/**
 * k6 Load Testing Configuration
 *
 * Targets: 50,000+ products, 1,000+ vendors, 100,000+ users
 *
 * Install: https://k6.io/docs/get-started/installation/
 * Run:     k6 run k6/load-test.js
 * Run with env: k6 run -e BASE_URL=https://your-site.vercel.app k6/load-test.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')
const productListLatency = new Trend('product_list_latency', true)
const productDetailLatency = new Trend('product_detail_latency', true)
const searchLatency = new Trend('search_latency', true)
const cartLatency = new Trend('cart_latency', true)
const healthLatency = new Trend('health_check_latency', true)
const pageErrors = new Counter('page_errors')

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Test scenarios
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    // Scenario 1: Normal traffic (browsing customers)
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // Ramp up to 50 users
        { duration: '3m', target: 50 },   // Stay at 50
        { duration: '2m', target: 100 },  // Ramp to 100
        { duration: '3m', target: 100 },  // Stay at 100
        { duration: '1m', target: 0 },    // Ramp down
      ],
      exec: 'browseScenario',
    },

    // Scenario 2: API stress test
    api_stress: {
      executor: 'constant-arrival-rate',
      rate: 100,              // 100 requests per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      exec: 'apiStressScenario',
      startTime: '2m',       // Start after browse ramp-up
    },

    // Scenario 3: Spike test (flash sale simulation)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 200 }, // Sudden spike
        { duration: '1m', target: 200 },  // Maintain
        { duration: '10s', target: 0 },   // Drop off
      ],
      exec: 'spikeScenario',
      startTime: '8m',       // After main tests
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],    // 95% < 2s, 99% < 5s
    http_req_failed: ['rate<0.05'],                      // Error rate < 5%
    errors: ['rate<0.1'],                                // Custom error rate < 10%
    product_list_latency: ['p(95)<1500'],                // Product list < 1.5s
    product_detail_latency: ['p(95)<1000'],              // Product detail < 1s
    search_latency: ['p(95)<2000'],                      // Search < 2s
    health_check_latency: ['p(99)<500'],                 // Health < 500ms
  },
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function checkResponse(res, name) {
  const success = check(res, {
    [`${name} status is 200`]: (r) => r.status === 200,
    [`${name} response time < 3s`]: (r) => r.timings.duration < 3000,
  })
  if (!success) {
    errorRate.add(1)
    pageErrors.add(1)
  } else {
    errorRate.add(0)
  }
  return success
}

// ---------------------------------------------------------------------------
// Scenario: Browse (simulates typical customer journey)
// ---------------------------------------------------------------------------

export function browseScenario() {
  group('Homepage', () => {
    const res = http.get(`${BASE_URL}/`)
    checkResponse(res, 'Homepage')
  })

  sleep(1 + Math.random() * 2)

  group('Product List', () => {
    const start = Date.now()
    const res = http.get(`${BASE_URL}/api/products?limit=20`)
    productListLatency.add(Date.now() - start)
    checkResponse(res, 'Product List API')

    // Parse products and visit a random one
    if (res.status === 200) {
      try {
        const products = JSON.parse(res.body)
        if (Array.isArray(products) && products.length > 0) {
          const randomProduct = products[Math.floor(Math.random() * products.length)]
          if (randomProduct.slug) {
            sleep(0.5 + Math.random())
            const detailStart = Date.now()
            const detailRes = http.get(`${BASE_URL}/products/${randomProduct.slug}`)
            productDetailLatency.add(Date.now() - detailStart)
            checkResponse(detailRes, 'Product Detail')
          }
        }
      } catch { /* ignore parse errors */ }
    }
  })

  sleep(1 + Math.random() * 3)

  group('Categories', () => {
    const res = http.get(`${BASE_URL}/api/categories`)
    checkResponse(res, 'Categories API')
  })

  sleep(1 + Math.random() * 2)

  group('Search', () => {
    const terms = ['milk', 'bread', 'organic', 'chicken', 'rice', 'pasta', 'fruit']
    const term = terms[Math.floor(Math.random() * terms.length)]
    const start = Date.now()
    const res = http.get(`${BASE_URL}/api/search?q=${term}`)
    searchLatency.add(Date.now() - start)
    checkResponse(res, 'Search API')
  })

  sleep(2 + Math.random() * 3)
}

// ---------------------------------------------------------------------------
// Scenario: API Stress (high-frequency API calls)
// ---------------------------------------------------------------------------

export function apiStressScenario() {
  const endpoints = [
    '/api/health',
    '/api/products?limit=10',
    '/api/categories',
    '/api/deals',
    '/api/offers',
  ]

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]
  const start = Date.now()
  const res = http.get(`${BASE_URL}${endpoint}`)

  if (endpoint === '/api/health') {
    healthLatency.add(Date.now() - start)
  }

  checkResponse(res, `API ${endpoint}`)
}

// ---------------------------------------------------------------------------
// Scenario: Spike (flash sale traffic burst)
// ---------------------------------------------------------------------------

export function spikeScenario() {
  // Simulate flash sale - everyone hitting deals page + products
  group('Flash Sale Spike', () => {
    const res = http.get(`${BASE_URL}/api/deals`)
    checkResponse(res, 'Deals (spike)')

    sleep(0.2)

    const prodRes = http.get(`${BASE_URL}/api/products?limit=50`)
    checkResponse(prodRes, 'Products (spike)')

    sleep(0.1 + Math.random() * 0.3)
  })
}

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

export function setup() {
  // Verify target is reachable
  const res = http.get(`${BASE_URL}/api/health`)
  if (res.status !== 200) {
    console.error(`Target ${BASE_URL} is not reachable (status: ${res.status})`)
  }
  return { baseUrl: BASE_URL }
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    scenarios: Object.keys(options.scenarios),
    metrics: {
      http_reqs: data.metrics.http_reqs?.values?.count || 0,
      http_req_duration_p95: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
      http_req_duration_p99: data.metrics.http_req_duration?.values?.['p(99)'] || 0,
      http_req_failed_rate: data.metrics.http_req_failed?.values?.rate || 0,
      error_rate: data.metrics.errors?.values?.rate || 0,
    },
  }

  return {
    'k6/results.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  }
}

// k6 built-in text summary
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'
