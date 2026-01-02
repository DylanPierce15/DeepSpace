#!/usr/bin/env node

/**
 * Bundle Templates (esbuild)
 * - For each widget-* directory, bundle template.jsx with React/DOM shims
 * - Emits template.html (IIFE bundle + auto-render)
 */

const fs = require('fs');
const path = require('path');
let esbuild;
try { esbuild = require('esbuild'); }
catch (e) {
  try { esbuild = require('/app/node_modules/esbuild'); }
  catch (e2) {
    console.error('[bundle] esbuild not found. Please ensure it is installed in the container.');
    process.exit(1);
  }
}

function log(msg) { console.log(`[bundle] ${msg}`); }
function warn(msg) { console.warn(`[bundle] ⚠️ ${msg}`); }

function findWidgetDirs(rootDir) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name.startsWith('widget-')) {
          out.push(path.join(dir, e.name));
        } else if (!e.name.startsWith('.git') && !e.name.startsWith('node_modules') && !e.name.startsWith('.')) {
          walk(path.join(dir, e.name));
        }
      }
    }
  };
  walk(rootDir);
  return out;
}

function reactShimContents() {
  return `
    const React = (window).React;
    export default React;
    export const {
      useState, useEffect, useMemo, useCallback, useRef,
      useContext, useReducer, useLayoutEffect, useImperativeHandle,
      useDebugValue, useDeferredValue, useId, useInsertionEffect,
      useSyncExternalStore, useTransition
    } = React;
  `;
}

function reactDomShimContents() {
  return `
    const ReactDOM = (window).ReactDOM;
    export default ReactDOM;
  `;
}

function shimPlugin() {
  return {
    name: 'shim-react-globals',
    setup(build) {
      build.onResolve({ filter: /^react$/ }, () => ({ path: 'react-shim', namespace: 'shim' }));
      build.onResolve({ filter: /^react-dom$/ }, () => ({ path: 'react-dom-shim', namespace: 'shim' }));
      build.onLoad({ filter: /react-shim/, namespace: 'shim' }, () => ({ contents: reactShimContents(), loader: 'tsx' }));
      build.onLoad({ filter: /react-dom-shim/, namespace: 'shim' }, () => ({ contents: reactDomShimContents(), loader: 'tsx' }));
    }
  };
}

function buildBanner() {
  return `/* Bundled widget */
// expose Miyagi globals inside bundle scope
var useGlobalStorage = (window && window.useGlobalStorage) || undefined;
var useStorage = (window && window.useStorage) || undefined;
var miyagiAPI = (window && window.miyagiAPI) || undefined;
var miyagiWidgetLog = (window && window.miyagiWidgetLog) || undefined;
// make React hooks available as top-level vars for files that don't import react
var __R = (window && window.React) || undefined;
var useState = (typeof useState !== 'undefined') ? useState : (__R ? __R.useState : undefined);
var useEffect = (typeof useEffect !== 'undefined') ? useEffect : (__R ? __R.useEffect : undefined);
var useMemo = (typeof useMemo !== 'undefined') ? useMemo : (__R ? __R.useMemo : undefined);
var useCallback = (typeof useCallback !== 'undefined') ? useCallback : (__R ? __R.useCallback : undefined);
var useRef = (typeof useRef !== 'undefined') ? useRef : (__R ? __R.useRef : undefined);
var useContext = (typeof useContext !== 'undefined') ? useContext : (__R ? __R.useContext : undefined);
var useReducer = (typeof useReducer !== 'undefined') ? useReducer : (__R ? __R.useReducer : undefined);
var useLayoutEffect = (typeof useLayoutEffect !== 'undefined') ? useLayoutEffect : (__R ? __R.useLayoutEffect : undefined);
var useImperativeHandle = (typeof useImperativeHandle !== 'undefined') ? useImperativeHandle : (__R ? __R.useImperativeHandle : undefined);
var useDebugValue = (typeof useDebugValue !== 'undefined') ? useDebugValue : (__R ? __R.useDebugValue : undefined);
var useDeferredValue = (typeof useDeferredValue !== 'undefined') ? useDeferredValue : (__R ? __R.useDeferredValue : undefined);
var useId = (typeof useId !== 'undefined') ? useId : (__R ? __R.useId : undefined);
var useInsertionEffect = (typeof useInsertionEffect !== 'undefined') ? useInsertionEffect : (__R ? __R.useInsertionEffect : undefined);
var useSyncExternalStore = (typeof useSyncExternalStore !== 'undefined') ? useSyncExternalStore : (__R ? __R.useSyncExternalStore : undefined);
var useTransition = (typeof useTransition !== 'undefined') ? useTransition : (__R ? __R.useTransition : undefined);`;
}

/**
 * Wrap bundled JS in HTML with error indicator (Next.js style).
 * This is kept in sync with packages/widget-bundler/index.js wrapInHtml().
 */
function wrapInHtml(js) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>React Widget</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <style>
    body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
    #react-root{width:100%;height:100vh;display:flex;flex-direction:column;}
    /* Error indicator styles */
    #__err{position:fixed;bottom:16px;right:16px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;}
    #__err-badge{display:flex;align-items:center;gap:8px;padding:8px 14px;background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:white;border-radius:20px;cursor:pointer;box-shadow:0 4px 12px rgba(220,38,38,0.3);transition:all 0.2s ease;font-weight:500;}
    #__err-badge:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(220,38,38,0.4);}
    #__err-badge svg{width:16px;height:16px;opacity:0.9;}
    #__err-panel{display:none;position:absolute;bottom:100%;right:0;margin-bottom:12px;width:360px;max-height:320px;background:#18181b;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);overflow:hidden;border:1px solid rgba(255,255,255,0.06);}
    #__err-panel.open{display:block;}
    #__err-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);}
    #__err-header span{color:#f87171;font-weight:600;font-size:14px;}
    #__err-close{background:none;border:none;color:#71717a;cursor:pointer;font-size:20px;line-height:1;padding:4px;border-radius:4px;transition:all 0.15s;}
    #__err-close:hover{color:#fff;background:rgba(255,255,255,0.1);}
    #__err-list{max-height:180px;overflow-y:auto;padding:12px;}
    .err-item{padding:12px;margin-bottom:8px;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid #ef4444;}
    .err-item:last-child{margin-bottom:0;}
    .err-msg{color:#fca5a5;font-weight:500;margin-bottom:6px;word-break:break-word;line-height:1.4;}
    .err-stack{color:#71717a;font-size:11px;font-family:'SF Mono',Monaco,monospace;white-space:pre-wrap;word-break:break-all;max-height:50px;overflow:hidden;line-height:1.5;padding:8px;background:rgba(0,0,0,0.2);border-radius:4px;margin-top:6px;}
    #__err-actions{padding:12px 16px;background:rgba(255,255,255,0.03);border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:10px;}
    #__err-actions button{flex:1;padding:10px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;}
    #__err-send{background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:white;}
    #__err-send:hover{filter:brightness(1.1);transform:translateY(-1px);}
    #__err-clear{background:rgba(255,255,255,0.06);color:#a1a1aa;}
    #__err-clear:hover{background:rgba(255,255,255,0.1);color:#fff;}
    /* Blank screen overlay - hidden by default, shown when widget crashes */
    #__err-blank{position:absolute;top:0;left:0;right:0;bottom:0;z-index:99998;background:linear-gradient(135deg,#fef2f2 0%,#fff 100%);flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box;display:none;}
    #__err-blank.show{display:flex;}
    #__err-blank-icon{width:48px;height:48px;color:#dc2626;margin-bottom:16px;}
    #__err-blank h3{margin:0 0 8px;font-size:16px;font-weight:600;color:#991b1b;}
    #__err-blank p{margin:0 0 16px;font-size:13px;color:#7f1d1d;max-width:280px;}
    #__err-blank-send{padding:10px 20px;background:#dc2626;color:white;border:none;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;transition:background 0.15s;}
    #__err-blank-send:hover{background:#b91c1c;}
  </style>
</head>
<body>
  <div id="react-root"></div>
  <div id="__err-blank">
    <svg id="__err-blank-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <h3>Widget Error</h3>
    <p>This widget crashed and cannot display.</p>
    <button id="__err-blank-send">Send to Chat</button>
  </div>
  <div id="__err" style="display:none">
    <div id="__err-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span id="__err-count">0</span> error(s)
    </div>
    <div id="__err-panel">
      <div id="__err-header">
        <span>Widget Errors</span>
        <button id="__err-close">&times;</button>
      </div>
      <div id="__err-list"></div>
      <div id="__err-actions">
        <button id="__err-send">Send to Chat</button>
        <button id="__err-clear">Clear</button>
      </div>
    </div>
  </div>
  <script>${js}</script>
  <script>
    (function(){
      var errors = [];

      function getShapeId() {
        try {
          var iframe = window.frameElement;
          if (iframe && iframe.dataset && iframe.dataset.shapeId) return iframe.dataset.shapeId;
        } catch (e) {}
        return 'unknown';
      }

      function addError(error) {
        var err = {
          message: error ? (error.message || String(error)) : 'Unknown error',
          stack: error && error.stack ? error.stack.split('\\n').slice(0, 4).join('\\n') : null,
          time: new Date().toLocaleTimeString()
        };
        errors.push(err);
        updateUI();
      }

      function isWidgetBlank() {
        var root = document.getElementById('react-root');
        if (!root) return true;
        return root.children.length === 0 && (!root.textContent || !root.textContent.trim());
      }

      function updateUI() {
        var container = document.getElementById('__err');
        var countEl = document.getElementById('__err-count');
        var listEl = document.getElementById('__err-list');
        var blankOverlay = document.getElementById('__err-blank');
        
        if (errors.length === 0) {
          container.style.display = 'none';
          blankOverlay.classList.remove('show');
          return;
        }
        
        container.style.display = 'block';
        countEl.textContent = errors.length;
        
        // Show prominent overlay if widget is blank
        if (isWidgetBlank()) {
          blankOverlay.classList.add('show');
        }
        
        listEl.innerHTML = errors.map(function(e, i) {
          return '<div class="err-item">' +
            '<div class="err-msg">' + escapeHtml(e.message) + '</div>' +
            (e.stack ? '<div class="err-stack">' + escapeHtml(e.stack) + '</div>' : '') +
          '</div>';
        }).join('');
      }

      function escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }

      function sendToChat() {
        var summary = errors.map(function(e, i) {
          return (i + 1) + '. ' + e.message + (e.stack ? '\\n' + e.stack : '');
        }).join('\\n\\n');
        
        window.parent.postMessage({
          type: 'widget-error-to-chat',
          shapeId: getShapeId(),
          errorMessage: errors.length + ' error(s) in widget',
          errorStack: summary
        }, '*');
      }

      function clearErrors() {
        errors = [];
        updateUI();
        document.getElementById('__err-panel').classList.remove('open');
      }

      // Event listeners
      document.getElementById('__err-badge').onclick = function() {
        document.getElementById('__err-panel').classList.toggle('open');
      };
      document.getElementById('__err-close').onclick = function() {
        document.getElementById('__err-panel').classList.remove('open');
      };
      document.getElementById('__err-send').onclick = sendToChat;
      document.getElementById('__err-clear').onclick = clearErrors;
      document.getElementById('__err-blank-send').onclick = sendToChat;

      // Capture all errors
      window.onerror = function(msg, url, line, col, error) {
        addError(error || new Error(msg));
        // Re-check blank state after React finishes cleanup
        setTimeout(updateUI, 100);
      };
      window.onunhandledrejection = function(event) {
        addError(event.reason || new Error('Unhandled promise rejection'));
      };

      // React Error Boundary - adds error to list and renders nothing (lets blank overlay show)
      class WidgetErrorBoundary extends React.Component {
        constructor(props) {
          super(props);
          this.state = { hasError: false };
        }
        static getDerivedStateFromError(error) {
          return { hasError: true };
        }
        componentDidCatch(error, info) {
          addError(error);
          // Re-check blank state after this render
          setTimeout(updateUI, 0);
        }
        render() {
          if (this.state.hasError) {
            return null; // Render nothing - blank overlay will show
          }
          return this.props.children;
        }
      }

      // Mount
      var root = ReactDOM.createRoot(document.getElementById('react-root'));
      var mod = window.WidgetComponent;
      var Comp = mod && (mod.default || mod);
      if (typeof Comp === 'function') {
        root.render(React.createElement(WidgetErrorBoundary, null, React.createElement(Comp)));
      } else {
        console.error('WidgetComponent is not a React component:', Comp);
      }
    })();
  </script>
</body>
</html>`;
}

async function bundleOne(widgetDir) {
  const entryPath = path.join(widgetDir, 'template.jsx');
  if (!fs.existsSync(entryPath)) return false;

  const result = await esbuild.build({
    entryPoints: [entryPath],
    absWorkingDir: widgetDir,
    bundle: true,
    format: 'iife',
    target: 'es2018',
    platform: 'browser',
    write: false,
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    globalName: 'WidgetComponent',
    plugins: [shimPlugin()],
    banner: { js: buildBanner() }
  });

  const js = (result.outputFiles && result.outputFiles[0] && result.outputFiles[0].text) || '';
  const html = wrapInHtml(js);

  fs.writeFileSync(path.join(widgetDir, 'template.html'), html, 'utf8');
  return true;
}

async function main() {
  const cwd = process.cwd();
  const widgets = findWidgetDirs(cwd);
  log(`Bundling ${widgets.length} widget directories`);
  let ok = 0, skipped = 0;
  for (const w of widgets) {
    try {
      const r = await bundleOne(w);
      if (r) { ok++; log(`Bundled: ${path.relative(cwd, w)}`); }
      else { skipped++; }
    } catch (e) {
      warn(`Failed bundling ${w}: ${e.message}`);
      process.exitCode = 1; // signal error, but continue to report others
    }
  }
  log(`Done. Bundled=${ok} skipped=${skipped}`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
