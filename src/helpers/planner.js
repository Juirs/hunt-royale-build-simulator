// Planner algorithm: compute minimal-merge plan to reach defensive goals within socket limits
// Uses POWER_STONES definitions and existing helper assumptions

import {POWER_STONES} from '../constants/powerStones.js';

// Hard-coded socket limits to match game rules
export const SOCKET_LIMITS = {
  defensive: 12,
  offensive: 8
};

// Helper: check if inventory has any available (qty > 0) existing combo stones
function hasAvailableCombos(inv) {
  const hasMega = (inv?.megas || []).some(m => (m.qty || 0) > 0);
  const hasSuper = (inv?.supers || []).some(s => (s.qty || 0) > 0);
  return hasMega || hasSuper;
}

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

// Substitute crafted supers/megas with matching existing ones from inventory to reduce merges and use current stones
function substituteExisting(sequence, inventoryInput) {
  // Canonical key helpers (primary; unordered secondaries)
  const mkMegaKey = (a, b, c) => `${a}|${b < c ? b : c}|${b < c ? c : b}`;

  // Build remaining buckets from inventory
  const megaRemain = new Map();
  (inventoryInput?.megas || []).forEach(m => {
    const key = mkMegaKey(m.primary, m.secondary, m.tertiary);
    megaRemain.set(key, (megaRemain.get(key) || 0) + (m.qty || 0));
  });
  const superRemain = new Map();
  (inventoryInput?.supers || []).forEach(s => {
    // Treat supers as unordered pairs for availability
    const a = s.primary, b = s.secondary;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    superRemain.set(key, (superRemain.get(key) || 0) + (s.qty || 0));
  });

  const seqOut = sequence.map(it => ({ ...it }));

  // Reserve from buckets for any existing items already present in the planned sequence (e.g., from prefill)
  for (const it of seqOut) {
    if (it.kind === 'mega-existing' && it.parts?.length >= 3) {
      const [a,b,c] = it.parts;
      const key = mkMegaKey(a,b,c);
      const left = megaRemain.get(key) || 0;
      if (left > 0) megaRemain.set(key, left - 1);
    } else if (it.kind === 'super-existing' && it.parts?.length >= 2) {
      const [a,b] = it.parts;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const left = superRemain.get(key) || 0;
      if (left > 0) superRemain.set(key, left - 1);
    } else if (it.kind === 'upgrade-super-to-mega' && it.parts?.length >= 2) {
      const [a,b] = it.parts; // existing super a+b consumed
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const left = superRemain.get(key) || 0;
      if (left > 0) superRemain.set(key, left - 1);
    }
  }

  const tryUseExistingMega = (a, b, c) => {
    const key = mkMegaKey(a,b,c);
    const left = megaRemain.get(key) || 0;
    if (left > 0) {
      megaRemain.set(key, left - 1);
      return makeItem('mega-existing', [a, b, c], 0, `Existing Mega ${a}+${b}+${c}`);
    }
    return null;
  };

  const tryUseExistingSuper = (p, s) => {
    // We allow any order availability, but preserve planned order in the item
    const key = p < s ? `${p}|${s}` : `${s}|${p}`;
    const left = superRemain.get(key) || 0;
    if (left > 0) {
      superRemain.set(key, left - 1);
      return makeItem('super-existing', [p, s], 0, `Existing Super ${p}+${s}`);
    }
    return null;
  };

  const tryUpgradeFromExistingSuper = (a, b, c) => {
    // Use an existing super with primary a and one of (b,c) in any order; consume from unordered bucket
    for (const s of [b, c]) {
      const key = a < s ? `${a}|${s}` : `${s}|${a}`;
      const left = superRemain.get(key) || 0;
      if (left > 0) {
        superRemain.set(key, left - 1);
        const t = s === b ? c : b;
        return makeItem('upgrade-super-to-mega', [a, s, t], 1, `Upgrade Super ${a}+${s} -> +${t}`);
      }
    }
    return null;
  };

  for (let i = 0; i < seqOut.length; i++) {
    const it = seqOut[i];
    if (it.kind === 'mega') {
      const [a, b, c] = it.parts;
      let repl = tryUseExistingMega(a, b, c);
      if (!repl) repl = tryUpgradeFromExistingSuper(a, b, c);
      if (repl) seqOut[i] = repl;
    } else if (it.kind === 'super') {
      const [p, s] = it.parts;
      const repl = tryUseExistingSuper(p, s);
      if (repl) seqOut[i] = repl;
    }
  }

  return seqOut;
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
function prefillExisting(candidates, inv, residual, socketsCap, ubPerSocket, targetTypesForMix) {
  const invWork = cloneInv(inv);
  let residualWork = { ...residual };
  const seq = [];
  let socketsUsed = 0;

  // Only consider zero-merge candidates; separate existing combo stones from regular L7
  const zeroMerge = candidates.filter(c => c.mergesCost === 0 && (c.kind === 'mega-existing' || c.kind === 'super-existing' || c.kind === 'regular'));
  const existingZero = zeroMerge.filter(c => c.kind !== 'regular');
  const regularZero = zeroMerge.filter(c => c.kind === 'regular');

  // Safety caps for prefill
  const REGULAR_PREFILL_MAX = Math.min(3, socketsCap); // at most 3 regular L7 sockets
  const EXISTING_COMBO_PREFILL_MAX = Math.max(1, Math.min(4, Math.floor(socketsCap / 3))); // avoid starving sockets
  let regularUsed = 0;
  let existingCombosUsed = 0;

  const minMegasNeededForResidual = (residualStats) => {
    if (!targetTypesForMix || targetTypesForMix.length === 0) return 0;
    let totalUnits = 0;
    for (const type of targetTypesForMix) {
      const stat = POWER_STONES[type].defensive;
      const need = Math.max(0, residualStats[stat] || 0);
      const vt = lv7DefVal(type);
      if (vt > 0 && need > 0) {
        totalUnits += Math.ceil((2 * need) / vt);
      }
    }
    return Math.ceil(totalUnits / 4);
  };

  const isAvailable = (it) => {
    if (it.kind === 'mega-existing') {
      if (existingCombosUsed >= EXISTING_COMBO_PREFILL_MAX) return false;
      const { primary, secondary, tertiary } = it.uses.mega;
      const found = invWork.megas.find(m => m.primary === primary && m.secondary === secondary && m.tertiary === tertiary && (m.qty||0) > 0);
      return !!found;
    }
    if (it.kind === 'super-existing') {
      if (existingCombosUsed >= EXISTING_COMBO_PREFILL_MAX) return false;
      const { primary, secondary } = it.uses.super;
      const found = invWork.supers.find(s => s.primary === primary && s.secondary === secondary && (s.qty||0) > 0);
      return !!found;
    }
    if (it.kind === 'regular') {
      if (regularUsed >= REGULAR_PREFILL_MAX) return false;
      const t = it.parts[0];
      return (invWork.l7[t] || 0) > 0;
    }
    return false;
  };

  const tryPlace = (it) => {
    const nextResidual = residualAfter(residualWork, it);
    const socketsLeft = socketsCap - (socketsUsed + 1);
    // Upper-bound feasibility
    if (!canPossiblyMeet(nextResidual, socketsLeft, ubPerSocket)) return false;
    // Unit-based lower bound feasibility for planned mega mix among original types
    const kLower = minMegasNeededForResidual(nextResidual);
    if (kLower > socketsLeft) return false;

    // Apply the item
    if (it.kind === 'mega-existing') {
      const { primary, secondary, tertiary } = it.uses.mega;
      const m = invWork.megas.find(x => x.primary === primary && x.secondary === secondary && x.tertiary === tertiary);
      if (m) m.qty = Math.max(0, (m.qty||0) - 1);
      existingCombosUsed += 1;
    } else if (it.kind === 'super-existing') {
      const { primary, secondary } = it.uses.super;
      const s = invWork.supers.find(x => x.primary === primary && x.secondary === secondary);
      if (s) s.qty = Math.max(0, (s.qty||0) - 1);
      existingCombosUsed += 1;
    } else if (it.kind === 'regular') {
      const t = it.parts[0];
      invWork.l7[t] = (invWork.l7[t] || 0) - 1;
      regularUsed += 1;
    }
    residualWork = nextResidual;
    seq.push(it);
    socketsUsed += 1;
    return true;
  };

  // Count how many target stats this item contributes to that still have positive residual
  const countGoalStatsCovered = (it, residualState) => {
    let covered = 0;
    for (const [stat, val] of Object.entries(it.contrib)) {
      if ((residualState[stat] || 0) > 0 && val > 0) covered += 1;
    }
    return covered;
  };

  // 1) Place existing megas/supers greedily by usefulness while feasible
  while (socketsUsed < socketsCap) {
    let best = null;
    for (const it of existingZero) {
      if (!isAvailable(it)) continue;
      let useful = 0;
      for (const [stat, val] of Object.entries(it.contrib)) {
        const need = residualWork[stat] || 0;
        if (need > 0) useful += Math.min(val, need);
      }
      if (useful <= 0) continue;
      const statsCovered = countGoalStatsCovered(it, residualWork);
      // If sockets are getting tight, prefer items that cover at least two goal stats
      const socketsLeft = socketsCap - (socketsUsed + 1);
      if (socketsLeft <= Math.ceil(socketsCap / 2) && statsCovered < 2) continue;
      const score = useful + statsCovered * 0.05;
      if (!best || score > best.score) best = { it, score };
    }
    if (!best) break;
    if (!tryPlace(best.it)) {
      // Remove from pool if placing this instance blocks feasibility
      const idx = existingZero.indexOf(best.it);
      if (idx >= 0) existingZero.splice(idx, 1);
      continue;
    }
    if (residualSum(residualWork) <= 1e-6) break;
  }

  // 2) Optionally place up to REGULAR_PREFILL_MAX regular L7 if they help and remain feasible
  while (socketsUsed < socketsCap && regularUsed < REGULAR_PREFILL_MAX) {
    let best = null;
    for (const it of regularZero) {
      if (!isAvailable(it)) continue;
      let useful = 0;
      for (const [stat, val] of Object.entries(it.contrib)) {
        const need = residualWork[stat] || 0;
        if (need > 0) useful += Math.min(val, need);
      }
      if (useful <= 0) continue;
      if (!best || useful > best.useful) best = { it, useful };
    }
    if (!best) break;
    if (!tryPlace(best.it)) {
      const idx = regularZero.indexOf(best.it);
      if (idx >= 0) regularZero.splice(idx, 1);
      continue;
    }
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

  // Early exact-mix attempt if inventory has no available existing supers/megas to preserve full socket budget
  if ((options.tryExactMegaMix ?? true) && !hasAvailableCombos(inv0)) {
    const seq = tryExactMegaMix(targets, DEFENSIVE_SOCKETS);
    if (seq) {
      // After exact mix, substitute crafted with existing where possible
      const seqSub = substituteExisting(seq, inventoryInput);
      // Build plan summary directly from exact mix sequence
      const used = { l7: {}, supers: {}, megas: {} };
      const mergesPlanned = [];
      let mergesCount = 0;
      const invLeft = cloneInv(inventoryInput || {});
      const inc = (obj, key, delta=1) => { obj[key] = (obj[key]||0) + delta; };
      const achieved = {};

      seqSub.forEach(item => {
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
          // sanity: enforce distinct types before recording
          if (!(a === b || a === c || b === c)) {
            inc(used.l7, a, 1); invLeft.l7[a] = (invLeft.l7[a]||0) - 1;
            inc(used.l7, b, 1); invLeft.l7[b] = (invLeft.l7[b]||0) - 1;
            inc(used.l7, c, 1); invLeft.l7[c] = (invLeft.l7[c]||0) - 1;
            mergesPlanned.push({ type: 'mega', primary: a, secondary: b, tertiary: c });
          }
        } else if (item.kind === 'super-existing') {
          const [a,b] = item.parts;
          inc(used.supers, `${a}+${b}`, 1);
          // tolerate reversed order
          let s = invLeft.supers.find(x => x.primary === a && x.secondary === b);
          if (!s) s = invLeft.supers.find(x => x.primary === b && x.secondary === a);
          if (s) s.qty = Math.max(0, (s.qty||0) - 1);
        } else if (item.kind === 'mega-existing') {
          const [a,b,c] = item.parts;
          inc(used.megas, `${a}+${b}+${c}`, 1);
          // tolerate swapped secondaries for inventory decrement
          let m = invLeft.megas.find(x => x.primary === a && x.secondary === b && x.tertiary === c);
          if (!m) m = invLeft.megas.find(x => x.primary === a && x.secondary === c && x.tertiary === b);
          if (m) m.qty = Math.max(0, (m.qty||0) - 1);
        } else if (item.kind === 'upgrade-super-to-mega') {
          const [a,b,c] = item.parts;
          inc(used.l7, c, 1); invLeft.l7[c] = (invLeft.l7[c]||0) - 1;
          inc(used.supers, `${a}+${b}`, 1);
          mergesPlanned.push({ type: 'upgrade', primary: a, secondary: b, tertiary: c });
          let s = invLeft.supers.find(x => x.primary === a && x.secondary === b);
          if (!s) s = invLeft.supers.find(x => x.primary === b && x.secondary === a);
          if (s) s.qty = Math.max(0, (s.qty||0) - 1);
        }
        for (const [stat, val] of Object.entries(item.contrib)) {
          achieved[stat] = (achieved[stat] || 0) + val;
        }
      });

      const missingL7 = {};
      Object.keys(invLeft.l7 || {}).forEach(t => { if (invLeft.l7[t] < 0) missingL7[t] = -invLeft.l7[t]; });

      const plan = {
        sockets: seqSub.map(it => ({ kind: it.kind, parts: it.parts, label: it.label, contrib: it.contrib })),
        mergesUsed: mergesCount,
        merges: mergesPlanned,
        usedL7: used.l7,
        usedExistingSupers: used.supers,
        usedExistingMegas: used.megas,
        missingL7,
        socketsUsed: seqSub.length,
        socketsAvailableDef: SOCKET_LIMITS.defensive,
        socketsAvailableOff: SOCKET_LIMITS.offensive,
        goals: residual0,
        achieved
      };
      return { success: true, plan };
    }
  }

  // Prefill with existing stones to reduce residual and consume actual inventory first
  let startResidual, startInv, startSocketsUsed, preSequence;
  if (options.disablePrefill) {
    startResidual = residual0;
    startInv = inv0;
    startSocketsUsed = 0;
    preSequence = [];
  } else {
    const pre = prefillExisting(candidates, inv0, residual0, DEFENSIVE_SOCKETS, ubPerSocket, Array.from(new Set(targets.map(t => t.type))));
    startResidual = pre.residual;
    startInv = pre.inv;
    startSocketsUsed = pre.socketsUsed;
    preSequence = pre.sequence;
  }

  // Optional fast path: exact mega mix for 3-4 distinct defensive goals when no available combos remain after prefill
  if ((options.tryExactMegaMix ?? true) /* && !hasAvailableCombos(startInv) */) {
    // Build reduced targets from residual after prefill
    const reducedTargets = Array.from(new Set(targets.map(t => t.type))).map((type) => {
      const stat = POWER_STONES[type].defensive;
      return { type, goal: Math.max(0, startResidual[stat] || 0) };
    }).filter(x => x.goal > 0);
    const distinctTypes = Array.from(new Set(reducedTargets.map(t => t.type)));
    const socketsLeft = DEFENSIVE_SOCKETS - startSocketsUsed;
    if (socketsLeft > 0 && distinctTypes.length >= 3 && distinctTypes.length <= 4) {
      const seq = tryExactMegaMix(reducedTargets, socketsLeft);
      if (seq) {
        const combined = [...preSequence, ...seq];
        const seqSub = substituteExisting(combined, inventoryInput);
        // Build plan
        const used = { l7: {}, supers: {}, megas: {} };
        const mergesPlanned = [];
        let mergesCount = 0;
        const invLeft = cloneInv(inventoryInput || {});
        const inc = (obj, key, delta=1) => { obj[key] = (obj[key]||0) + delta; };
        const achieved = {};
        seqSub.forEach(item => {
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
            if (!(a === b || a === c || b === c)) {
              inc(used.l7, a, 1); invLeft.l7[a] = (invLeft.l7[a]||0) - 1;
              inc(used.l7, b, 1); invLeft.l7[b] = (invLeft.l7[b]||0) - 1;
              inc(used.l7, c, 1); invLeft.l7[c] = (invLeft.l7[c]||0) - 1;
              mergesPlanned.push({ type: 'mega', primary: a, secondary: b, tertiary: c });
            }
          } else if (item.kind === 'super-existing') {
            const [a,b] = item.parts;
            inc(used.supers, `${a}+${b}`, 1);
            let s = invLeft.supers.find(x => x.primary === a && x.secondary === b);
            if (!s) s = invLeft.supers.find(x => x.primary === b && x.secondary === a);
            if (s) s.qty = Math.max(0, (s.qty||0) - 1);
          } else if (item.kind === 'mega-existing') {
            const [a,b,c] = item.parts;
            inc(used.megas, `${a}+${b}+${c}`, 1);
            let m = invLeft.megas.find(x => x.primary === a && x.secondary === b && x.tertiary === c);
            if (!m) m = invLeft.megas.find(x => x.primary === a && x.secondary === c && x.tertiary === b);
            if (m) m.qty = Math.max(0, (m.qty||0) - 1);
          } else if (item.kind === 'upgrade-super-to-mega') {
            const [a,b,c] = item.parts;
            inc(used.l7, c, 1); invLeft.l7[c] = (invLeft.l7[c]||0) - 1;
            inc(used.supers, `${a}+${b}`, 1);
            mergesPlanned.push({ type: 'upgrade', primary: a, secondary: b, tertiary: c });
            let s = invLeft.supers.find(x => x.primary === a && x.secondary === b);
            if (!s) s = invLeft.supers.find(x => x.primary === b && x.secondary === a);
            if (s) s.qty = Math.max(0, (s.qty||0) - 1);
          }
          for (const [stat, val] of Object.entries(item.contrib)) {
            achieved[stat] = (achieved[stat] || 0) + val;
          }
        });
        const missingL7 = {};
        Object.keys(invLeft.l7 || {}).forEach(t => { if (invLeft.l7[t] < 0) missingL7[t] = -invLeft.l7[t]; });
        const plan = {
          sockets: seqSub.map(it => ({ kind: it.kind, parts: it.parts, label: it.label, contrib: it.contrib })),
          mergesUsed: mergesCount,
          merges: mergesPlanned,
          usedL7: used.l7,
          usedExistingSupers: used.supers,
          usedExistingMegas: used.megas,
          missingL7,
          socketsUsed: seqSub.length,
          socketsAvailableDef: SOCKET_LIMITS.defensive,
          socketsAvailableOff: SOCKET_LIMITS.offensive,
          goals: residual0,
          achieved
        };
        // Success if all goals met after exact mix
        const success = Object.entries(residual0).every(([stat, goal]) => (achieved[stat] || 0) + 1e-6 >= goal) && (seqSub.length) <= DEFENSIVE_SOCKETS;
        if (success) return { success: true, plan };
        // else fall through to greedy
      }
    }
  }

  // Fallback greedy planner: iteratively choose the most useful item until goals met or sockets full
  const socketsBudget = DEFENSIVE_SOCKETS - startSocketsUsed;
  const seqGreedy = [];
  let residual = { ...startResidual };
  let inv = cloneInv(startInv);
  let socketsUsed = 0;
  let mergesUsed = 0;
  const maxMerges = options.maxMerges ?? Infinity;

  const usefulScore = (it, res) => {
    let useful = 0;
    for (const [stat, val] of Object.entries(it.contrib)) {
      const need = res[stat] || 0;
      if (need > 0 && val > 0) useful += Math.min(val, need);
    }
    return useful;
  };

  const currentCandidates = candidates.filter(c => c.kind !== 'regular' || (inv.l7[c.parts[0]] || 0) > 0);

  while (socketsUsed < socketsBudget && residualSum(residual) > 1e-6) {
    let best = null;
    for (const it of currentCandidates) {
      if (!canUseItem(it, inv)) continue;
      if (mergesUsed + it.mergesCost > maxMerges) continue;
      const score = usefulScore(it, residual);
      if (score <= 0) continue;
      // Prefer higher usefulness per merge cost, tiny bias for lower merges
      const cost = Math.max(1, it.mergesCost || 0.5);
      const ratio = score / cost - 0.0001 * it.mergesCost;
      if (!best || ratio > best.ratio) best = { it, ratio, score };
    }

    // If no candidate helps, try regular L7 of the most needed stat's type if available
    if (!best) {
      // pick stat with highest residual and choose any type that contributes to it
      let topStat = null; let topNeed = 0;
      Object.entries(residual).forEach(([stat, need]) => { if (need > topNeed) { topNeed = need; topStat = stat; } });
      if (topNeed > 0) {
        // Find any type that provides this stat and we have L7 for
        const type = Object.keys(POWER_STONES).find(t => POWER_STONES[t].defensive === topStat && (inv.l7[t] || 0) > 0);
        if (type) {
          const reg = makeItem('regular', [type], 0, `L7 ${type}`);
          if (mergesUsed + reg.mergesCost <= maxMerges) {
            // Apply it directly if feasible by UB check
            const nextRes = residualAfter(residual, reg);
            const socketsLeft = socketsBudget - (socketsUsed + 1);
            if (canPossiblyMeet(nextRes, socketsLeft, ubPerSocket)) {
              applyItem(reg, inv);
              seqGreedy.push(reg);
              residual = nextRes;
              socketsUsed += 1;
              continue;
            }
          }
        }
      }
      break; // can't progress
    }

    const pick = best.it;
    const nextRes = residualAfter(residual, pick);
    const socketsLeft = socketsBudget - (socketsUsed + 1);
    if (!canPossiblyMeet(nextRes, socketsLeft, ubPerSocket)) {
      // skip this item by removing temporarily from pool for this iteration
      // Mark as not selectable by setting a flag
      currentCandidates.splice(currentCandidates.indexOf(pick), 1);
      continue;
    }

    // Apply
    applyItem(pick, inv);
    seqGreedy.push(pick);
    residual = nextRes;
    socketsUsed += 1;
    mergesUsed += pick.mergesCost;
  }

  const fullSeq = [...preSequence, ...seqGreedy];

  // Validate achievement
  const achieved = {};
  fullSeq.forEach(it => { for (const [stat, val] of Object.entries(it.contrib)) achieved[stat] = (achieved[stat]||0) + val; });
  const unmet = Object.entries(residual0).filter(([stat, goal]) => (achieved[stat]||0) + 1e-6 < goal);

  // If greedy missed, try a last resort: fill remaining sockets with megas focusing on top 3-4 types
  if (unmet.length > 0 && startSocketsUsed + fullSeq.length < DEFENSIVE_SOCKETS) {
    const socketsLeft = DEFENSIVE_SOCKETS - (startSocketsUsed + fullSeq.length);
    const neededTypes = Array.from(new Set(Object.keys(residual).filter(stat => (residual[stat]||0) > 0).map(stat => {
        return Object.keys(POWER_STONES).find(x => POWER_STONES[x].defensive === stat);
    }).filter(Boolean)));
    if (neededTypes.length >= 3 && neededTypes.length <= 4) {
      const reduced = neededTypes.map(type => ({ type, goal: Math.max(0, residual[POWER_STONES[type].defensive] || 0) }));
      const seq = tryExactMegaMix(reduced, socketsLeft);
      if (seq) {
        seq.forEach(it => fullSeq.push(it));
      }
    }
  }

  // Substitute with existing combos where possible to reduce merges
  const seqSub = substituteExisting(fullSeq, inventoryInput);

  // Compute final plan summary
  const used = { l7: {}, supers: {}, megas: {} };
  const mergesPlanned = [];
  let mergesCount = 0;
  const invLeft = cloneInv(inventoryInput || {});
  const inc = (obj, key, delta=1) => { obj[key] = (obj[key]||0) + delta; };
  const achievedFinal = {};
  seqSub.forEach(item => {
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
      if (!(a === b || a === c || b === c)) {
        inc(used.l7, a, 1); invLeft.l7[a] = (invLeft.l7[a]||0) - 1;
        inc(used.l7, b, 1); invLeft.l7[b] = (invLeft.l7[b]||0) - 1;
        inc(used.l7, c, 1); invLeft.l7[c] = (invLeft.l7[c]||0) - 1;
        mergesPlanned.push({ type: 'mega', primary: a, secondary: b, tertiary: c });
      }
    } else if (item.kind === 'super-existing') {
      const [a,b] = item.parts;
      inc(used.supers, `${a}+${b}`, 1);
      let s = invLeft.supers.find(x => x.primary === a && x.secondary === b);
      if (!s) s = invLeft.supers.find(x => x.primary === b && x.secondary === a);
      if (s) s.qty = Math.max(0, (s.qty||0) - 1);
    } else if (item.kind === 'mega-existing') {
      const [a,b,c] = item.parts;
      inc(used.megas, `${a}+${b}+${c}`, 1);
      let m = invLeft.megas.find(x => x.primary === a && x.secondary === b && x.tertiary === c);
      if (!m) m = invLeft.megas.find(x => x.primary === a && x.secondary === c && x.tertiary === b);
      if (m) m.qty = Math.max(0, (m.qty||0) - 1);
    } else if (item.kind === 'upgrade-super-to-mega') {
      const [a,b,c] = item.parts;
      inc(used.l7, c, 1); invLeft.l7[c] = (invLeft.l7[c]||0) - 1;
      inc(used.supers, `${a}+${b}`, 1);
      mergesPlanned.push({ type: 'upgrade', primary: a, secondary: b, tertiary: c });
      let s = invLeft.supers.find(x => x.primary === a && x.secondary === b);
      if (!s) s = invLeft.supers.find(x => x.primary === b && x.secondary === a);
      if (s) s.qty = Math.max(0, (s.qty||0) - 1);
    }
    for (const [stat, val] of Object.entries(item.contrib)) {
      achievedFinal[stat] = (achievedFinal[stat] || 0) + val;
    }
  });

  const missingL7 = {};
  Object.keys(invLeft.l7 || {}).forEach(t => { if (invLeft.l7[t] < 0) missingL7[t] = -invLeft.l7[t]; });

  const plan = {
    sockets: seqSub.map(it => ({ kind: it.kind, parts: it.parts, label: it.label, contrib: it.contrib })),
    mergesUsed: mergesCount,
    merges: mergesPlanned,
    usedL7: used.l7,
    usedExistingSupers: used.supers,
    usedExistingMegas: used.megas,
    missingL7,
    socketsUsed: seqSub.length,
    socketsAvailableDef: SOCKET_LIMITS.defensive,
    socketsAvailableOff: SOCKET_LIMITS.offensive,
    goals: residual0,
    achieved: achievedFinal
  };

  // Success if all goals met and sockets not exceeded
  const success = Object.entries(residual0).every(([stat, goal]) => (achievedFinal[stat] || 0) + 1e-6 >= goal) && (seqSub.length) <= DEFENSIVE_SOCKETS;
  if (!success) {
    return { success: false, reason: 'Goals not fully met within socket or merge limits', plan };
  }
  return { success: true, plan };
}
