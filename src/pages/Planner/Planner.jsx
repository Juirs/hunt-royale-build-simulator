// filepath: src/pages/Planner/Planner.jsx
import React, { useMemo, useState } from 'react';
import '../Home/HuntRoyaleSimulator.css';
import { POWER_STONES } from '../../constants/powerStones.js';
import { buildTargets, planBuild, stoneTypeName } from '../../helpers/planner.js';
import { SOCKET_LIMITS } from '../../helpers/planner.js';

const ALL_TYPES = Object.keys(POWER_STONES);
const DEF_STATS = Array.from(new Set(ALL_TYPES.map(t => POWER_STONES[t].defensive)));

const defaultGoals = [
  { stat: 'Dodge Chance', value: '90' },
  { stat: 'Zombie Damage Reduction', value: '90' },
  { stat: 'Damage Reduction', value: '70' }
];

const Planner = () => {
  const [goals, setGoals] = useState(defaultGoals);
  const [l7, setL7] = useState(() => Object.fromEntries(ALL_TYPES.map(t => [t, 0])));
  const [supers, setSupers] = useState([]); // { primary, secondary, qty }
  const [megas, setMegas] = useState([]); // { primary, secondary, tertiary, qty }
  const [maxMerges, setMaxMerges] = useState(24);
  const [disablePrefill, setDisablePrefill] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);

  // Ensure selections remain distinct
  const pickFirstDifferent = (exclude) => ALL_TYPES.find(t => !exclude.includes(t)) || ALL_TYPES[0];
  const normalizeSuper = (s) => {
    const primary = s.primary;
    let secondary = s.secondary;
    if (!secondary || secondary === primary) {
      secondary = pickFirstDifferent([primary]);
    }
    return { ...s, primary, secondary };
  };
  const normalizeMega = (m) => {
    const primary = m.primary;
    let secondary = m.secondary;
    let tertiary = m.tertiary;
    if (!secondary || secondary === primary) {
      secondary = pickFirstDifferent([primary]);
    }
    if (!tertiary || tertiary === primary || tertiary === secondary) {
      tertiary = pickFirstDifferent([primary, secondary]);
    }
    return { ...m, primary, secondary, tertiary };
  };

  // Build friendly goal stat options from POWER_STONES defensives
  const GOAL_STAT_OPTIONS = useMemo(() => {
    const unique = Array.from(new Set(Object.values(POWER_STONES).map(s => s.defensive)));
    const labelFor = (key) => {
      switch (key) {
        case 'ZDR': return 'Zombie Damage Reduction';
        case 'DR': return 'Damage Reduction';
        case 'MS': return 'Movement Speed';
        case 'XP': return 'Experience';
        case 'Stun': return 'Stun Chance';
        case 'Dodge': return 'Dodge Chance';
        case 'Poison Resistance': return 'Poison Resist';
        default: return key; // 'HP', 'Deep Freeze', etc.
      }
    };
    return unique
      .map(k => ({ value: labelFor(k), label: labelFor(k) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const targetPreview = useMemo(() => buildTargets(goals), [goals]);

  const onChangeGoal = (idx, key, value) => {
    setGoals(prev => prev.map((g, i) => i === idx ? { ...g, [key]: key === 'value' ? String(value) : value } : g));
  };

  const addGoalRow = () => setGoals(prev => [...prev, { stat: GOAL_STAT_OPTIONS[0]?.value || DEF_STATS[0] || 'Dodge Chance', value: '' }]);
  const removeGoalRow = (idx) => setGoals(prev => prev.filter((_, i) => i !== idx));

  const updateL7 = (type, val) => {
    setL7(prev => ({ ...prev, [type]: Math.max(0, Number(val) || 0) }));
  };

  const addSuperRow = () => setSupers(prev => [...prev, { primary: ALL_TYPES[0], secondary: ALL_TYPES[1] || ALL_TYPES[0], qty: 1 }]);
  const updateSuper = (idx, key, val) => {
    setSupers(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const next = normalizeSuper({ ...s, [key]: key === 'qty' ? Math.max(0, Number(val)||0) : val });
      return next;
    }));
  };
  const removeSuper = (idx) => setSupers(prev => prev.filter((_, i) => i !== idx));

  const addMegaRow = () => setMegas(prev => [...prev, { primary: ALL_TYPES[0], secondary: ALL_TYPES[1] || ALL_TYPES[0], tertiary: ALL_TYPES[2] || ALL_TYPES[0], qty: 1 }]);
  const updateMega = (idx, key, val) => {
    setMegas(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      const next = normalizeMega({ ...m, [key]: key === 'qty' ? Math.max(0, Number(val)||0) : val });
      return next;
    }));
  };
  const removeMega = (idx) => setMegas(prev => prev.filter((_, i) => i !== idx));

  const runPlan = () => {
    setError('');
    setResult(null);
    setIsPlanning(true);

    const inventory = {
      l7,
      supers: supers.filter(s => s.qty > 0).map(normalizeSuper),
      megas: megas.filter(m => m.qty > 0).map(normalizeMega)
    };
    const options = { maxMerges, timeLimitMs: 1000, beamWidth: 16, topChildren: 10, disablePrefill };

    // Try worker-based planning to avoid UI freeze
    try {
      const worker = new Worker(new URL('../../workers/plannerWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const data = e.data || {};
        if (!data.success) {
          setError(data.reason || 'Planning failed');
        } else {
          setResult(data.plan);
        }
        setIsPlanning(false);
        worker.terminate();
      };
      worker.onerror = () => {
        setError('Planning failed');
        setIsPlanning(false);
        worker.terminate();
      };
      worker.postMessage({ goals, inventory, options });
    } catch {
      const { success, plan, reason } = planBuild(goals, inventory, options);
      if (!success) setError(reason || 'Planning failed'); else setResult(plan);
      setIsPlanning(false);
    }
  };

  const Section = ({ title, children }) => (
    <div className="panel">
      <div className="section-title">{title}</div>
      {children}
    </div>
  );

  const Select = ({ value, onChange, options, title }) => (
    <select value={value} onChange={e => onChange(e.target.value)} title={title}>
      {options.map(opt => (
        <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
      ))}
    </select>
  );

  return (
    <div className="hunt-royale-simulator">
      <div className="container">
        <div className="header">
          <h1>Planner</h1>
          <p>Compute the minimal merges needed to hit your defensive goals with your inventory.</p>
        </div>

        <div className="main-layout" style={{ gridTemplateColumns: '420px 1fr 380px' }}>
          {/* Left: Goals and Options */}
          <div className="left-col">
            <Section title="Goals">
              <div className="stone-instruction">Enter target percentages for defensive stats. We'll plan the least merges.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {goals.map((g, idx) => (
                  <div key={idx} className="stone-item" style={{ cursor: 'default' }}>
                    <div className="stone-row-title">
                      <span className="stone-name">Goal #{idx+1}</span>
                      <button className="btn" onClick={() => removeGoalRow(idx)}>Remove</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Select
                        value={g.stat}
                        onChange={(v) => onChangeGoal(idx, 'stat', v)}
                        options={GOAL_STAT_OPTIONS}
                        title="Stat"
                      />
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={g.value ?? ''}
                        onChange={(e) => onChangeGoal(idx, 'value', e.target.value)}
                        style={{ width: 100 }}
                      />
                      <span>%</span>
                    </div>
                  </div>
                ))}
                <button className="btn" onClick={addGoalRow}>+ Add Goal</button>
              </div>
            </Section>

            <Section title="Options">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label>Max Merges <input type="number" min="0" max="100" value={maxMerges} onChange={e => setMaxMerges(Math.max(0, Number(e.target.value)||0))} style={{ width: 80 }} /></label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title="When enabled, the planner will not prefill with existing L7/supers/megas before planning."><input type="checkbox" checked={disablePrefill} onChange={e => setDisablePrefill(e.target.checked)} /> Disable Prefill</label>
                <button className="btn" onClick={runPlan} disabled={isPlanning}>{isPlanning ? 'Planning…' : 'Plan'}</button>
              </div>
              <div className="stone-instruction" style={{ marginTop: 8 }}>
                Defensive sockets: {SOCKET_LIMITS.defensive} • Offensive sockets: {SOCKET_LIMITS.offensive}
              </div>
              {/* Preview targets breakdown */}
              {targetPreview?.targets?.length > 0 && (
                <div className="stone-instruction" style={{ marginTop: 12 }}>
                  Target breakdown: {targetPreview.targets.map(t => `${t.stat} via ${stoneTypeName(t.type)}: ${t.goal}`).join(' • ')}
                </div>
              )}
              {error && <div className="merge-instructions" style={{ borderColor: '#ff6b6b', color: '#ff6b6b' }}>{error}</div>}
            </Section>
          </div>

          {/* Middle: Inventory */}
          <div className="center-col">
            <Section title="Your Inventory">
              <div className="stone-type-section">
                <div className="stone-type-header"><div className="stone-type-info"><span className="stone-type-name">Level 7 Stones</span></div></div>
                <div className="stone-levels-grid stone-levels-regular">
                  {ALL_TYPES.map(t => (
                    <div key={t} className="stone-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="stone-name" style={{ ['--stone-color']: POWER_STONES[t].color }}>{POWER_STONES[t].name}</span>
                      <span style={{ marginLeft: 'auto' }}>Count:</span>
                      <input type="number" min="0" value={l7[t]} onChange={(e) => updateL7(t, e.target.value)} style={{ width: 80 }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="stone-type-section">
                <div className="stone-type-header"><div className="stone-type-info"><span className="stone-type-name-super">Super Stones</span></div><button className="btn" onClick={addSuperRow}>+ Add</button></div>
                {supers.length === 0 && <div className="stone-instruction">No super stones added</div>}
                {supers.map((s, idx) => (
                  <div key={idx} className="stone-item" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <Select value={s.primary} onChange={v => updateSuper(idx, 'primary', v)} options={ALL_TYPES.map(t => ({ value: t, label: POWER_STONES[t].name }))} />
                    <Select value={s.secondary} onChange={v => updateSuper(idx, 'secondary', v)} options={ALL_TYPES.filter(t => t!==s.primary).map(t => ({ value: t, label: POWER_STONES[t].name }))} />
                    <input type="number" min="0" value={s.qty} onChange={e => updateSuper(idx, 'qty', e.target.value)} />
                    <button className="btn" onClick={() => removeSuper(idx)}>Remove</button>
                  </div>
                ))}
              </div>

              <div className="stone-type-section">
                <div className="stone-type-header"><div className="stone-type-info"><span className="stone-type-name-mega">Mega Stones</span></div><button className="btn" onClick={addMegaRow}>+ Add</button></div>
                {megas.length === 0 && <div className="stone-instruction">No mega stones added</div>}
                {megas.map((m, idx) => (
                  <div key={idx} className="stone-item" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <Select value={m.primary} onChange={v => updateMega(idx, 'primary', v)} options={ALL_TYPES.map(t => ({ value: t, label: POWER_STONES[t].name }))} />
                    <Select value={m.secondary} onChange={v => updateMega(idx, 'secondary', v)} options={ALL_TYPES.filter(t => t!==m.primary).map(t => ({ value: t, label: POWER_STONES[t].name }))} />
                    <Select value={m.tertiary} onChange={v => updateMega(idx, 'tertiary', v)} options={ALL_TYPES.filter(t => t!==m.primary && t!==m.secondary).map(t => ({ value: t, label: POWER_STONES[t].name }))} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" min="0" value={m.qty} onChange={e => updateMega(idx, 'qty', e.target.value)} style={{ width: 80 }} />
                      <button className="btn" onClick={() => removeMega(idx)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Right: Plan Result */}
          <div className="right-col">
            <Section title="Plan Result">
              {!result && !error && (
                <div className="no-stats-container"><p className="no-stats-text">Set goals and inventory, then click Plan.</p></div>
              )}
              {result && (
                <div className="raw-stats-display">
                  <div className="stat-category">
                    <div className="stat-category-title">Summary</div>
                    <div className="raw-stat-row"><span className="raw-stat-name">Merges</span><span className="raw-stat-value">{result.mergesUsed}</span></div>
                    <div className="raw-stat-row"><span className="raw-stat-name">Sockets Used</span><span className="raw-stat-value">{result.socketsUsed} / {result.socketsAvailableDef || SOCKET_LIMITS.defensive}</span></div>
                  </div>

                  <div className="stat-category">
                    <div className="stat-category-title">Missing Level 7 Stones</div>
                    {Object.keys(result.missingL7||{}).length === 0 ? (
                      <div className="raw-stat-row"><span className="raw-stat-name">None</span></div>
                    ) : (
                      Object.entries(result.missingL7).map(([t, c]) => (
                        <div key={t} className="raw-stat-row"><span className="raw-stat-name">{stoneTypeName(t)}</span><span className="raw-stat-value">x{c}</span></div>
                      ))
                    )}
                  </div>

                  <div className="stat-category">
                    <div className="stat-category-title">Level 7 Stones Used</div>
                    {Object.keys(result.usedL7||{}).length === 0 ? (
                      <div className="raw-stat-row"><span className="raw-stat-name">None</span></div>
                    ) : (
                      Object.entries(result.usedL7).map(([t, c]) => (
                        <div key={t} className="raw-stat-row"><span className="raw-stat-name">{stoneTypeName(t)}</span><span className="raw-stat-value">x{c}</span></div>
                      ))
                    )}
                  </div>

                  <div className="stat-category">
                    <div className="stat-category-title">Existing Stones Used</div>
                    {(() => {
                      const sockets = result.sockets || [];
                      const sup = new Map();
                      const meg = new Map();
                      for (const s of sockets) {
                        if (!s) continue;
                        if (s.kind === 'super-existing') {
                          const [a,b] = s.parts || [];
                          const key = `${a}+${b}`;
                          sup.set(key, (sup.get(key) || 0) + 1);
                        } else if (s.kind === 'mega-existing') {
                          const [a,b,c] = s.parts || [];
                          const key = `${a}+${b}+${c}`;
                          meg.set(key, (meg.get(key) || 0) + 1);
                        } else if (s.kind === 'upgrade-super-to-mega') {
                          const [a,b] = s.parts || [];
                          const key = `${a}+${b}`;
                          sup.set(key, (sup.get(key) || 0) + 1);
                        }
                      }
                      const supEntries = Array.from(sup.entries());
                      const megEntries = Array.from(meg.entries());
                      if (supEntries.length === 0 && megEntries.length === 0) {
                        return (<div className="raw-stat-row"><span className="raw-stat-name">None</span></div>);
                      }
                      return (
                        <>
                          {supEntries.map(([k, c]) => (
                            <div key={`s-${k}`} className="raw-stat-row"><span className="raw-stat-name">Super {k.replace(/\+/g, ' + ')}</span><span className="raw-stat-value">x{c}</span></div>
                          ))}
                          {megEntries.map(([k, c]) => (
                            <div key={`m-${k}`} className="raw-stat-row"><span className="raw-stat-name">Mega {k.replace(/\+/g, ' + ')}</span><span className="raw-stat-value">x{c}</span></div>
                          ))}
                        </>
                      );
                    })()}
                  </div>

                  <div className="stat-category">
                    <div className="stat-category-title">Sockets Plan (Defensive)</div>
                    {(() => {
                      const formatSocket = (s) => {
                        if (!s) return 'Empty';
                        const p = s.parts || [];
                        const toName = (t) => t; // keep type keys to match plan output; swap to stoneTypeName(t) for proper names if desired
                        switch (s.kind) {
                          case 'regular': return `L7 ${toName(p[0])}`;
                          case 'super': return `Super ${toName(p[0])} + ${toName(p[1])}`;
                          case 'super-existing': return `Existing Super ${toName(p[0])} + ${toName(p[1])}`;
                          case 'mega': return `Mega ${toName(p[0])} + ${toName(p[1])} + ${toName(p[2])}`;
                          case 'mega-existing': return `Existing Mega ${toName(p[0])} + ${toName(p[1])} + ${toName(p[2])}`;
                          case 'upgrade-super-to-mega': return `Upgrade Super ${toName(p[0])} + ${toName(p[1])} -> + ${toName(p[2])}`;
                          default: return s.label || 'Unknown';
                        }
                      };
                      const total = result.socketsAvailableDef || SOCKET_LIMITS.defensive;
                      const filled = result.sockets || [];
                      const padded = [...filled, ...Array(Math.max(0, total - filled.length)).fill(null)];
                      return padded.map((s, idx) => (
                        <div key={idx} className="raw-stat-row">
                          <span className="raw-stat-name">Slot {idx+1}</span>
                          <span className="raw-stat-value">{formatSocket(s)}</span>
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="stat-category">
                    <div className="stat-category-title">Planned Merges</div>
                    {result.merges.length === 0 ? (
                      <div className="raw-stat-row"><span className="raw-stat-name">None</span></div>
                    ) : (
                      result.merges.map((m, idx) => (
                        <div key={idx} className="raw-stat-row"><span className="raw-stat-name">{m.type.toUpperCase()}</span><span className="raw-stat-value">{m.primary} + {m.secondary}{m.tertiary ? ` + ${m.tertiary}` : ''}</span></div>
                      ))
                    )}
                  </div>

                  {/* Cost Breakdown */}
                  {(() => {
                    const merges = result.merges || [];
                    const superFromSuper = merges.filter(m => m.type === 'super').length;
                    const megaFromMega = merges.filter(m => m.type === 'mega').length; // counts both a super and a mega merge
                    const megaFromUpgrade = merges.filter(m => m.type === 'upgrade').length; // counts only a mega merge

                    const superMerges = superFromSuper + megaFromMega;
                    const megaMerges = megaFromMega + megaFromUpgrade;

                    const COSTS = {
                      super: { gold: 5000, df: 5000, fs: 777 },
                      mega:  { gold: 10000, df: 10000, fs: 2777 }
                    };

                    const totalGold = superMerges * COSTS.super.gold + megaMerges * COSTS.mega.gold;
                    const totalDF   = superMerges * COSTS.super.df   + megaMerges * COSTS.mega.df;
                    const totalFS   = superMerges * COSTS.super.fs   + megaMerges * COSTS.mega.fs;

                    const fmt = (n) => Number(n).toLocaleString();

                    return (
                      <div className="stat-category">
                        <div className="stat-category-title">Cost Breakdown</div>
                        <div className="raw-stat-row"><span className="raw-stat-name">Super Merges</span><span className="raw-stat-value">{fmt(superMerges)}</span></div>
                        <div className="raw-stat-row"><span className="raw-stat-name">Mega Merges</span><span className="raw-stat-value">{fmt(megaMerges)}</span></div>
                        <div className="raw-stat-row"><span className="raw-stat-name">Gold</span><span className="raw-stat-value">{fmt(totalGold)}</span></div>
                        <div className="raw-stat-row"><span className="raw-stat-name">DF Gems</span><span className="raw-stat-value">{fmt(totalDF)}</span></div>
                        <div className="raw-stat-row"><span className="raw-stat-name">FS Gems</span><span className="raw-stat-value">{fmt(totalFS)}</span></div>
                      </div>
                    );
                  })()}

                  <div className="stat-category">
                    <div className="stat-category-title">Achieved vs Goals</div>
                    {Object.entries(result.goals).map(([stat, target]) => {
                      const achievedVal = (result.achieved[stat] ?? 0);
                      return (
                        <div key={stat} className="raw-stat-row">
                          <span className="raw-stat-name">{stat}</span>
                          <span className="raw-stat-value">{achievedVal.toFixed(2)} / {target.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Planner;
