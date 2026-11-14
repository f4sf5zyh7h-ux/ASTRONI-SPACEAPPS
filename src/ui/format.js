// Display conversions only — everything internal stays SI (CLAUDE.md §2).
export const tonnes = (kg, dp = 1) => `${(kg / 1000).toFixed(dp)} t`;
export const kms = (ms, dp = 2) => `${(ms / 1000).toFixed(dp)} km/s`;
export const kN = (n) => `${Math.round(n / 1000).toLocaleString()} kN`;
export const metres = (m, dp = 1) => `${m.toFixed(dp)} m`;
export const money = (m) => `$${m}M`;
