/**
 * Tasks/Challenges Feature - Schema
 * 
 * A claimable task system demonstrating:
 * - 'unclaimed-or-own' permission for claiming unclaimed items
 * - writableFields for restricting which fields users can update
 * - timestampTrigger for automatic timestamp fields
 * - Admin-only grading workflow
 */

import type { CollectionSchema } from 'deepspace/worker'

export const challengesSchema: CollectionSchema = {
  name: 'challenges',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'description', storage: 'text', interpretation: 'plain', required: true },
    { name: 'difficulty', storage: 'text', interpretation: 'plain', default: 'medium' },
    { name: 'points', storage: 'number', interpretation: 'plain', default: 10 },
    // Claim fields
    { name: 'claimedById', storage: 'text', interpretation: 'plain' },
    { name: 'claimedAt', storage: 'text', interpretation: 'plain', timestampTrigger: { field: 'claimedById' } },
    // Submission fields
    { name: 'submitted', storage: 'number', interpretation: { kind: 'boolean' }, default: false },
    { name: 'submissionUrl', storage: 'text', interpretation: 'plain' },
    { name: 'submissionNotes', storage: 'text', interpretation: 'plain' },
    { name: 'submittedAt', storage: 'text', interpretation: 'plain', timestampTrigger: { field: 'submitted', value: true } },
    // Grading fields (admin only)
    { name: 'grade', storage: 'text', interpretation: 'plain' },
    { name: 'feedback', storage: 'text', interpretation: 'plain' },
    { name: 'gradedById', storage: 'text', interpretation: 'plain' },
    { name: 'gradedAt', storage: 'text', interpretation: 'plain', timestampTrigger: { field: 'grade' } },
    // Creator
    { name: 'createdById', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  ownerField: 'claimedById', // For 'own' and 'unclaimed-or-own' checks
  permissions: {
    viewer: { 
      read: true,  // Can see all challenges
      create: false, 
      update: false, 
      delete: false,
    },
    member: { 
      read: true, 
      create: true,  // Can create new challenges
      update: 'unclaimed-or-own',  // Can claim unclaimed OR update own claimed
      delete: 'own',
      // Members can only update these fields
      writableFields: [
        'claimedById',  // Claim field
        'submitted', 'submissionUrl', 'submissionNotes',  // Submission fields
      ],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
