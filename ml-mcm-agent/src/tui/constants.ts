import figures from 'figures';

export const SYMBOLS = {
  // Status indicators
  completed: figures.tick,
  inProgress: figures.play,
  error: figures.cross,
  pending: figures.circle,

  // Navigation and selection
  pointer: figures.pointer,
  pointerSmall: figures.pointerSmall,

  // Scroll indicators
  arrowUp: figures.arrowUp,
  arrowDown: figures.arrowDown,

  // Misc
  bullet: figures.bullet,
  line: figures.line,

  // Checkboxes
  checkboxOn: figures.checkboxOn,
  checkboxOff: figures.checkboxOff,
} as const;

export const COLORS = {
  completed: 'green',
  inProgress: 'yellow',
  inError: 'red',
  pending: 'gray',
} as const;
