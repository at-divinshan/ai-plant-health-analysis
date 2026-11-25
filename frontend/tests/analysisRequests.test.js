import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// Execute the real App handler with lightweight React/service adapters. No server or DB.
test('rapid Analyze submissions send one request and unlock after success or failure', async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/App.jsx', import.meta.url))],
    bundle: true, write: false, format: 'iife', globalName: 'Application', jsxFactory: 'h',
    plugins: [{ name: 'offline-adapters', setup(b) {
      b.onResolve({ filter: /^(react|lucide-react)$|^\.\// }, args => {
        if (args.kind === 'entry-point') return;
        return { path: args.path, namespace: 'adapter' };
      });
      b.onLoad({ filter: /.*/, namespace: 'adapter' }, args => {
        if (args.path === 'react') return { contents: 'export const useState=globalThis.state,useRef=v=>({current:v}),useEffect=()=>{},useCallback=f=>f;' };
        if (args.path === 'lucide-react') return { contents: 'export const Leaf=0,Sprout=0,ArrowUpRight=0,ArrowRight=0,Sparkles=0,ShieldCheck=0,ClipboardList=0,ScanLine=0,HeartHandshake=0,AlertCircle=0;' };
        if (args.path.endsWith('plantService.js')) return { contents: 'export const analyzePlant=(...args)=>globalThis.send(...args);' };
        if (args.path.endsWith('savedAnalyses.js')) return { contents: 'export const listSavedAnalyses=()=>[],importBrowserAnalyses=()=>{},saveAnalysis=()=>{},deleteAnalysis=()=>{};' };
        return { contents: `export default ${JSON.stringify(args.path)};` };
      });
    } }],
  });
  let submit, resolve, reject, calls = 0;
  const context = { state: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    window: { location: { hash: '' } },
    h: (type, props, ...children) => { if (String(type).endsWith('PlantForm.jsx')) submit = props.onSubmit; return { type, props, children }; },
    send: () => { calls++; return new Promise((yes, no) => { resolve = yes; reject = no; }); },
  };
  vm.createContext(context); vm.runInContext(result.outputFiles[0].text, context);
  context.Application.default();
  const first = submit({ plant_name: 'Tomato' }, null);
  await submit({ plant_name: 'Tomato' }, null);
  assert.equal(calls, 1);
  resolve({ possible_issue: 'Healthy' }); await first;
  const second = submit({ plant_name: 'Tomato' }, null);
  assert.equal(calls, 2);
  reject(new Error('Timeout')); await second;
  const third = submit({ plant_name: 'Tomato' }, null);
  assert.equal(calls, 3);
  resolve({}); await third;
});
