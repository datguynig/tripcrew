export const easeOutExpo = [0.22, 1, 0.36, 1] as const;
export const easeOutQuart = [0.16, 1, 0.3, 1] as const;
export const easeInOutSoft = [0.65, 0, 0.35, 1] as const;

export const duration = {
  reveal: 0.7,
  revealLong: 0.9,
  hover: 0.18,
  tap: 0.12,
  crossfade: 0.7,
  expand: 0.36,
  kenBurns: 12,
} as const;

export const stagger = {
  tile: 0.07,
  row: 0.09,
  column: 0.12,
  word: 0.08,
  chat: 0.32,
} as const;
