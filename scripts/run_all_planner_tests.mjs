// Auto-run all scripts in scripts/ that use planBuild and ensure they return { success: true }
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptsDir = path.join(__dirname);

function findPlannerScripts() {
  const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.mjs'));
  const plannerFiles = [];
  for (const f of files) {
    if (f === 'run_all_planner_tests.mjs') continue; // exclude self
    const p = path.join(scriptsDir, f);
    const txt = fs.readFileSync(p, 'utf8');
    if (txt.includes('planBuild(')) plannerFiles.push(p);
  }
  return plannerFiles;
}

function runNodeScript(file) {
  return new Promise((resolve) => {
    execFile(process.execPath, [file], { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
      if (err) {
        resolve({ file, ok: false, error: `Execution error: ${err.message}`, stdout, stderr });
        return;
      }
      try {
        const jsonStr = stdout.trim();
        const json = JSON.parse(jsonStr);
        const ok = !!json && json.success === true;
        resolve({ file, ok, result: json, stdout, stderr });
      } catch (e) {
        resolve({ file, ok: false, error: `Failed to parse JSON output: ${e.message}`, stdout, stderr });
      }
    });
  });
}

async function main() {
  const plannerScripts = findPlannerScripts();
  if (plannerScripts.length === 0) {
    console.log('No planner scripts found to run.');
    return;
  }
  console.log(`Found ${plannerScripts.length} planner scripts:`);
  plannerScripts.forEach(f => console.log('- ' + path.basename(f)));
  let pass = 0, fail = 0;
  const results = [];
  for (const file of plannerScripts) {
    /* eslint-disable no-await-in-loop */
    const res = await runNodeScript(file);
    if (res.ok) pass++; else fail++;
    results.push(res);
  }
  console.log('\nSummary:');
  results.forEach(r => {
    console.log(`${path.basename(r.file)} -> ${r.ok ? 'PASS' : 'FAIL'}`);
    if (!r.ok) {
      console.log('  Error:', r.error || 'Unknown');
      if (r.stdout) console.log('  Stdout:', r.stdout.slice(0, 500));
      if (r.stderr) console.log('  Stderr:', r.stderr.slice(0, 500));
    }
  });
  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(2); });
