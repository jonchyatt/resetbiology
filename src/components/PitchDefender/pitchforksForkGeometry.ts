import type { TineCount } from './pitchforksCurriculum'

export type ForkPoint = Readonly<{ x: number; y: number }>

export type ForkVillagerMeta = Readonly<{
  frame_w: number
  frame_h: number
  fork_base: ForkPoint
  fork_base_frames?: readonly ForkPoint[]
  /** Grip in each authored burned pose (index = burn - 1); hunched poses hold the fork lower. */
  fork_base_burned?: readonly ForkPoint[]
}>

export type ForkStateMeta = Readonly<{
  burn: number
  image: string
  glow: string
  remaining_tines: readonly Readonly<{ id: number; tip: ForkPoint }>[]
  active_tine_id: number | null
}>

export type ForkFamilyMeta = Readonly<{
  source_size: Readonly<{ w: number; h: number }>
  handle_pivot: ForkPoint
  lean_deg: number
  states: readonly ForkStateMeta[]
}>

export type ForkMetaDocument = Readonly<{
  schemaVersion: 2
  units: string
  builder?: string
  families: Readonly<Record<`${TineCount}tine`, ForkFamilyMeta>>
}>

export type ForkGeometryAssets = Readonly<{
  villagerMeta: Readonly<Record<TineCount, ForkVillagerMeta>>
  forkMeta: Readonly<Record<TineCount, ForkFamilyMeta>>
}>

export type ForkWorldGeometry = Readonly<{
  assetKey: string
  glowKey: string
  grip: ForkPoint
  pivot: ForkPoint
  draw: Readonly<{
    x: number
    y: number
    width: number
    height: number
    rotationRad: 0
    mirrorX: false
    handlePivot: ForkPoint
  }>
  remainingTips: readonly Readonly<{ id: number; source: ForkPoint; world: ForkPoint }>[]
  activeTip: Readonly<{ id: number; source: ForkPoint; world: ForkPoint }> | null
}>

const BODY_SPRITE_SCALE = 3

export function forkWorldGeometry(
  pose: Readonly<{
    x: number
    y: number
    totalTines: TineCount
    burn: number
    walkFrame: number
    useWalkGrip: boolean
    tineIndex: number | null
  }>,
  assets: Pick<ForkGeometryAssets, 'villagerMeta' | 'forkMeta'>,
): ForkWorldGeometry {
  const villager = assets.villagerMeta[pose.totalTines]
  const family = assets.forkMeta[pose.totalTines]
  if (!villager || !family) throw new Error(`Missing ${pose.totalTines}-tine fork geometry metadata`)

  const burn = Math.max(0, Math.min(pose.totalTines, Math.trunc(pose.burn)))
  const state = family.states.find(candidate => candidate.burn === burn)
  if (!state) throw new Error(`Missing ${pose.totalTines}-tine fork burn state ${burn}`)

  const frames = villager.fork_base_frames
  const walkGrip = pose.useWalkGrip && burn === 0 && frames && frames.length > 0
    ? frames[((Math.trunc(pose.walkFrame) % frames.length) + frames.length) % frames.length]
    : null
  const burnedGrip = !walkGrip && burn > 0 ? villager.fork_base_burned?.[burn - 1] : undefined
  const grip = walkGrip ?? burnedGrip ?? villager.fork_base
  const pivot = {
    x: pose.x + (villager.frame_w - grip.x) * BODY_SPRITE_SCALE,
    y: pose.y + grip.y * BODY_SPRITE_SCALE,
  }
  const drawX = Math.round(pivot.x - family.handle_pivot.x)
  const drawY = Math.round(pivot.y - family.handle_pivot.y)
  const remainingTips = state.remaining_tines.map(tine => ({
    id: tine.id,
    source: tine.tip,
    world: { x: drawX + tine.tip.x, y: drawY + tine.tip.y },
  }))
  const targetTineId = pose.tineIndex ?? state.active_tine_id

  return {
    assetKey: state.image,
    glowKey: state.glow,
    grip,
    pivot,
    draw: {
      x: drawX,
      y: drawY,
      width: family.source_size.w,
      height: family.source_size.h,
      rotationRad: 0,
      mirrorX: false,
      handlePivot: family.handle_pivot,
    },
    remainingTips,
    activeTip: targetTineId === null
      ? null
      : remainingTips.find(tine => tine.id === targetTineId) ?? null,
  }
}
