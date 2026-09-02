export const CONTRIBUTION_FAB_SIZE = 56;
export const CONTRIBUTION_FAB_MARGIN = 16;
export const CONTRIBUTION_FAB_STACK_SPACE = CONTRIBUTION_FAB_SIZE + CONTRIBUTION_FAB_MARGIN;
export const CONTRIBUTION_FAB_SNAP_VELOCITY = 600;
export const CONTRIBUTION_FAB_PEEK = 20;
export const CONTRIBUTION_FAB_PEEK_ENTER = 10;
export const CONTRIBUTION_FAB_POSITION_KEY = 'contribution-fab-position';

export type ContributionFabBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  peekMinX: number;
  peekMaxX: number;
  screenWidth: number;
  screenHeight: number;
};

export type ContributionFabPoint = {
  x: number;
  y: number;
};

export type ContributionFabSnap = ContributionFabPoint & {
  peeked: boolean;
};

export type ContributionFabStoredPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
  peeked?: boolean;
};

export function shouldShowContributionFab(input: {
  canContribute: boolean;
  isAuthenticated: boolean;
}): boolean {
  return input.canContribute || input.isAuthenticated;
}

export function getContributionFabAccessibilityLabel(input: {
  canContribute: boolean;
  canReportBug: boolean;
}): string {
  if (input.canContribute && input.canReportBug) {
    return 'Suggérer un événement ou signaler un bug';
  }
  if (input.canContribute) {
    return 'Ajouter un événement';
  }
  return 'Reporter un bug ou suggérer une amélioration';
}

export function getContributionFabBounds(input: {
  width: number;
  height: number;
  topInset: number;
  leftInset: number;
  rightInset: number;
  tabBarHeight: number;
}): ContributionFabBounds {
  const minX = Math.max(CONTRIBUTION_FAB_MARGIN, input.leftInset + CONTRIBUTION_FAB_MARGIN);
  const maxX =
    input.width - CONTRIBUTION_FAB_SIZE - Math.max(CONTRIBUTION_FAB_MARGIN, input.rightInset + CONTRIBUTION_FAB_MARGIN);
  const minY = Math.max(CONTRIBUTION_FAB_MARGIN, input.topInset + CONTRIBUTION_FAB_MARGIN);
  const maxY = input.height - input.tabBarHeight - CONTRIBUTION_FAB_MARGIN - CONTRIBUTION_FAB_SIZE;
  return {
    minX,
    maxX: Math.max(minX, maxX),
    minY,
    maxY: Math.max(minY, maxY),
    peekMinX: -CONTRIBUTION_FAB_SIZE + CONTRIBUTION_FAB_PEEK + input.leftInset,
    peekMaxX: input.width - CONTRIBUTION_FAB_PEEK - input.rightInset,
    screenWidth: input.width,
    screenHeight: input.height,
  };
}

export function defaultContributionFabPosition(bounds: ContributionFabBounds): ContributionFabSnap {
  return { x: bounds.maxX, y: bounds.maxY, peeked: false };
}

export function clampContributionFabPosition(
  x: number,
  y: number,
  bounds: ContributionFabBounds,
): ContributionFabPoint {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
  };
}

export function clampContributionFabDragPosition(
  x: number,
  y: number,
  bounds: ContributionFabBounds,
): ContributionFabPoint {
  return {
    x: Math.min(bounds.peekMaxX, Math.max(bounds.peekMinX, x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
  };
}

export function contributionFabSide(
  x: number,
  bounds: ContributionFabBounds,
  velocityX = 0,
): 'left' | 'right' {
  if (velocityX <= -CONTRIBUTION_FAB_SNAP_VELOCITY) return 'left';
  if (velocityX >= CONTRIBUTION_FAB_SNAP_VELOCITY) return 'right';
  return x + CONTRIBUTION_FAB_SIZE / 2 < bounds.screenWidth / 2 ? 'left' : 'right';
}

export function snapContributionFabToEdge(
  x: number,
  y: number,
  bounds: ContributionFabBounds,
  velocityX = 0,
): ContributionFabPoint {
  const side = contributionFabSide(x, bounds, velocityX);
  return clampContributionFabPosition(side === 'left' ? bounds.minX : bounds.maxX, y, bounds);
}

export function resolveContributionFabRelease(
  x: number,
  y: number,
  bounds: ContributionFabBounds,
  velocityX = 0,
): ContributionFabSnap {
  const side = contributionFabSide(x, bounds, velocityX);
  const dockedX = side === 'left' ? bounds.minX : bounds.maxX;
  const peekX = side === 'left' ? bounds.peekMinX : bounds.peekMaxX;
  const peekMid = (dockedX + peekX) / 2;
  const pushedPastDock =
    side === 'left' ? x <= bounds.minX - CONTRIBUTION_FAB_PEEK_ENTER : x >= bounds.maxX + CONTRIBUTION_FAB_PEEK_ENTER;
  const nearDocked = side === 'left' ? x <= bounds.minX + 8 : x >= bounds.maxX - 8;
  const shoveOffScreen =
    nearDocked &&
    (side === 'left'
      ? velocityX <= -CONTRIBUTION_FAB_SNAP_VELOCITY
      : velocityX >= CONTRIBUTION_FAB_SNAP_VELOCITY);
  const alreadyPeeked = side === 'left' ? x <= peekMid : x >= peekMid;
  const peeked = pushedPastDock || shoveOffScreen || alreadyPeeked;
  const nextY = Math.min(bounds.maxY, Math.max(bounds.minY, y));
  return { x: peeked ? peekX : dockedX, y: nextY, peeked };
}

export function parseContributionFabStoredPosition(raw: string | null): ContributionFabStoredPosition | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ContributionFabStoredPosition>;
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number' ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number' ||
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y) ||
      !Number.isFinite(parsed.width) ||
      !Number.isFinite(parsed.height) ||
      parsed.width <= 0 ||
      parsed.height <= 0
    ) {
      return null;
    }
    return {
      x: parsed.x,
      y: parsed.y,
      width: parsed.width,
      height: parsed.height,
      peeked: parsed.peeked === true,
    };
  } catch {
    return null;
  }
}

export function restoreContributionFabPosition(
  stored: ContributionFabStoredPosition | null,
  bounds: ContributionFabBounds,
): ContributionFabSnap {
  if (!stored) return defaultContributionFabPosition(bounds);
  const wasLeft = stored.x + CONTRIBUTION_FAB_SIZE / 2 < stored.width / 2;
  const yRatio = stored.y / stored.height;
  const docked = snapContributionFabToEdge(
    wasLeft ? bounds.minX : bounds.maxX,
    yRatio * bounds.screenHeight,
    bounds,
  );
  if (!stored.peeked) return { ...docked, peeked: false };
  return {
    x: wasLeft ? bounds.peekMinX : bounds.peekMaxX,
    y: docked.y,
    peeked: true,
  };
}
