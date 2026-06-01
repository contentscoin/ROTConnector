import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAdmin } from './auth'

export const list = query({
  args: { kind: v.optional(v.union(v.literal('event'), v.literal('sponsor'))) },
  handler: async (ctx, { kind }) => {
    const events = await ctx.db.query('events').order('desc').collect()
    return kind ? events.filter((e) => e.kind === kind) : events
  },
})

export const get = query({
  args: { id: v.id('events') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})

export const create = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    kind: v.union(v.literal('event'), v.literal('sponsor')),
    body: v.string(),
    date: v.optional(v.string()),
    place: v.optional(v.string()),
    host: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token)
    const title = args.title.trim()
    if (title.length < 2) throw new Error('제목을 입력해주세요.')
    return await ctx.db.insert('events', {
      title,
      kind: args.kind,
      body: args.body,
      date: args.date,
      place: args.place,
      host: args.host,
      status: 'upcoming',
      createdAt: Date.now(),
    })
  },
})
