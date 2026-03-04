// ========================================
// Emotions Data — Single Source of Truth
// ========================================

export const TIERS = {
  red: {
    name: 'RED',
    color: '#ff4444',
    bg: 'rgba(255, 68, 68, 0.1)',
    vibeRange: '20-150',
    vibeLabel: 'Fear',
    vibeValue: 100,
    waveImage: 'assets/vibrations/Vibrations Red.jpg',
    description: 'High calorie negative thoughts that ADD weight to your mind.'
  },
  green: {
    name: 'GREEN',
    color: '#44cc44',
    bg: 'rgba(68, 204, 68, 0.1)',
    vibeRange: '175-350',
    vibeLabel: 'Willing',
    vibeValue: 310,
    waveImage: 'assets/vibrations/Vibrations Green.jpg',
    description: 'Point to yourself and FLIP your RED vibes to BLUE. You have now stopped blaming others for your red.'
  },
  blue: {
    name: 'BLUE',
    color: '#4a9eff',
    bg: 'rgba(74, 158, 255, 0.1)',
    vibeRange: '400-600',
    vibeLabel: 'Love',
    vibeValue: 500,
    waveImage: 'assets/vibrations/Vibrations Blue.jpg',
    description: 'Positive actions that BURN negative thought calories.'
  },
  purple: {
    name: 'PURPLE',
    color: '#aa66ff',
    bg: 'rgba(170, 102, 255, 0.1)',
    vibeRange: '700-900',
    vibeLabel: 'Enlightenment',
    vibeValue: 700,
    waveImage: 'assets/vibrations/Vibrations Purple.jpg',
    description: 'Every synchronicity occurrence = 3,000 calories burned.'
  },
  white: {
    name: 'WHITE',
    color: '#e0e0e0',
    bg: 'rgba(224, 224, 224, 0.08)',
    vibeRange: '901-1000',
    vibeLabel: 'Ultimate Consciousness',
    vibeValue: 1000,
    waveImage: 'assets/vibrations/Vibrations White.png',
    description: 'Intention, meditation, and staying calm burn the most calories.'
  }
};

export const EMOTIONS = [
  // RED — adds calories
  { key: 'guilt',              label: 'Guilt',           tier: 'red',    calories: 1000,  icon: 'TV Super Guilt.png' },
  { key: 'fear',               label: 'Fear',            tier: 'red',    calories: 2000,  icon: 'TV Super Fear.png' },
  { key: 'anger',              label: 'Anger',           tier: 'red',    calories: 3000,  icon: 'TV Super Anger.png' },
  { key: 'doubt',              label: 'Doubt',           tier: 'red',    calories: 4000,  icon: 'TV Super Doubt.png' },
  { key: 'critical',           label: 'Critical',        tier: 'red',    calories: 5000,  icon: 'TV Super Critical.png' },
  // GREEN — burns calories (flips RED to BLUE)
  { key: 'willingness',        label: 'Willingness',     tier: 'green',  calories: -2000, icon: 'TV Super Willingness.png' },
  { key: 'point_self_flip',    label: 'Point Self Flip', tier: 'green',  calories: -3000, icon: 'TV Super Point Self Flip.png' },
  // BLUE — burns calories
  { key: 'big_smile',          label: 'Big Smile',       tier: 'blue',   calories: -1000, icon: 'TV Super Big Smile.png' },
  { key: 'bright_side',        label: 'Bright Side',     tier: 'blue',   calories: -2000, icon: 'TV Super Bright Side.png' },
  { key: 'giving_compliments', label: 'Giving Comps',    tier: 'blue',   calories: -3000, icon: 'TV Super Giving Compliments.png' },
  { key: 'piece_done',         label: 'Piece Done',      tier: 'blue',   calories: -4000, icon: 'TV Super Self-Centered.png' },
  // PURPLE — burns calories
  { key: 'rocket_desire',      label: 'Rocket Desire',   tier: 'purple', calories: -1000, icon: 'TV Super Rocket Desire.png' },
  { key: 'spend_money',        label: 'Spend Money',     tier: 'purple', calories: -2000, icon: 'TV Super Spend Money.png' },
  { key: 'synchronicity',      label: 'Synchronicity',   tier: 'purple', calories: -3000, icon: 'TV Super Synchronicity.png' },
  // WHITE — burns calories
  { key: 'intention',          label: 'Intention',       tier: 'white',  calories: -1000, icon: 'TV Super Intention.png' },
  { key: 'stayed_calm',        label: 'Stayed Calm',     tier: 'white',  calories: -2000, icon: 'TV Super Stayed Calm.png' }
];

// Lookup helpers
export function getEmotionsByTier(tier) {
  return EMOTIONS.filter(e => e.tier === tier);
}

export function getEmotionByKey(key) {
  return EMOTIONS.find(e => e.key === key);
}

export function getEmotionLabel(key) {
  const e = getEmotionByKey(key);
  return e ? e.label : key;
}

export function formatCalories(cal) {
  const sign = cal > 0 ? '+' : '';
  return sign + Math.abs(cal).toLocaleString();
}

export const TIER_ORDER = ['red', 'green', 'blue', 'purple', 'white'];
