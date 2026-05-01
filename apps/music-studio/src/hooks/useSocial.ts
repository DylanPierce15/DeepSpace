/**
 * useSocial — social interaction hooks for the community feed.
 */

import { useCallback, useMemo } from 'react'
import { useQuery, useMutations, useUser } from 'deepspace'

export function useTrackInteractions(projectId: string) {
  const { user } = useUser()
  const { records: reactions } = useQuery('track-reactions', { where: { projectId } })
  const { records: comments  } = useQuery('track-comments',  { where: { projectId } })
  const { create, remove }     = useMutations('track-reactions')

  const likes  = useMemo(() => reactions.filter((r: any) => r.data.projectId === projectId && r.data.reactionType === 'like'), [reactions, projectId])
  const plays  = useMemo(() => reactions.filter((r: any) => r.data.projectId === projectId && r.data.reactionType === 'play'), [reactions, projectId])
  const myLike = useMemo(() => likes.find((r: any) => r.createdBy === user?.id), [likes, user])

  const toggleLike = useCallback(() => {
    if (!user) return
    if (myLike) remove(myLike.recordId)
    else create({ projectId, reactionType: 'like' })
  }, [user, myLike, create, remove, projectId])

  return {
    liked:        !!myLike,
    likeCount:    likes.length,
    playCount:    plays.length,
    commentCount: (comments as any[]).filter((c: any) => c.data.projectId === projectId).length,
    toggleLike,
  }
}

export function useTrackPlay(projectId: string) {
  const { user }    = useUser()
  const { records } = useQuery('track-reactions', { where: { projectId } })
  const { create }  = useMutations('track-reactions')

  const hasPlayed = useMemo(
    () => records.some((r: any) => r.createdBy === user?.id && r.data.reactionType === 'play'),
    [records, user]
  )

  const recordPlay = useCallback(() => {
    if (!user || hasPlayed) return
    create({ projectId, reactionType: 'play' })
  }, [user, hasPlayed, create, projectId])

  return { recordPlay }
}

export function useComments(projectId: string) {
  const { user } = useUser()
  const { records, status } = useQuery('track-comments', {
    where:    { projectId },
    orderBy:  'createdAt',
    orderDir: 'asc',
  })
  const { create, remove } = useMutations('track-comments')

  const addComment = useCallback((text: string) => {
    if (!text.trim() || !user) return
    create({
      projectId,
      text:           text.trim(),
      authorName:     user.name ?? 'User',
      authorImageUrl: user.imageUrl ?? '',
    })
  }, [user, create, projectId])

  const deleteComment = useCallback((recordId: string) => {
    remove(recordId)
  }, [remove])

  return {
    comments:     records as any[],
    status,
    addComment,
    deleteComment,
    canDelete: (comment: any) => user?.id === comment.createdBy || user?.role === 'admin',
  }
}

export function useFollow(producerId: string) {
  const { user }    = useUser()
  const { records: followerRecords } = useQuery('producer-follows', { where: { followingId: producerId } })
  const { records: allFollows }      = useQuery('producer-follows')
  const { create, remove } = useMutations('producer-follows')

  const myFollow      = useMemo(() => followerRecords.find((r: any) => r.createdBy === user?.id), [followerRecords, user])
  const followerCount = followerRecords.length
  const followingCount = useMemo(
    () => allFollows.filter((r: any) => r.createdBy === producerId).length,
    [allFollows, producerId]
  )
  const isOwnProfile  = user?.id === producerId

  const toggle = useCallback(() => {
    if (!user || isOwnProfile) return
    if (myFollow) remove(myFollow.recordId)
    else create({ followingId: producerId })
  }, [user, isOwnProfile, myFollow, create, remove, producerId])

  return { following: !!myFollow, followerCount, followingCount, toggle, isOwnProfile }
}

export function useFollowingIds(): string[] {
  const { user }    = useUser()
  const { records } = useQuery('producer-follows')
  return useMemo(
    () => (user ? records.filter((r: any) => r.createdBy === user.id).map((r: any) => r.data.followingId) : []),
    [records, user]
  )
}

export function useProducerStats(producerId: string) {
  const { records: projects } = useQuery('published-projects', { where: { authorId: producerId } })
  const trackCount = (projects as any[]).length
  return { trackCount, projects: projects as any[] }
}
