// Zod schemas for the hire-the-seller API boundaries.

import { z } from 'zod'

export const CreateServiceSchema = z.object({
  tier: z.enum(['vibe', 'real']),
  title: z.string().trim().min(8).max(120),
  shortDescription: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().min(40).max(10_000),
  categoryId: z.string().uuid().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  pricingModel: z.enum(['fixed', 'hourly']),
  priceCents: z.number().int().min(500).max(5_000_000),
  hourlyRateCents: z.number().int().min(500).max(500_000).optional().nullable(),
  minHours: z.number().int().min(1).max(400).optional().nullable(),
  deliveryDays: z.number().int().min(1).max(365),
  revisionsIncluded: z.number().int().min(0).max(10),
  submitForReview: z.boolean().optional(),
})

export type CreateServiceInput = z.infer<typeof CreateServiceSchema>

export const CreateServiceOrderSchema = z.object({
  serviceId: z.string().uuid(),
  brief: z.string().trim().min(40, 'Brief must be at least 40 characters').max(5_000),
  requirements: z.object({}).loose().optional(),
  hours: z.number().int().min(1).max(2_000).optional().nullable(),
})

export type CreateServiceOrderInput = z.infer<typeof CreateServiceOrderSchema>

export const ServiceMessageSchema = z.object({
  body: z.string().trim().min(1).max(4_000),
  attachments: z.array(z.unknown()).max(10).optional(),
})

export type ServiceMessageInput = z.infer<typeof ServiceMessageSchema>

export const DeliveryPayloadSchema = z.object({
  note: z.string().trim().min(10).max(5_000),
  assets: z
    .array(
      z.object({
        url: z.url(),
        name: z.string().trim().min(1).max(200),
        sizeBytes: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(20),
})

export type DeliveryPayload = z.infer<typeof DeliveryPayloadSchema>

export const ServiceReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2_000).optional().nullable(),
})

export type ServiceReviewInput = z.infer<typeof ServiceReviewSchema>

export const ServiceDisputeSchema = z.object({
  reason: z.string().trim().min(20, 'Please describe the issue in at least 20 characters').max(5_000),
  evidence: z
    .array(
      z.object({
        url: z.url(),
        name: z.string().trim().min(1).max(200),
      }),
    )
    .max(10)
    .optional(),
})

export type ServiceDisputeInput = z.infer<typeof ServiceDisputeSchema>
