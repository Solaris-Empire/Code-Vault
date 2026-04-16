// Shared types + human labels for the generic report system.

export type ReportTargetType =
  | 'job'
  | 'product'
  | 'user'
  | 'review'
  | 'job_application'
  | 'service'
  | 'post'

export type ReportReason =
  | 'spam'
  | 'scam'
  | 'fraud'
  | 'illegal'
  | 'harassment'
  | 'infringement'
  | 'misrepresentation'
  | 'other'

export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed'

export const REPORT_REASON_OPTIONS: { value: ReportReason; label: string; help: string }[] = [
  { value: 'spam',              label: 'Spam or low-quality',      help: 'Repetitive, irrelevant, or auto-generated.' },
  { value: 'scam',              label: 'Scam or MLM',              help: "Promises of unrealistic earnings, 'work from anywhere $5k/week'." },
  { value: 'fraud',             label: 'Fraud',                    help: 'Chargebacks, stolen payment methods, impersonation.' },
  { value: 'illegal',           label: 'Illegal content',          help: 'Violates law in the poster or viewer jurisdiction.' },
  { value: 'harassment',        label: 'Harassment or abuse',      help: 'Attacks on a person or group.' },
  { value: 'infringement',      label: 'Copyright or IP',          help: 'Redistributes content the poster does not own.' },
  { value: 'misrepresentation', label: 'Misrepresents the offer',  help: 'Product/job does not match the description.' },
  { value: 'other',             label: 'Something else',           help: 'Add details below.' },
]
