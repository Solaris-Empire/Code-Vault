import sanitizeHtml from 'sanitize-html'

/**
 * Configuration for different sanitization levels
 */
const sanitizeConfigs = {
  // Strict - no HTML allowed (for text-only fields)
  strict: {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard' as const
  },

  // Basic - only basic formatting allowed
  basic: {
    allowedTags: ['b', 'i', 'em', 'strong', 'br'],
    allowedAttributes: {},
    disallowedTagsMode: 'discard' as const
  },

  // Rich - more formatting but no scripts
  rich: {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'b', 'i', 'em', 'strong', 'u', 's',
      'a', 'blockquote', 'code', 'pre'
    ],
    allowedAttributes: {
      'a': ['href', 'title', 'target', 'rel']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard' as const,
    transformTags: {
      'a': (tagName: string, attribs: Record<string, string>) => {
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        }
      }
    }
  },

  // Email - for email templates (more permissive but still safe)
  email: {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'div', 'span',
      'ul', 'ol', 'li',
      'b', 'i', 'em', 'strong', 'u',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    allowedAttributes: {
      '*': ['style', 'class'],
      'a': ['href', 'title', 'target'],
      'img': ['src', 'alt', 'width', 'height'],
      'table': ['width', 'border', 'cellpadding', 'cellspacing'],
      'td': ['width', 'height', 'align', 'valign'],
      'th': ['width', 'height', 'align', 'valign']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard' as const
  }
}

/**
 * Sanitize HTML content - strict mode (no HTML)
 * Use for: review titles, product names, user names
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''
  return sanitizeHtml(input.trim(), sanitizeConfigs.strict)
}

/**
 * Sanitize HTML content - basic formatting allowed
 * Use for: review content, short descriptions
 */
export function sanitizeBasicHtml(input: string | null | undefined): string {
  if (!input) return ''
  return sanitizeHtml(input.trim(), sanitizeConfigs.basic)
}

/**
 * Sanitize HTML content - rich formatting allowed
 * Use for: product descriptions, blog posts
 */
export function sanitizeRichHtml(input: string | null | undefined): string {
  if (!input) return ''
  return sanitizeHtml(input.trim(), sanitizeConfigs.rich)
}

/**
 * Sanitize HTML for email templates
 * Use for: email body content
 */
export function sanitizeEmailHtml(input: string | null | undefined): string {
  if (!input) return ''
  return sanitizeHtml(input.trim(), sanitizeConfigs.email)
}

/**
 * Escape HTML entities for display in text context
 */
export function escapeHtml(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Sanitize a URL to prevent javascript: and data: attacks
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return ''

  const trimmed = url.trim().toLowerCase()

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:']
  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      return ''
    }
  }

  // Allow only http, https, mailto, tel
  const allowedProtocols = ['http://', 'https://', 'mailto:', 'tel:']
  const hasAllowedProtocol = allowedProtocols.some(p => trimmed.startsWith(p)) || (trimmed.startsWith('/') && !trimmed.startsWith('//'))

  if (!hasAllowedProtocol && trimmed.includes(':')) {
    return ''
  }

  return url.trim()
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string | null | undefined): string {
  if (!filename) return ''

  return filename
    .replace(/\.\./g, '') // Remove path traversal
    .replace(/[/\\]/g, '') // Remove slashes
    .replace(/[<>:"|?*]/g, '') // Remove invalid chars
    .trim()
}

/**
 * Sanitize search query to prevent injection
 */
export function sanitizeSearchQuery(query: string | null | undefined): string {
  if (!query) return ''

  return query
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/['";]/g, '') // Remove quotes and semicolons
    .trim()
    .slice(0, 500) // Limit length
}

/**
 * Sanitize object keys and string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  htmlFields: string[] = []
): T {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeText(key)

    if (typeof value === 'string') {
      result[sanitizedKey] = htmlFields.includes(key)
        ? sanitizeRichHtml(value)
        : sanitizeText(value)
    } else if (Array.isArray(value)) {
      result[sanitizedKey] = value.map(item =>
        typeof item === 'string' ? sanitizeText(item) : item
      )
    } else if (value && typeof value === 'object') {
      result[sanitizedKey] = sanitizeObject(value as Record<string, unknown>, htmlFields)
    } else {
      result[sanitizedKey] = value
    }
  }

  return result as T
}

/**
 * Strip all HTML tags and return plain text
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return ''
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Truncate text safely (won't break HTML entities)
 */
export function truncateText(
  input: string | null | undefined,
  maxLength: number,
  suffix: string = '...'
): string {
  if (!input) return ''
  const stripped = stripHtml(input)
  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength - suffix.length).trim() + suffix
}
