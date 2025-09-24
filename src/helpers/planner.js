// filepath: src/helpers/planner.js
// Planner algorithm: compute minimal-merge plan to reach defensive goals within socket limits
// Uses POWER_STONES definitions and existing helper assumptions

import { POWER_STONES } from '../constants/powerStones.js';

// Hard-coded socket limits to match game rules
export const SOCKET_LIMITS = {
  defensive: 12,
  offensive: 8
};

// Map human goal names to defensive stat keys used in POWER_STONES and their stone types
const DEFENSIVE_GOAL_MAP = (() => {
  const map = new Map();
  // Build from POWER_STONES defensive names
  Object.entries(POWER_STONES).forEach(([type, data]) => {
    const stat = data.defensive; // e.g., 'Dodge', 'ZDR', 'DR', 'HP', 'MS', 'XP', 'Deep Freeze', 'Poison Resistance'
    if (!map.has(stat)) map.set(stat, new Set());
    map.get(stat).add(type);
  });
  // Add synonyms
  const addSyn = (syn, canonical) => {
    map.set(syn, map.get(canonical) || new Set());
  };
  addSyn('Dodge Chance', 'Dodge');
  addSyn('Zombie Damage Reduction', 'ZDR');
  addSyn('Damage Reduction', 'DR');
  addSyn('Movement Speed', 'MS');
  addSyn('Stun Chance', 'Stun');
  addSyn('Experience', 'XP');
  addSyn('Poison Resist', 'Poison Resistance');
  return map;
})();

const normalizeGoalName = (name) => {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (DEFENSIVE_GOAL_MAP.has(trimmed)) return trimmed;
  // Try case-insensitive match
  for (const key of DEFENSIVE_GOAL_MAP.keys()) {
    if (key.toLowerCase() === trimmed.toLowerCase()) return key;
  }
  // Special short forms
  const lower = trimmed.toLowerCase();
  if (lower === 'zdr') return 'ZDR';
  if (lower === 'dr' ) return 'DR';
  if (lower === 'xp' ) return 'XP';
  if (lower === 'ms' ) return 'MS';
  if (lower === 'hp' ) return 'HP';
  return trimmed;
};

// Get level 7 defensive value for a stone type
const lv7DefVal = (type) => {
  const data = POWER_STONES[type];
  return data?.defensiveLevels?.[6] || 0; // index 6 => level 7
};

// Build target stats from user goals
export function buildTargets(goalsInput) {
  // goalsInput: array of { stat: string, value: number }
  const targets = [];
  const typesNeeded = new Set();
  goalsInput.forEach((g) => {
    const inputKey = normalizeGoalName(g.stat);
    const value = Math.max(0, Number(g.value) || 0);
    const types = DEFENSIVE_GOAL_MAP.get(inputKey);
    if (!types || types.size === 0 || value <= 0) return;
    const typeList = Array.from(types);
    typeList.forEach((t) => {
      const canonicalStat = POWER_STONES[t].defensive; // ensure key matches item.contrib keys
      targets.push({ stat: canonicalStat, type: t, goal: value, perL7: lv7DefVal(t) });
      typesNeeded.add(t);
    });
  });
  // Consolidate in case of duplicates
  const consolidated = Object.values(
    targets.reduce((acc, x) => {
      const k = `${x.stat}|${x.type}`;
      if (!acc[k]) acc[k] = { ...x };
      else acc[k].goal += x.goal;
      return acc;
    }, {})
  );
  return { targets: consolidated, typesNeeded: Array.from(typesNeeded) };
}

// Inventory model
// inv = {
//   l7: { [type]: count },
//   supers: [ { primary: type, secondary: type, qty } ],
//   megas: [ { primary: type, secondary: type, tertiary: type, qty } ]
// }

// Candidate item factory
function makeItem(kind, parts, mergesCost, label) {
  const socket = 1;
  const uses = { l7: {}, super: null, mega: null };
  const contrib = {}; // per target stat name
  // Defensive contributions only
  const addType = (type, factor) => {
    const val = lv7DefVal(type) * factor;
    if (val <= 0) return;
    const stat = POWER_STONES[type].defensive;
    contrib[stat] = (contrib[stat] || 0) + val;
  };

  if (kind === 'regular') {
    const [t] = parts;
    uses.l7[t] = 1;
    addType(t, 1);
  } else if (kind === 'super') {
    const [p, s] = parts;
    uses.l7[p] = (uses.l7[p] || 0) + 1;
    uses.l7[s] = (uses.l7[s] || 0) + 1;
    addType(p, 1);
    addType(s, 0.5);
  } else if (kind === 'mega') {
    const [a, b, c] = parts;
    uses.l7[a] = (uses.l7[a] || 0) + 1;
    uses.l7[b] = (uses.l7[b] || 0) + 1;
    uses.l7[c] = (uses.l7[c] || 0) + 1;
    addType(a, 1);
    addType(b, 0.5);
    addType(c, 0.5);
  } else if (kind === 'super-existing') {
    const [p, s] = parts;
    uses.super = { primary: p, secondary: s };
    addType(p, 1);
    addType(s, 0.5);
  } else if (kind === 'mega-existing') {
    const [a, b, c] = parts;
    uses.mega = { primary: a, secondary: b, tertiary: c };
    addType(a, 1);
    addType(b, 0.5);
    addType(c, 0.5);
  } else if (kind === 'upgrade-super-to-mega') {
    const [p, s, t] = parts; // existing super(p,s) + l7[t]
    uses.super = { primary: p, secondary: s };
    uses.l7[t] = (uses.l7[t] || 0) + 1;
    addType(p, 1);
    addType(s, 0.5);
    addType(t, 0.5);
  }

  return { kind, parts, mergesCost, socket, uses, contrib, label };
}

// Build candidate catalog based on targets to keep branching small
function buildCandidates(targets, inv) {
  const targetTypes = new Set(targets.map(t => t.type));
  const typeList = Array.from(targetTypes);
  const items = [];

  // Existing megas and supers as zero-merge options (limited by qty)
  (inv?.megas || []).forEach(m => {
    if (!targetTypes.has(m.primary) && !targetTypes.has(m.secondary) && !targetTypes.has(m.tertiary)) return;
    items.push({ ...makeItem('mega-existing', [m.primary, m.secondary, m.tertiary], 0, `Existing Mega ${m.primary}+${m.secondary}+${m.tertiary}`), maxQty: m.qty|0 });
  });
  (inv?.supers || []).forEach(s => {
    if (!targetTypes.has(s.primary) && !targetTypes.has(s.secondary)) return;
    items.push({ ...makeItem('super-existing', [s.primary, s.secondary], 0, `Existing Super ${s.primary}+${s.secondary}`), maxQty: s.qty|0 });
  });

  // Regular L7 of target types (bounded by l7 inventory)
  typeList.forEach(t => {
    items.push({ ...makeItem('regular', [t], 0, `L7 ${t}`), maxQty: inv?.l7?.[t] ?? 0 });
  });

  // New supers between target types (A!=B), unlimited count but bounded by L7 inventory at runtime
  typeList.forEach(a => {
    typeList.forEach(b => {
      if (a === b) return;
      items.push({ ...makeItem('super', [a, b], 1, `Super ${a}+${b}`), maxQty: Infinity });
    });
  });

  // New megas among target types (distinct) — dedup permutations, include each primary choice once
  const sortedTypes = [...typeList].sort();
  for (let i = 0; i < sortedTypes.length; i++) {
    for (let j = i + 1; j < sortedTypes.length; j++) {
      for (let k = j + 1; k < sortedTypes.length; k++) {
        const a = sortedTypes[i], b = sortedTypes[j], c = sortedTypes[k];
        // Three primary choices per set; secondaries unordered
        items.push({ ...makeItem('mega', [a, b, c], 2, `Mega ${a}+${b}+${c}`), maxQty: Infinity }); // primary a
        items.push({ ...makeItem('mega', [b, a, c], 2, `Mega ${b}+${a}+${c}`), maxQty: Infinity }); // primary b
        items.push({ ...makeItem('mega', [c, a, b], 2, `Mega ${c}+${a}+${b}`), maxQty: Infinity }); // primary c
      }
    }
  }

  // Upgrades: existing super(p,s) -> mega(p,s,t) for any t not equal to p or s
  (inv?.supers || []).forEach(s => {
    typeList.forEach(t => {
      if (t === s.primary || t === s.secondary) return;
      items.push({ ...makeItem('upgrade-super-to-mega', [s.primary, s.secondary, t], 1, `Upgrade Super ${s.primary}+${s.secondary} -> +${t}`), maxQty: s.qty|0 });
    });
  });

  return items;
}

function cloneInv(inv) {
  return {
    l7: { ...(inv?.l7 || {}) },
    supers: (inv?.supers || []).map(s => ({ ...s })),
    megas: (inv?.megas || []).map(m => ({ ...m }))
  };
}

function canUseItem(item, inv) {
  // Respect quantities for existing super/mega stones only.
  // Level 7 stones are assumed craftable; we won't constrain by L7 inventory here
  // so we can compute missing L7 after planning.
  if (item.uses.mega) {
    const { primary, secondary, tertiary } = item.uses.mega;
    const found = inv.megas.find(
      (m) =>
        m.primary === primary &&
        m.secondary === secondary &&
        m.tertiary === tertiary &&
        (m.qty || 0) > 0
    );
    if (!found) return false;
  }
  if (item.uses.super) {
    const { primary, secondary } = item.uses.super;
    const found = inv.supers.find(
      (s) => s.primary === primary && s.secondary === secondary && (s.qty || 0) > 0
    );
    if (!found) return false;
  }
  // Do not check L7 counts here; unlimited L7 assumed for planning.
  return true;
}

function applyItem(item, inv) {
  // Consume resources
  if (item.uses.mega) {
    const { primary, secondary, tertiary } = item.uses.mega;
    const found = inv.megas.find(m => m.primary === primary && m.secondary === secondary && m.tertiary === tertiary);
    if (found) found.qty = Math.max(0, (found.qty||0) - 1);
  }
  if (item.uses.super) {
    const { primary, secondary } = item.uses.super;
    const found = inv.supers.find(s => s.primary === primary && s.secondary === secondary);
    if (found) found.qty = Math.max(0, (found.qty||0) - 1);
  }
  for (const [t, cnt] of Object.entries(item.uses.l7)) {
    inv.l7[t] = (inv.l7[t] || 0) - cnt;
  }
}

function residualAfter(residual, item) {
  const next = { ...residual };
  for (const [stat, val] of Object.entries(item.contrib)) {
    next[stat] = Math.max(0, (next[stat] || 0) - val);
  }
  return next;
}

function residualSum(residual) {
  return Object.values(residual).reduce((a,b) => a + b, 0);
}

function computeUpperBoundPerSocket(candidates) {
  const ub = {};
  candidates.forEach(it => {
    for (const [stat, val] of Object.entries(it.contrib)) {
      ub[stat] = Math.max(ub[stat] || 0, val);
    }
  });
  return ub;
}

function canPossiblyMeet(residual, socketsLeft, ubPerSocket) {
  // Weak bound: for each stat, max achievable with socketsLeft must cover residual
  for (const [stat, need] of Object.entries(residual)) {
    if (need <= 0) continue;
    const ub = ubPerSocket[stat] || 0;
    if (ub * socketsLeft + 1e-6 < need) return false;
  }
  return true;
}

// Try a constructive exact mega mix for 3-4 unique defensive goals
function tryExactMegaMix(goals, DEFENSIVE_SOCKETS) {
  // Build per type goals and per-L7 values
  const perType = [];
  goals.forEach(g => {
    const type = g.type;
    const vt = lv7DefVal(type);
    const goal = g.goal;
    if (!vt || vt <= 0) return;
    perType.push({ type, vt, goal });
  });
  if (perType.length < 3 || perType.length > 4) return null;

  // Compute minimal unit requirements T_t = ceil(2*goal / vt)
  const baseT = {};
  let totalMinUnits = 0;
  perType.forEach(({ type, vt, goal }) => {
    const t = Math.ceil((2 * goal) / vt);
    baseT[type] = t;
    totalMinUnits += t;
  });

  // Lower bound on number of megas needed by total units (4 units per mega)
  const kLower = Math.max(1, Math.ceil(totalMinUnits / 4));

  // Try to find a feasible assignment for the smallest k up to socket limit
  for (let k = kLower; k <= DEFENSIVE_SOCKETS; k++) {
    const T = { ...baseT };
    const CAP_UNITS = 4 * k; // each mega contributes 4 units total (2 primary + 1 + 1 secondaries)
    if (totalMinUnits > CAP_UNITS) continue; // even k megas can't reach

    // Ranges for primaries: 0 <= P_t <= k
    const P = {};
    const S = {};

    let sumP = 0;
    perType.forEach(({ type }) => {
      const up = Math.min(k, Math.floor(T[type] / 2));
      // Start near the upper bound to reduce secondary load
      const p0 = Math.min(up, k);
      P[type] = p0;
      sumP += p0;
    });

    const types = perType.map(x => x.type);

    // Adjust sumP to equal k within bounds
    while (sumP > k) {
      const candidate = types
        .filter(t => P[t] > 0)
        .sort((a,b) => lv7DefVal(a) - lv7DefVal(b))[0];
      if (!candidate) {
        sumP = Infinity; // mark infeasible
        break;
      }
      P[candidate] -= 1;
      S[candidate] += 2;
      sumP -= 1;
    }
    if (sumP === Infinity) continue;

    while (sumP < k) {
      const candidate = types
        .filter(t => P[t] < k)
        .sort((a,b) => lv7DefVal(b) - lv7DefVal(a))[0];
      if (!candidate) {
        const any = types.find(t => P[t] < k);
        if (!any) { sumP = Infinity; break; }
        P[any] += 1;
        sumP += 1;
      } else {
        P[candidate] += 1;
        sumP += 1;
      }
    }
    if (sumP === Infinity) continue;

    // Compute secondaries required to meet minimal T, enforce capacity S[t] <= k - P[t]
    let sumUnits = 0;
    let feasible = true;
    types.forEach(t => {
      // Minimal secondaries before capacity
      S[t] = Math.max(0, T[t] - 2 * P[t]);
      // Required primaries to satisfy capacity: P >= T - k
      const requiredP = Math.max(0, T[t] - k);
      if (P[t] < requiredP) {
        const inc = Math.min(requiredP - P[t], k - P[t]);
        if (inc > 0) {
          P[t] += inc;
          S[t] = Math.max(0, T[t] - 2 * P[t]);
        }
      }
      // If even with P up to k we can't satisfy capacity, infeasible for this k
      if (S[t] > k - P[t]) {
        feasible = false;
      }
      sumUnits += 2 * P[t] + S[t];
    });
    if (!feasible) continue;

    // Rebalance: if total primaries exceed k, decrease some P by 1 where slack allows (increasing S by 2)
    let sumPnow = types.reduce((acc, t) => acc + P[t], 0);
    if (sumPnow > k) {
      let changed = true;
      while (sumPnow > k && changed) {
        changed = false;
        // Prefer lowering P on types with the most slack and lowest vt (cheaper as primary)
        const candidate = types
          .filter(t => P[t] > 0 && (k - P[t] - S[t]) >= 1)
          .sort((a,b) => {
            const slackA = (k - P[a] - S[a]);
            const slackB = (k - P[b] - S[b]);
            if (slackB !== slackA) return slackB - slackA;
            return lv7DefVal(a) - lv7DefVal(b);
          })[0];
        if (!candidate) break;
        P[candidate] -= 1;
        S[candidate] += 2;
        sumPnow -= 1;
        changed = true;
      }
      if (sumPnow !== k) continue; // couldn't rebalance for this k
      // Validate capacities still hold
      if (!types.every(t => S[t] <= k - P[t])) continue;
    }

    // Recompute total units and spare after rebalancing
    sumUnits = 2 * types.reduce((a, t) => a + P[t], 0) + types.reduce((a, t) => a + S[t], 0);

    // Use spare units (if any) to increase S first within capacities
    let spare = CAP_UNITS - sumUnits;
    if (spare < 0) continue; // infeasible for this k
    if (spare > 0) {
      let progressed = true;
      while (spare > 0 && progressed) {
        progressed = false;
        for (const t of types) {
          if (spare <= 0) break;
          const cap = k - P[t];
          if (S[t] < cap) {
            S[t] += 1;
            spare -= 1;
            progressed = true;
          }
        }
      }
    }
    // If still have >=2 spare units, try to bump some P (consumes 2 units) where possible
    if (spare >= 2) {
      let progressed = true;
      while (spare >= 2 && progressed) {
        progressed = false;
        const cand = types.find(t => P[t] < k);
        if (cand) {
          P[cand] += 1;
          // S[cand] decreases by 2 but not below 0
          S[cand] = Math.max(0, T[cand] - 2 * P[cand]);
          spare -= 2;
          progressed = true;
        }
      }
    }
    // Distribute any remaining tiny spare to S respecting caps
    if (spare > 0) {
      for (const t of types) {
        if (spare <= 0) break;
        const cap = k - P[t];
        const delta = Math.min(spare, cap - S[t]);
        if (delta > 0) {
          S[t] += delta;
          spare -= delta;
        }
      }
    }

    // Final sanity checks for this k
    let sumS = 0; sumP = 0;
    types.forEach(t => { sumP += P[t]; sumS += S[t]; });
    if (sumP !== k) continue;
    if (2 * sumP + sumS !== CAP_UNITS) continue; // must fill all secondaries across sockets
    for (const t of types) {
      if (S[t] < 0 || S[t] > k - P[t]) { feasible = false; break; }
    }
    if (!feasible) continue;

    // Per-primary feasibility: for each primary p, need 2*P[p] secondaries from the other types combined
    let perPrimaryOk = true;
    for (const p of types) {
      const others = types.filter(x => x !== p);
      const sumOthersS = others.reduce((a, t) => a + S[t], 0);
      if (sumOthersS < 2 * P[p]) { perPrimaryOk = false; break; }
    }
    if (!perPrimaryOk) continue;

    // Build sockets list for primaries
    const primaries = [];
    types.forEach(t => { for (let i = 0; i < P[t]; i++) primaries.push(t); });

    // Sort primaries by decreasing need of others (to allocate scarce S earlier)
    primaries.sort((a,b) => {
      const needA = (k - P[a]);
      const needB = (k - P[b]);
      return needB - needA;
    });

    const Srem = { ...S };

    // Robust backtracking assignment of two distinct secondaries per socket
    const sockets = [];
    const pairCache = new Map();

    const pairsForPrimary = (p, Sstate) => {
      const key = `${p}|${types.map(t => `${t}:${Sstate[t]||0}`).join(',')}`;
      if (pairCache.has(key)) return pairCache.get(key);
      const others = types.filter(t => t !== p && (Sstate[t]||0) > 0);
      const candPairs = [];
      for (let i = 0; i < others.length; i++) {
        for (let j = i + 1; j < others.length; j++) {
          const a = others[i], b = others[j];
          const score = (Sstate[a]||0) + (Sstate[b]||0); // prefer abundant
          candPairs.push({ a, b, score });
        }
      }
      candPairs.sort((x,y) => y.score - x.score);
      const list = candPairs.map(c => [c.a, c.b]);
      pairCache.set(key, list);
      return list;
    };

    let assigned = null;

    const dfs = (idx) => {
      if (idx === primaries.length) { assigned = sockets.slice(); return true; }
      const p = primaries[idx];

      // Quick viability: others' S must cover remaining needs for this and future primaries of same type
      const remainingPrimariesOfP = primaries.slice(idx).filter(x => x === p).length;
      const sumOthersS = types.filter(t => t !== p).reduce((acc, t) => acc + (Srem[t]||0), 0);
      if (sumOthersS < 2 * remainingPrimariesOfP) return false;

      const pairs = pairsForPrimary(p, Srem);
      for (const [s1, s2] of pairs) {
        if ((Srem[s1]||0) <= 0 || (Srem[s2]||0) <= 0) continue;
        // choose
        Srem[s1] -= 1; Srem[s2] -= 1;
        sockets.push({ primary: p, secondaries: [s1, s2] });
        if (dfs(idx + 1)) return true;
        // backtrack
        sockets.pop();
        Srem[s1] += 1; Srem[s2] += 1;
      }
      return false;
    };

    if (!dfs(0)) { continue; }

    // Build items sequence (k megas)
    const makeMega = (a, b, c) => makeItem('mega', [a, b, c], 2, `Mega ${a}+${b}+${c}`);
    const sequence = assigned.map(({ primary, secondaries }) => makeMega(primary, secondaries[0], secondaries[1]));

    // Compute achieved to verify >= goals
    const achieved = {};
    sequence.forEach(item => {
      for (const [stat, val] of Object.entries(item.contrib)) {
        achieved[stat] = (achieved[stat] || 0) + val;
      }
    });
    let ok = true;
    for (const { type, goal } of perType) {
      const stat = POWER_STONES[type].defensive;
      if ((achieved[stat] || 0) + 1e-6 < goal) { ok = false; break; }
    }
    if (!ok) continue;

    // General overshoot minimization via local search on each socket: try
    // - reordering mega primary among the three types
    // - converting to super with any pair from the three types (primary+secondary)
    // Keep any change only if all goals remain met and total overshoot decreases.
    const goalByStat = {};
    perType.forEach(({ type, goal }) => { goalByStat[POWER_STONES[type].defensive] = goal; });
    const scoreOvershoot = (ach) => Object.entries(goalByStat)
      .reduce((sum, [stat, g]) => sum + Math.max(0, (ach[stat] || 0) - g), 0);

    let bestSeq = sequence.slice();
    let bestAch = { ...achieved };
    let bestScore = scoreOvershoot(bestAch);

    const contribOf = (item) => item.contrib;

    // Extract per-socket types used
    const sockTypes = assigned.map(({ primary, secondaries }) => {
      const [s1, s2] = secondaries;
      return { p: primary, s1, s2 };
    });

    const tryImprove = () => {
      let improved = false;
      let chosen = null; // { idx, newItem, newAch, newScore }
      for (let i = 0; i < sockTypes.length; i++) {
        const { p, s1, s2 } = sockTypes[i];
        const curItem = bestSeq[i];
        const curContrib = contribOf(curItem);

        const candidates = [];
        // Mega variants with different primaries
        candidates.push(makeItem('mega', [p, s1, s2], 2, `Mega ${p}+${s1}+${s2}`));
        candidates.push(makeItem('mega', [s1, p, s2], 2, `Mega ${s1}+${p}+${s2}`));
        candidates.push(makeItem('mega', [s2, p, s1], 2, `Mega ${s2}+${p}+${s1}`));
        // Super variants for any ordered pair among the three
        const pairs = [
          [p, s1], [p, s2],
          [s1, p], [s2, p],
          [s1, s2], [s2, s1]
        ];
        pairs.forEach(([a,b]) => candidates.push(makeItem('super', [a,b], 1, `Super ${a}+${b}`)));

        // Evaluate candidates
        for (const cand of candidates) {
          // Compute new achieved quickly: bestAch - curContrib + cand.contrib
          const newAch = { ...bestAch };
          for (const [stat, val] of Object.entries(curContrib)) newAch[stat] = (newAch[stat] || 0) - val;
          for (const [stat, val] of Object.entries(cand.contrib)) newAch[stat] = (newAch[stat] || 0) + val;
          // Goals must still be met
          let ok3 = true;
          for (const [stat, g] of Object.entries(goalByStat)) {
            if ((newAch[stat] || 0) + 1e-6 < g) { ok3 = false; break; }
          }
          if (!ok3) continue;
          const newScore = scoreOvershoot(newAch);
          if (newScore + 1e-9 < bestScore) {
            // Tentatively choose the best improvement across all sockets
            if (!chosen || newScore < chosen.newScore - 1e-9) {
              chosen = { idx: i, newItem: cand, newAch, newScore };
            }
          }
        }
      }
      if (chosen) {
        bestSeq[chosen.idx] = chosen.newItem;
        bestAch = chosen.newAch;
        bestScore = chosen.newScore;
        improved = true;
      }
      return improved;
    };

    // Iterate until no improvement or small cap
    let guard = 0;
    while (guard < 50 && tryImprove()) guard++;

    sequence.splice(0, sequence.length, ...bestSeq);

    // Return the first feasible minimal-k sequence (after overshoot minimization)
    return sequence;
  }

  return null;
}

// Utility to pretty-name a stone type
export function stoneTypeName(type) {
  return POWER_STONES[type]?.name || type;
}

// Prefill with existing stones (megas, supers, and available L7) to reduce residual before search
function prefillExisting(candidates, inv, residual, socketsCap) {
  const invWork = cloneInv(inv);
  let residualWork = { ...residual };
  const seq = [];
  let socketsUsed = 0;

  // Consider only zero-merge candidates and ensure availability
  const isAvailable = (it) => {
    if (it.kind === 'mega-existing') {
      const { primary, secondary, tertiary } = it.uses.mega;
      const found = invWork.megas.find(m => m.primary === primary && m.secondary === secondary && m.tertiary === tertiary && (m.qty||0) > 0);
      return !!found;
    }
    if (it.kind === 'super-existing') {
      const { primary, secondary } = it.uses.super;
      const found = invWork.supers.find(s => s.primary === primary && s.secondary === secondary && (s.qty||0) > 0);
      return !!found;
    }
    if (it.kind === 'regular') {
      const t = it.parts[0];
      return (invWork.l7[t] || 0) > 0; // limit to actual L7 pieces owned
    }
    return false;
  };

  const zeroMerge = candidates.filter(c => c.mergesCost === 0 && (c.kind === 'mega-existing' || c.kind === 'super-existing' || c.kind === 'regular'));

  while (socketsUsed < socketsCap) {
    // Score only useful and available ones
    let best = null;
    for (const it of zeroMerge) {
      if (!isAvailable(it)) continue;
      // usefulness vs residual
      let useful = 0;
      for (const [stat, val] of Object.entries(it.contrib)) {
        const need = residualWork[stat] || 0;
        if (need > 0) useful += Math.min(val, need);
      }
      if (useful <= 0) continue;
      if (!best || useful > best.useful) best = { it, useful };
    }
    if (!best) break;

    // Apply the best existing item
    const it = best.it;
    if (it.kind === 'mega-existing') {
      const { primary, secondary, tertiary } = it.uses.mega;
      const m = invWork.megas.find(x => x.primary === primary && x.secondary === secondary && x.tertiary === tertiary);
      if (m) m.qty = Math.max(0, (m.qty||0) - 1);
    } else if (it.kind === 'super-existing') {
      const { primary, secondary } = it.uses.super;
      const s = invWork.supers.find(x => x.primary === primary && x.secondary === secondary);
      if (s) s.qty = Math.max(0, (s.qty||0) - 1);
    } else if (it.kind === 'regular') {
      const t = it.parts[0];
      invWork.l7[t] = (invWork.l7[t] || 0) - 1;
    }

    residualWork = residualAfter(residualWork, it);
    seq.push(it);
    socketsUsed += 1;
    if (residualSum(residualWork) <= 1e-6) break;
  }

  return { residual: residualWork, inv: invWork, socketsUsed, sequence: seq };
}

// Plan solver
export function planBuild(goalsInput, inventoryInput, options = {}) {
  const { targets } = buildTargets(goalsInput);
  if (targets.length === 0) {
    return { success: false, reason: 'No valid goals provided', plan: null };
  }

  // Residual expressed by stat name
  const residual0 = targets.reduce((acc, t) => { acc[t.stat] = (acc[t.stat] || 0) + t.goal; return acc; }, {});

  const inv0 = cloneInv(inventoryInput || {});
  const candidates = buildCandidates(targets, inv0);
  const ubPerSocket = computeUpperBoundPerSocket(candidates);

  const DEFENSIVE_SOCKETS = SOCKET_LIMITS.defensive; // 12

  // Prefill with existing stones to reduce residual and consume actual inventory first
  const pre = prefillExisting(candidates, inv0, residual0, DEFENSIVE_SOCKETS);
  let startResidual = pre.residual;
  let startInv = pre.inv;
  let startSocketsUsed = pre.socketsUsed;
  const preSequence = pre.sequence;

  // Optional fast path: exact mega mix for 3-4 distinct defensive goals
  if ((options.tryExactMegaMix ?? true) && (!startInv.supers?.length && !startInv.megas?.length)) {
    const distinctTypes = Array.from(new Set(targets.map(t => t.type)));
    if (distinctTypes.length >= 3 && distinctTypes.length <= 4) {
      const seq = tryExactMegaMix(targets, DEFENSIVE_SOCKETS - startSocketsUsed);
      if (seq) {
        // Build plan from prefill + exact mix sequence directly
        const used = { l7: {}, supers: {}, megas: {} };
        const mergesPlanned = [];
        let mergesCount = 0;
        const invLeft = cloneInv(inventoryInput || {});
        const inc = (obj, key, delta=1) => { obj[key] = (obj[key]||0) + delta; };
        const achieved = {};

        const allSeq = [...preSequence, ...seq];
        allSeq.forEach(item => {
          mergesCount += item.mergesCost;
          if (item.kind === 'regular') {
            const t = item.parts[0];
            inc(used.l7, t, 1); invLeft.l7[t] = (invLeft.l7[t]||0) - 1;
          } else if (item.kind === 'super') {
            const [a,b] = item.parts;
            inc(used.l7, a, 1); invLeft.l7[a] = (invLeft.l7[a]||0) - 1;
            inc(used.l7, b, 1); invLeft.l7[b] = (invLeft.l7[b]||0) - 1;
            mergesPlanned.push({ type: 'super', primary: a, secondary: b });
          } else if (item.kind === 'mega') {
            const [a,b,c] = item.parts;
            inc(used.l7, a, 1); invLeft.l7[a] = (invLeft.l7[a]||0) - 1;
            inc(used.l7, b, 1); invLeft.l7[b] = (invLeft.l7[b]||0) - 1;
            inc(used.l7, c, 1); invLeft.l7[c] = (invLeft.l7[c]||0) - 1;
            mergesPlanned.push({ type: 'mega', primary: a, secondary: b, tertiary: c });
          } else if (item.kind === 'super-existing') {
            const [a,b] = item.parts;
            inc(used.supers, `${a}+${b}`, 1);
            const s = invLeft.supers.find(x => x.primary === a && x.secondary === b);
            if (s) s.qty = Math.max(0, (s.qty||0) - 1);
          } else if (item.kind === 'mega-existing') {
            const [a,b,c] = item.parts;
            inc(used.megas, `${a}+${b}+${c}`, 1);
            const m = invLeft.megas.find(x => x.primary === a && x.secondary === b && x.tertiary === c);
            if (m) m.qty = Math.max(0, (m.qty||0) - 1);
          } else if (item.kind === 'upgrade-super-to-mega') {
            const [a,b,c] = item.parts;
            inc(used.l7, c, 1); invLeft.l7[c] = (invLeft.l7[c]||0) - 1;
            inc(used.supers, `${a}+${b}`, 1);
            mergesPlanned.push({ type: 'upgrade', primary: a, secondary: b, tertiary: c });
            const s = invLeft.supers.find(x => x.primary === a && x.secondary === b);
            if (s) s.qty = Math.max(0, (s.qty||0) - 1);
          }
          for (const [stat, val] of Object.entries(item.contrib)) {
            achieved[stat] = (achieved[stat] || 0) + val;
          }
        });

        const missingL7 = {};
        Object.keys(invLeft.l7 || {}).forEach(t => { if (invLeft.l7[t] < 0) missingL7[t] = -invLeft.l7[t]; });

        const plan = {
          sockets: allSeq.map(it => ({ kind: it.kind, parts: it.parts, label: it.label, contrib: it.contrib })),
          mergesUsed: mergesCount,
          merges: mergesPlanned,
          usedL7: used.l7,
          usedExistingSupers: used.supers,
          usedExistingMegas: used.megas,
          missingL7,
          socketsUsed: allSeq.length,
          socketsAvailableDef: DEFENSIVE_SOCKETS,
          socketsAvailableOff: SOCKET_LIMITS.offensive,
          goals: residual0,
          achieved
        };
        return { success: true, plan };
      }
    }
  }

  // Helper to rank candidates against a residual
  const orderCandidatesFor = (residual) => {
    return candidates
      .map(it => {
        let useful = 0;
        for (const [stat, val] of Object.entries(it.contrib)) {
          useful += Math.min(val, residual[stat] || 0);
        }
        // Composite score: usefulness per (merges+1) with slight bias for fewer merges
        const per = useful / (it.mergesCost + 1);
        const bias = it.mergesCost === 0 ? 0.01 : 0;
        return { it, useful, score: per + bias };
      })
      .filter(x => x.useful > 0)
      .sort((a,b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.it.mergesCost !== b.it.mergesCost) return a.it.mergesCost - b.it.mergesCost;
        return b.useful - a.useful;
      });
  };

  const runBeam = (opts, seed) => {
    const MAX_MERGES = opts.maxMerges ?? 24;
    const BEAM_WIDTH = opts.beamWidth ?? 16;
    const TOP_CHILDREN = opts.topChildren ?? 10;
    const TIME_LIMIT_MS = opts.timeLimitMs ?? 1500;

    const tStart = Date.now();
    const best = { merges: Infinity, sockets: Infinity, sequence: null };

    const makeState = (residual, inv, socketsUsed, mergesUsed, seq) => ({ residual, inv, socketsUsed, mergesUsed, seq });
    const resSum = (res) => residualSum(res);

    const seedResidual = seed?.residual ?? residual0;
    const seedInv = seed?.inv ? cloneInv(seed.inv) : cloneInv(inv0);
    const seedSockets = seed?.socketsUsed ?? 0;
    const seedSeq = seed?.sequence ?? [];

    let frontier = [ makeState(seedResidual, seedInv, seedSockets, 0, seedSeq) ];

    for (let depth = seedSockets; depth < DEFENSIVE_SOCKETS; depth++) {
      if (Date.now() - tStart > TIME_LIMIT_MS) break;

      const next = [];

      for (const state of frontier) {
        const { residual, inv, socketsUsed, mergesUsed, seq } = state;

        if (resSum(residual) <= 1e-6) {
          if (
            mergesUsed < best.merges ||
            (mergesUsed === best.merges && socketsUsed < best.sockets)
          ) {
            best.merges = mergesUsed;
            best.sockets = socketsUsed;
            best.sequence = seq.slice();
          }
          continue;
        }

        if (!canPossiblyMeet(residual, DEFENSIVE_SOCKETS - socketsUsed, ubPerSocket)) continue;

        const ordered = orderCandidatesFor(residual);
        let children = 0;
        let took0 = 0, took1 = 0;
        for (const { it } of ordered) {
          if (children >= TOP_CHILDREN) break;
          if (mergesUsed + it.mergesCost > MAX_MERGES) continue;
          if (!canUseItem(it, inv)) continue;

          // ensure diversity by merge cost within a layer
          if (it.mergesCost === 0 && took0 >= 4) continue;
          if (it.mergesCost === 1 && took1 >= 4) continue;

          const invCloned = cloneInv(inv);
          applyItem(it, invCloned);
          const nextResidual = residualAfter(residual, it);
          const nextState = makeState(nextResidual, invCloned, socketsUsed + 1, mergesUsed + it.mergesCost, [...seq, it]);

          next.push(nextState);
          children++;
          if (it.mergesCost === 0) took0++; else if (it.mergesCost === 1) took1++;

          if (resSum(nextResidual) <= 1e-6) {
            if (
              nextState.mergesUsed < best.merges ||
              (nextState.mergesUsed === best.merges && nextState.socketsUsed < best.sockets)
            ) {
              best.merges = nextState.mergesUsed;
              best.sockets = nextState.socketsUsed;
              best.sequence = nextState.seq.slice();
            }
          }
        }
      }

      if (next.length === 0) break;

      next.sort((a,b) => {
        if (a.mergesUsed !== b.mergesUsed) return a.mergesUsed - b.mergesUsed;
        if (a.socketsUsed !== b.socketsUsed) return a.socketsUsed - b.socketsUsed;
        return resSum(a.residual) - resSum(b.residual);
      });

      frontier = next.slice(0, BEAM_WIDTH);

      if (best.sequence && best.merges === 0) break;
    }

    return best.sequence ? { success: true, sequence: best.sequence } : { success: false };
  };

  // Greedy fallback that always tries to complete within sockets, ignoring merges cap
  const runGreedy = (seed) => {
    let residual = { ...(seed?.residual ?? residual0) };
    const seq = [ ...(seed?.sequence ?? []) ];
    const inv = seed?.inv ? cloneInv(seed.inv) : cloneInv(inv0);

    const synthRegularFor = (type) => makeItem('regular', [type], 0, `L7 ${type}`);

    for (let s = (seed?.socketsUsed ?? 0); s < DEFENSIVE_SOCKETS; s++) {
      // Build weights by residual magnitude (focus on top 3 stats)
      const entries = Object.entries(residual).sort((a,b) => (b[1]||0) - (a[1]||0));
      const weights = new Map();
      entries.forEach(([stat, val], idx) => {
        if ((val||0) <= 0) return;
        weights.set(stat, idx === 0 ? 1.0 : idx === 1 ? 0.8 : idx === 2 ? 0.6 : 0.25);
      });

      let best = null;

      // Score all candidates against weighted residuals
      for (const it of candidates) {
        if (!canUseItem(it, inv)) continue;
        let useful = 0;
        let statsCovered = 0;
        for (const [stat, val] of Object.entries(it.contrib)) {
          const need = residual[stat] || 0;
          if (need <= 0) continue;
          const take = Math.min(val, need);
          if (take > 0) {
            const w = weights.get(stat) || 0.2;
            useful += take * w;
            statsCovered += 1;
          }
        }
        if (useful <= 0) continue;
        // Favor broader coverage then tiny penalty for merges cost
        const score = useful + statsCovered * 0.02 - it.mergesCost * 0.001;
        if (!best || score > best.score) best = { it, score };
      }

      if (!best) {
        // As a safety net, synthesize a regular L7 for the highest residual stat's type
        const top = entries.find(([, v]) => (v||0) > 0);
        if (!top) break; // nothing left
        const topStat = top[0];
        // Find a type that contributes to this stat
        const typeForTop = Object.keys(POWER_STONES).find(t => POWER_STONES[t].defensive === topStat);
        if (!typeForTop) break;
        const it = synthRegularFor(typeForTop);
        applyItem(it, inv);
        residual = residualAfter(residual, it);
        seq.push(it);
        if (residualSum(residual) <= 1e-6) break;
        continue;
      }

      applyItem(best.it, inv);
      residual = residualAfter(residual, best.it);
      seq.push(best.it);
      if (residualSum(residual) <= 1e-6) break;
    }

    if (residualSum(residual) > 1e-6) return { success: false };
    return { success: true, sequence: seq };
  };

  // Try user-tuned beam first
  const primary = runBeam({
    maxMerges: options.maxMerges ?? 24,
    beamWidth: options.beamWidth ?? 16,
    topChildren: options.topChildren ?? 10,
    timeLimitMs: options.timeLimitMs ?? 1500
  }, { residual: startResidual, inv: startInv, socketsUsed: startSocketsUsed, sequence: preSequence });

  let sequence = null;

  if (primary.success) {
    sequence = primary.sequence;
  } else {
    // Relaxed attempt
    const relaxed = runBeam({ maxMerges: Math.max(48, options.maxMerges ?? 24), beamWidth: 24, topChildren: 14, timeLimitMs: 2200 }, { residual: startResidual, inv: startInv, socketsUsed: startSocketsUsed, sequence: preSequence });
    if (relaxed.success) {
      sequence = relaxed.sequence;
    } else {
      // Final greedy fallback
      const greedy = runGreedy({ residual: startResidual, inv: startInv, socketsUsed: startSocketsUsed, sequence: preSequence });
      if (greedy.success) {
        sequence = greedy.sequence;
      } else {
        // If even greedy can't fill within sockets, then it's truly infeasible under socket maxima
        if (!canPossiblyMeet(residual0, DEFENSIVE_SOCKETS, ubPerSocket)) {
          return { success: false, reason: 'Goals unattainable under the 12 defensive sockets maximum given per-socket caps. Lower goals or reconsider target mix.', plan: null };
        }
        return { success: false, reason: 'No feasible plan found within limits (search/timeout). Try again or adjust constraints.', plan: null };
      }
    }
  }

  // Build plan summary from sequence
  const used = { l7: {}, supers: {}, megas: {} };
  const mergesPlanned = [];
  let mergesCount = 0;

  const invLeft = cloneInv(inventoryInput || {});
  const inc = (obj, key, delta=1) => { obj[key] = (obj[key]||0) + delta; };

  sequence.forEach(item => {
    mergesCount += item.mergesCost;

    if (item.kind === 'regular') {
      const t = item.parts[0];
      inc(used.l7, t, 1);
      invLeft.l7[t] = (invLeft.l7[t]||0) - 1;
    } else if (item.kind === 'super') {
      const [a,b] = item.parts;
      inc(used.l7, a, 1); invLeft.l7[a] = (invLeft.l7[a]||0) - 1;
      inc(used.l7, b, 1); invLeft.l7[b] = (invLeft.l7[b]||0) - 1;
      mergesPlanned.push({ type: 'super', primary: a, secondary: b });
    } else if (item.kind === 'mega') {
      const [a,b,c] = item.parts;
      inc(used.l7, a, 1); invLeft.l7[a] = (invLeft.l7[a]||0) - 1;
      inc(used.l7, b, 1); invLeft.l7[b] = (invLeft.l7[b]||0) - 1;
      inc(used.l7, c, 1); invLeft.l7[c] = (invLeft.l7[c]||0) - 1;
      mergesPlanned.push({ type: 'mega', primary: a, secondary: b, tertiary: c });
    } else if (item.kind === 'super-existing') {
      const [a,b] = item.parts;
      inc(used.supers, `${a}+${b}`, 1);
      const s = invLeft.supers.find(x => x.primary === a && x.secondary === b);
      if (s) s.qty = Math.max(0, (s.qty||0) - 1);
    } else if (item.kind === 'mega-existing') {
      const [a,b,c] = item.parts;
      inc(used.megas, `${a}+${b}+${c}`, 1);
      const m = invLeft.megas.find(x => x.primary === a && x.secondary === b && x.tertiary === c);
      if (m) m.qty = Math.max(0, (m.qty||0) - 1);
    } else if (item.kind === 'upgrade-super-to-mega') {
      const [a,b,c] = item.parts;
      inc(used.l7, c, 1); invLeft.l7[c] = (invLeft.l7[c]||0) - 1;
      inc(used.supers, `${a}+${b}`, 1);
      mergesPlanned.push({ type: 'upgrade', primary: a, secondary: b, tertiary: c });
      const s = invLeft.supers.find(x => x.primary === a && x.secondary === b);
      if (s) s.qty = Math.max(0, (s.qty||0) - 1);
    }
  });

  const missingL7 = {};
  Object.keys(invLeft.l7 || {}).forEach(t => {
    if (invLeft.l7[t] < 0) missingL7[t] = -invLeft.l7[t];
  });

  const achieved = {};
  sequence.forEach(item => {
    for (const [stat, val] of Object.entries(item.contrib)) {
      achieved[stat] = (achieved[stat] || 0) + val;
    }
  });

  const plan = {
    sockets: sequence.map(it => ({ kind: it.kind, parts: it.parts, label: it.label, contrib: it.contrib })),
    mergesUsed: mergesCount,
    merges: mergesPlanned,
    usedL7: used.l7,
    usedExistingSupers: used.supers,
    usedExistingMegas: used.megas,
    missingL7,
    socketsUsed: sequence.length,
    socketsAvailableDef: DEFENSIVE_SOCKETS,
    socketsAvailableOff: SOCKET_LIMITS.offensive,
    goals: residual0,
    achieved
  };

  return { success: true, plan };
}
