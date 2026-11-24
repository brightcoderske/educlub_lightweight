(function(){var e=Object.create,t=Object.defineProperty,n=Object.getOwnPropertyDescriptor,r=Object.getOwnPropertyNames,i=Object.getPrototypeOf,a=Object.prototype.hasOwnProperty,o=(e,t)=>()=>(t||(e((t={exports:{}}).exports,t),e=null),t.exports),s=(e,i,o,s)=>{if(i&&typeof i==`object`||typeof i==`function`)for(var c=r(i),l=0,u=c.length,d;l<u;l++)d=c[l],!a.call(e,d)&&d!==o&&t(e,d,{get:(e=>i[e]).bind(null,d),enumerable:!(s=n(i,d))||s.enumerable});return e},c=(n,r,o)=>(o=n==null?{}:e(i(n)),s(r||!n||!n.__esModule||!a.call(n,`default`)?t(o,`default`,{value:n,enumerable:!0}):o,n)),l=o(((e,t)=>{t.exports={}})),u=Object.defineProperty,d=(e,t)=>u(e,`name`,{value:t,configurable:!0}),f=(e=>typeof require<`u`?require:typeof Proxy<`u`?new Proxy(e,{get:(e,t)=>(typeof require<`u`?require:e)[t]}):e)(function(e){if(typeof require<`u`)return require.apply(this,arguments);throw Error(`Dynamic require of "`+e+`" is not supported`)}),p=(()=>{for(var e=new Uint8Array(128),t=0;t<64;t++)e[t<26?t+65:t<52?t+71:t<62?t-4:t*4-205]=t;return t=>{for(var n=t.length,r=new Uint8Array((n-(t[n-1]==`=`)-(t[n-2]==`=`))*3/4|0),i=0,a=0;i<n;){var o=e[t.charCodeAt(i++)],s=e[t.charCodeAt(i++)],c=e[t.charCodeAt(i++)],l=e[t.charCodeAt(i++)];r[a++]=o<<2|s>>4,r[a++]=s<<4|c>>2,r[a++]=c<<6|l}return r}})();function m(e){return!isNaN(parseFloat(e))&&isFinite(e)}d(m,`_isNumber`);function h(e){return e.charAt(0).toUpperCase()+e.substring(1)}d(h,`_capitalize`);function g(e){return function(){return this[e]}}d(g,`_getter`);var _=[`isConstructor`,`isEval`,`isNative`,`isToplevel`],v=[`columnNumber`,`lineNumber`],y=[`fileName`,`functionName`,`source`],b=_.concat(v,y,[`args`],[`evalOrigin`]);function x(e){if(e)for(var t=0;t<b.length;t++)e[b[t]]!==void 0&&this[`set`+h(b[t])](e[b[t]])}for(d(x,`StackFrame`),x.prototype={getArgs:d(function(){return this.args},`getArgs`),setArgs:d(function(e){if(Object.prototype.toString.call(e)!==`[object Array]`)throw TypeError(`Args must be an Array`);this.args=e},`setArgs`),getEvalOrigin:d(function(){return this.evalOrigin},`getEvalOrigin`),setEvalOrigin:d(function(e){if(e instanceof x)this.evalOrigin=e;else if(e instanceof Object)this.evalOrigin=new x(e);else throw TypeError(`Eval Origin must be an Object or StackFrame`)},`setEvalOrigin`),toString:d(function(){var e=this.getFileName()||``,t=this.getLineNumber()||``,n=this.getColumnNumber()||``,r=this.getFunctionName()||``;return this.getIsEval()?e?`[eval] (`+e+`:`+t+`:`+n+`)`:`[eval]:`+t+`:`+n:r?r+` (`+e+`:`+t+`:`+n+`)`:e+`:`+t+`:`+n},`toString`)},x.fromString=d(function(e){var t=e.indexOf(`(`),n=e.lastIndexOf(`)`),r=e.substring(0,t),i=e.substring(t+1,n).split(`,`),a=e.substring(n+1);if(a.indexOf(`@`)===0)var o=/@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(a,``),s=o[1],c=o[2],l=o[3];return new x({functionName:r,args:i||void 0,fileName:s,lineNumber:c||void 0,columnNumber:l||void 0})},`StackFrame$$fromString`),S=0;S<_.length;S++)x.prototype[`get`+h(_[S])]=g(_[S]),x.prototype[`set`+h(_[S])]=function(e){return function(t){this[e]=!!t}}(_[S]);var S;for(C=0;C<v.length;C++)x.prototype[`get`+h(v[C])]=g(v[C]),x.prototype[`set`+h(v[C])]=function(e){return function(t){if(!m(t))throw TypeError(e+` must be a Number`);this[e]=Number(t)}}(v[C]);var C;for(w=0;w<y.length;w++)x.prototype[`get`+h(y[w])]=g(y[w]),x.prototype[`set`+h(y[w])]=function(e){return function(t){this[e]=String(t)}}(y[w]);var w,T=x;function ee(){var e=/^\s*at .*(\S+:\d+|\(native\))/m,t=/^(eval@)?(\[native code])?$/;return{parse:d(function(t){if(t.stack&&t.stack.match(e))return this.parseV8OrIE(t);if(t.stack)return this.parseFFOrSafari(t);throw Error(`Cannot parse given Error object`)},`ErrorStackParser$$parse`),extractLocation:d(function(e){if(e.indexOf(`:`)===-1)return[e];var t=/(.+?)(?::(\d+))?(?::(\d+))?$/.exec(e.replace(/[()]/g,``));return[t[1],t[2]||void 0,t[3]||void 0]},`ErrorStackParser$$extractLocation`),parseV8OrIE:d(function(t){return t.stack.split(`
`).filter(function(t){return!!t.match(e)},this).map(function(e){e.indexOf(`(eval `)>-1&&(e=e.replace(/eval code/g,`eval`).replace(/(\(eval at [^()]*)|(,.*$)/g,``));var t=e.replace(/^\s+/,``).replace(/\(eval code/g,`(`).replace(/^.*?\s+/,``),n=t.match(/ (\(.+\)$)/);t=n?t.replace(n[0],``):t;var r=this.extractLocation(n?n[1]:t);return new T({functionName:n&&t||void 0,fileName:[`eval`,`<anonymous>`].indexOf(r[0])>-1?void 0:r[0],lineNumber:r[1],columnNumber:r[2],source:e})},this)},`ErrorStackParser$$parseV8OrIE`),parseFFOrSafari:d(function(e){return e.stack.split(`
`).filter(function(e){return!e.match(t)},this).map(function(e){if(e.indexOf(` > eval`)>-1&&(e=e.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,`:$1`)),e.indexOf(`@`)===-1&&e.indexOf(`:`)===-1)return new T({functionName:e});var t=/((.*".+"[^@]*)?[^@]*)(?:@)/,n=e.match(t),r=n&&n[1]?n[1]:void 0,i=this.extractLocation(e.replace(t,``));return new T({functionName:r,fileName:i[0],lineNumber:i[1],columnNumber:i[2],source:e})},this)},`ErrorStackParser$$parseFFOrSafari`)}}d(ee,`ErrorStackParser`);var te=new ee;function ne(){return typeof API<`u`&&API!==globalThis.API?API.runtimeEnv:D({IN_BUN:typeof Bun<`u`,IN_DENO:typeof Deno<`u`,IN_NODE:typeof process==`object`&&typeof process.versions==`object`&&typeof process.versions.node==`string`&&!process.browser,IN_SAFARI:typeof navigator==`object`&&typeof navigator.userAgent==`string`&&navigator.userAgent.indexOf(`Chrome`)===-1&&navigator.userAgent.indexOf(`Safari`)>-1,IN_SHELL:typeof read==`function`&&typeof load==`function`,IN_WORKERD:typeof navigator==`object`&&navigator.userAgent?.includes(`Cloudflare-Workers`)})}d(ne,`getGlobalRuntimeEnv`);var E=ne();function D(e){let t=e.IN_NODE&&typeof module<`u`&&module.exports&&typeof f==`function`&&typeof __dirname==`string`,n=e.IN_NODE&&!t,r=!e.IN_NODE&&!e.IN_DENO&&!e.IN_BUN,i=r&&typeof window<`u`&&typeof window.document<`u`&&typeof document.createElement==`function`&&`sessionStorage`in window&&typeof globalThis.importScripts!=`function`,a=r&&typeof globalThis.WorkerGlobalScope<`u`&&typeof globalThis.self<`u`&&globalThis.self instanceof globalThis.WorkerGlobalScope;if(a&&re())throw Error(`Classic web workers are not supported`);let o={...e,IN_BROWSER:r,IN_BROWSER_MAIN_THREAD:i,IN_BROWSER_WEB_WORKER:a,IN_NODE_COMMONJS:t,IN_NODE_ESM:n};if(!(o.IN_BROWSER_MAIN_THREAD||o.IN_BROWSER_WEB_WORKER||o.IN_NODE||o.IN_SHELL||o.IN_WORKERD))throw Error(`Cannot determine runtime environment: ${JSON.stringify(o)}`);return o}d(D,`calculateDerivedFlags`);function re(){try{return globalThis.importScripts(`data:text/javascript,`),!0}catch{return!1}}d(re,`isClassicWorker`);var ie,O,ae,k;async function A(){if(!E.IN_NODE||(ie=(await Promise.resolve().then(()=>c(l(),1))).default,ae=await Promise.resolve().then(()=>c(l(),1)),k=await Promise.resolve().then(()=>c(l(),1)),(await Promise.resolve().then(()=>c(l(),1))).default,O=await Promise.resolve().then(()=>c(l(),1)),j=O.sep,typeof f<`u`))return;let e={fs:ae,crypto:await Promise.resolve().then(()=>c(l(),1)),ws:await Promise.resolve().then(()=>c(l(),1)),child_process:await Promise.resolve().then(()=>c(l(),1))};globalThis.require=function(t){return e[t]}}d(A,`initNodeModules`);function oe(e,t){return O.resolve(t||`.`,e)}d(oe,`node_resolvePath`);function se(e,t){return t===void 0&&(t=location),new URL(e,t).toString()}d(se,`browser_resolvePath`);var ce=E.IN_NODE?oe:E.IN_SHELL?d(e=>e,`resolvePath`):se,j;E.IN_NODE||(j=`/`);function M(e,t){return e.startsWith(`file://`)&&(e=e.slice(7)),e.includes(`://`)?{response:fetch(e)}:{binary:k.readFile(e).then(e=>new Uint8Array(e.buffer,e.byteOffset,e.byteLength))}}d(M,`node_getBinaryResponse`);function N(e,t){if(e.startsWith(`file://`)&&(e=e.slice(7)),e.includes(`://`))throw Error(`Shell cannot fetch urls`);return{binary:Promise.resolve(new Uint8Array(readbuffer(e)))}}d(N,`shell_getBinaryResponse`);function P(e,t){let n=new URL(e,location);return{response:fetch(n,t?{integrity:t}:{})}}d(P,`browser_getBinaryResponse`);var F=E.IN_NODE?M:E.IN_SHELL?N:P;async function I(e,t){let{response:n,binary:r}=F(e,t);if(r)return r;let i=await n;if(!i.ok)throw Error(`Failed to load '${e}': request failed.`);return new Uint8Array(await i.arrayBuffer())}d(I,`loadBinaryFile`);var le=E.IN_NODE?L:d(async e=>await import(e),`loadScript`);async function L(e){return e.startsWith(`file://`)&&(e=e.slice(7)),e.includes(`://`)?await import(e):await import(ie.pathToFileURL(e).href)}d(L,`nodeLoadScript`);async function R(e){if(E.IN_NODE){await A();let t=await k.readFile(e,{encoding:`utf8`});return JSON.parse(t)}if(E.IN_SHELL){let t=read(e);return JSON.parse(t)}return await(await fetch(e)).json()}d(R,`loadLockFile`);async function z(){if(E.IN_NODE_COMMONJS)return __dirname;let e;try{throw Error()}catch(t){e=t}let t=te.parse(e)[0].fileName;if(E.IN_NODE&&!t.startsWith(`file://`)&&(t=`file://${t}`),E.IN_NODE_ESM){let e=await Promise.resolve().then(()=>c(l(),1));return(await Promise.resolve().then(()=>c(l(),1))).fileURLToPath(e.dirname(t))}let n=t.lastIndexOf(j);if(n===-1)throw Error(`Could not extract indexURL path from pyodide module location. Please pass the indexURL explicitly to loadPyodide.`);return t.slice(0,n)}d(z,`calculateDirname`);function B(e){return e.substring(0,e.lastIndexOf(`/`)+1)||globalThis.location?.toString()||`.`}d(B,`calculateInstallBaseUrl`);function V(e){let t=e.FS,n=e.FS.filesystems.MEMFS,r=e.PATH,i={DIR_MODE:16895,FILE_MODE:33279,mount:d(function(e){if(!e.opts.fileSystemHandle)throw Error(`opts.fileSystemHandle is required`);return n.mount.apply(null,arguments)},`mount`),syncfs:d(async(e,t,n)=>{try{let r=i.getLocalSet(e),a=await i.getRemoteSet(e),o=t?a:r,s=t?r:a;await i.reconcile(e,o,s),n(null)}catch(e){n(e)}},`syncfs`),getLocalSet:d(e=>{let n=Object.create(null);function i(e){return e!==`.`&&e!==`..`}d(i,`isRealDir`);function a(e){return t=>r.join2(e,t)}d(a,`toAbsolute`);let o=t.readdir(e.mountpoint).filter(i).map(a(e.mountpoint));for(;o.length;){let e=o.pop(),r=t.stat(e);t.isDir(r.mode)&&o.push.apply(o,t.readdir(e).filter(i).map(a(e))),n[e]={timestamp:r.mtime,mode:r.mode}}return{type:`local`,entries:n}},`getLocalSet`),getRemoteSet:d(async e=>{let t=Object.create(null),n=await ue(e.opts.fileSystemHandle);for(let[a,o]of n)a!==`.`&&(t[r.join2(e.mountpoint,a)]={timestamp:o.kind===`file`?new Date((await o.getFile()).lastModified):new Date,mode:o.kind===`file`?i.FILE_MODE:i.DIR_MODE});return{type:`remote`,entries:t,handles:n}},`getRemoteSet`),loadLocalEntry:d(e=>{let r=t.lookupPath(e,{}).node,i=t.stat(e);if(t.isDir(i.mode))return{timestamp:i.mtime,mode:i.mode};if(t.isFile(i.mode))return r.contents=n.getFileDataAsTypedArray(r),{timestamp:i.mtime,mode:i.mode,contents:r.contents};throw Error(`node type not supported`)},`loadLocalEntry`),storeLocalEntry:d((e,n)=>{if(t.isDir(n.mode))t.mkdirTree(e,n.mode);else if(t.isFile(n.mode))t.writeFile(e,n.contents,{canOwn:!0});else throw Error(`node type not supported`);t.chmod(e,n.mode),t.utime(e,n.timestamp,n.timestamp)},`storeLocalEntry`),removeLocalEntry:d(e=>{var n=t.stat(e);t.isDir(n.mode)?t.rmdir(e):t.isFile(n.mode)&&t.unlink(e)},`removeLocalEntry`),loadRemoteEntry:d(async e=>{if(e.kind===`file`){let t=await e.getFile();return{contents:new Uint8Array(await t.arrayBuffer()),mode:i.FILE_MODE,timestamp:new Date(t.lastModified)}}if(e.kind===`directory`)return{mode:i.DIR_MODE,timestamp:new Date};throw Error(`unknown kind: `+e.kind)},`loadRemoteEntry`),storeRemoteEntry:d(async(e,n,i)=>{let a=e.get(r.dirname(n)),o=t.isFile(i.mode)?await a.getFileHandle(r.basename(n),{create:!0}):await a.getDirectoryHandle(r.basename(n),{create:!0});if(o.kind===`file`){let e=await o.createWritable();await e.write(i.contents),await e.close()}e.set(n,o)},`storeRemoteEntry`),removeRemoteEntry:d(async(e,t)=>{await e.get(r.dirname(t)).removeEntry(r.basename(t)),e.delete(t)},`removeRemoteEntry`),reconcile:d(async(e,n,a)=>{let o=0,s=[];Object.keys(n.entries).forEach(function(e){let r=n.entries[e],i=a.entries[e];(!i||t.isFile(r.mode)&&r.timestamp.getTime()>i.timestamp.getTime())&&(s.push(e),o++)}),s.sort();let c=[];if(Object.keys(a.entries).forEach(function(e){n.entries[e]||(c.push(e),o++)}),c.sort().reverse(),!o)return;let l=n.type===`remote`?n.handles:a.handles;for(let t of s){let n=r.normalize(t.replace(e.mountpoint,`/`)).substring(1);if(a.type===`local`){let e=l.get(n),r=await i.loadRemoteEntry(e);i.storeLocalEntry(t,r)}else{let e=i.loadLocalEntry(t);await i.storeRemoteEntry(l,n,e)}}for(let t of c)if(a.type===`local`)i.removeLocalEntry(t);else{let n=r.normalize(t.replace(e.mountpoint,`/`)).substring(1);await i.removeRemoteEntry(l,n)}},`reconcile`)};e.FS.filesystems.NATIVEFS_ASYNC=i}d(V,`initializeNativeFS`);var ue=d(async e=>{let t=[];async function n(e){for await(let r of e.values())t.push(r),r.kind===`directory`&&await n(r)}d(n,`collect`),await n(e);let r=new Map;r.set(`.`,e);for(let n of t){let t=(await e.resolve(n)).join(`/`);r.set(t,n)}return r},`getFsHandles`),de=p(`AGFzbQEAAAABDANfAGAAAW9gAW8BfwMDAgECBygCE0pzdl9HZXRFcnJvcl9pbXBvcnQAAA5Kc3ZFcnJvcl9DaGVjawABChMCBwD7AQD7GwsJACAA+xr7FAAL`),fe=async function(){if(!(globalThis.navigator&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform===`MacIntel`&&typeof navigator.maxTouchPoints<`u`&&navigator.maxTouchPoints>1)))try{let e=await WebAssembly.compile(de);return await WebAssembly.instantiate(e)}catch(e){if(e instanceof WebAssembly.CompileError)return;throw e}}();async function H(){let e=await fe;if(e)return e.exports;let t=Symbol(`error marker`);return{Jsv_GetError_import:d(()=>t,`Jsv_GetError_import`),JsvError_Check:d(e=>e===t,`JsvError_Check`)}}d(H,`getJsvErrorImport`);function U(e){let t={config:e,runtimeEnv:E},n={noImageDecoding:!0,noAudioDecoding:!0,noWasmDecoding:!1,preRun:ge(e),print:e.stdout,printErr:e.stderr,onExit(e){n.exitCode=e},thisProgram:e._sysExecutable,arguments:e.args,API:t,locateFile:d(t=>e.indexURL+t,`locateFile`),instantiateWasm:_e(e.indexURL)};return n}d(U,`createSettings`);function W(e){return function(t){try{t.FS.mkdirTree(e)}catch(t){console.error(`Error occurred while making a home directory '${e}':`),console.error(t),console.error(`Using '/' for a home directory instead`),e=`/`}t.FS.chdir(e)}}d(W,`createHomeDirectory`);function G(e){return function(t){Object.assign(t.ENV,e)}}d(G,`setEnvironment`);function pe(e){return e?[async t=>{t.addRunDependency(`fsInitHook`);try{await e(t.FS,{sitePackages:t.API.sitePackages})}finally{t.removeRunDependency(`fsInitHook`)}}]:[]}d(pe,`callFsInitHook`);function me(e){let t=e.HEAPU32[e._Py_Version>>>2];return[t>>>24&255,t>>>16&255,t>>>8&255]}d(me,`computeVersionTuple`);function he(e){let t=I(e);return async e=>{e.API.pyVersionTuple=me(e);let[n,r]=e.API.pyVersionTuple;e.FS.mkdirTree(`/lib`),e.API.sitePackages=`/lib/python${n}.${r}/site-packages`,e.FS.mkdirTree(e.API.sitePackages),e.FS.mkdirTree(`/lib/python${n}.${r}/lib-dynload`),e.addRunDependency(`install-stdlib`);try{let i=await t;e.FS.writeFile(`/lib/python${n}${r}.zip`,i)}catch(e){console.error(`Error occurred while installing the standard library:`),console.error(e)}finally{e.removeRunDependency(`install-stdlib`)}}}d(he,`installStdlib`);function ge(e){let t;return t=e.stdLibURL==null?e.indexURL+`python_stdlib.zip`:e.stdLibURL,[he(t),W(e.env.HOME),G(e.env),V,...pe(e.fsInit)]}d(ge,`getFileSystemInitializationFuncs`);function _e(e){if(typeof WasmOffsetConverter<`u`)return;let{binary:t,response:n}=F(e+`pyodide.asm.wasm`),r=H();return function(e,i){return async function(){let{Jsv_GetError_import:a,JsvError_Check:o}=await r;e.env.Jsv_GetError_import=a,e.env.JsvError_Check=o;try{let r;r=n?await WebAssembly.instantiateStreaming(n,e):await WebAssembly.instantiate(await t,e);let{instance:a,module:o}=r;i(a,o)}catch(e){console.warn(`wasm instantiation failed!`),console.warn(e)}}(),{}}}d(_e,`getInstantiateWasmFunc`);var ve=`314.0.6`;function K(e){return e===void 0||e.endsWith(`/`)?e:e+`/`}d(K,`withTrailingSlash`);var ye=ve;async function be(e={}){if(await A(),e.lockFileContents&&e.lockFileURL)throw Error(`Can't pass both lockFileContents and lockFileURL`);let t=e.indexURL||await z();if(t=K(ce(t)),e.packageBaseUrl=K(e.packageBaseUrl),e.cdnUrl=K(e.packageBaseUrl??`https://cdn.jsdelivr.net/pyodide/v314.0.6/full/`),!e.lockFileContents){let n=e.lockFileURL??t+`pyodide-lock.json`;e.lockFileContents=R(n),e.packageBaseUrl??=B(n)}e.indexURL=t,e.packageCacheDir&&=K(ce(e.packageCacheDir));let n={jsglobals:globalThis,stdin:globalThis.prompt?()=>globalThis.prompt():void 0,args:[],env:{},packages:[],packageCacheDir:e.packageBaseUrl,enableRunUntilComplete:!0,checkAPIVersion:!0,BUILD_ID:`6f88bdfdf0581f0eab1d84a508b31ab96e83201d2b7fdd1dc653a3079c23a0f5`},r=Object.assign(n,e);return r.env.HOME??=`/home/pyodide`,r.env.PYTHONINSPECT??=`1`,r}d(be,`initializeConfiguration`);function xe(e){let t=U(e),n=t.API;return n.lockFilePromise=Promise.resolve(e.lockFileContents),t}d(xe,`createEmscriptenSettings`);async function Se(e){return e.createPyodideModule?e.createPyodideModule:(await le(`${e.indexURL}pyodide.asm.mjs`)).default}d(Se,`loadWasmScript`);async function Ce(e,t){if(!e._loadSnapshot)return;let n=await e._loadSnapshot,r=ArrayBuffer.isView(n)?n:new Uint8Array(n);return t.noInitialRun=!0,t.INITIAL_MEMORY=r.length,r}d(Ce,`prepareSnapshot`);async function we(e,t){let n=await e(t);if(t.exitCode!==void 0)throw new n.ExitStatus(t.exitCode);return n}d(we,`instantiatePyodideModule`);function Te(e,t){let n=e.API;if(t.pyproxyToStringRepr&&n.setPyProxyToStringMethod(!0),t.convertNullToNone&&n.setCompatNullToNone(!0),t.toJsLiteralMap&&n.setCompatToJsLiteralMap(!0),n.version!==`314.0.6`&&t.checkAPIVersion)throw Error(`Pyodide version does not match: '${ye}' <==> '${n.version}'. If you updated the Pyodide version, make sure you also updated the 'indexURL' parameter passed to loadPyodide.`);e.locateFile=e=>{throw e.endsWith(`.so`)?Error(`Failed to find dynamic library "${e}"`):Error(`Unexpected call to locateFile("${e}")`)}}d(Te,`configureAPI`);function Ee(e,t,n){let r=e.API,i;return t&&(i=r.restoreSnapshot(t)),r.finalizeBootstrap(i,n._snapshotDeserializer)}d(Ee,`bootstrapPyodide`);async function De(e,t){let n=e._api;return n.sys.path.insert(0,``),n._pyodide.set_excepthook(),await n.packageIndexReady,n.initializeStreams(t.stdin,t.stdout,t.stderr),e}d(De,`finalizeSetup`);async function Oe(e={}){let t=await be(e),n=xe(t),r=await Se(t),i=await Ce(t,n),a=await we(r,n);return Te(a,t),await De(Ee(a,i,t),t)}d(Oe,`loadPyodide`);function ke(e){if(!e||typeof e!=`object`||Array.isArray(e))return[];let t=[];for(let[n,r]of Object.entries(e)){if(t.length>=50)break;let e=String(n).slice(0,60);!e||typeof r==`object`&&r||t.push([e,String(r??``).slice(0,2e3)])}return t}function Ae(e){return e==null||typeof e==`object`?``:String(e).slice(0,60)}function je(e=[]){let t=Array.isArray(e)?e.map(e=>String(e)):[],n=``,r=!1;return{write(e){r||(n=J(n+e))},readLine(){if(r)return null;if(!t.length)return r=!0,null;let e=t.shift();return n=J(`${n}${e}\n`),e},get awaitingInput(){return r},get text(){return n}}}function Me(e){return Number.isSafeInteger(e)&&e>=0?e:null}function q(e,t={}){return{...t,channel:`educlub-python-runner/v1`,type:e}}function Ne(e){return!!(e&&e.channel===`educlub-python-runner/v1`&&typeof e.type==`string`)}function Pe(e){let t=String(e??``),n=t.split(`
`),r=n.findIndex(e=>e.includes(`File "learner.py"`));if(r<=0)return t;let i=[.../^Traceback \(most recent call last\):\s*$/.test(n[0])?[n[0]]:[],...n.slice(r)].join(`
`);return i.trim()?i:t}function J(e,t=2e4){let n=String(e??``);return n.length<=t?n:`${n.slice(0,t)}\n\n[Output stopped after ${t.toLocaleString()} characters.]`}let Fe=/^\s*[!%]?\s*(?:(?:python3?|py)\s+-m\s+)?(?:pip3?|conda|mamba)\s+install\b(.*)$/i,Ie=/^\s*%(?:matplotlib|config|load_ext|time|timeit)\b.*$/;function Le(e){let t=[],n=String(e??``).split(`
`).map((e,n)=>{let r=Fe.exec(e);if(r){let i=r[1].split(/\s+/).filter(e=>e&&!e.startsWith(`-`)).map(e=>e.replace(/[<>=!~].*$/,``)).filter(Boolean).slice(0,5),a=i.length===1?`${i[0]} loads by itself when you import it.`:`${i.length?i.join(`, `):`Libraries`} load by themselves when you import them.`;return t.push(`Line ${n+1}: nothing needs installing here, so "${e.trim().slice(0,80)}" was skipped. ${a}`),``}return Ie.test(e)?(t.push(`Line ${n+1}: "${e.trim().slice(0,80)}" is a notebook command, so it was skipped. Charts show below your output by themselves.`),``):e});return{code:t.length?n.join(`
`):String(e??``),notices:t}}function Re(e){let t=String(e??``),n=t.trimEnd().split(`
`),r=n.filter(e=>/^\s*File "/.test(e)&&!e.includes(`File "<exec>"`)),i=r[r.length-1]||``,a=/File "learner\.py", line (\d+)/.exec(i),o=a?`Line ${a[1]}: `:``,s=e=>n.map(t=>e.exec(t)).find(Boolean),c=s(/^(?:ModuleNotFoundError|ImportError): \[educlub\] (.+)$/);if(c)return`${o}${c[1]}`;let l=s(/^ModuleNotFoundError: No module named '([\w.]+)'$/);return l&&a?`${o}there is no library called "${l[1]}" here. Check the spelling. Libraries built for the browser, such as numpy, pandas, matplotlib, scipy, scikit-learn and sympy, load by themselves when you import them; other libraries cannot be added.`:Pe(t)}let ze=[`js`,`pyodide_js`,`micropip`,`pyodide.http`],Y=`{name} opens a desktop window, and Python here runs inside a web page, which cannot open windows. Use print() and input() to talk to the user, or matplotlib to draw a picture (plt.show() puts it under your output).`,X=`{name} connects to the internet, and Python here is kept offline to keep everyone safe. Put the data your program needs straight into the code, for example as a list or a dictionary.`,Z={tkinter:Y,_tkinter:Y,turtle:`turtle draws in a desktop window, and Python here runs inside a web page, which cannot open windows. Try matplotlib instead: draw with plt.plot(...) and plt.show() puts the picture under your output.`,pygame:`pygame opens a game window, and Python here runs inside a web page, which cannot open windows. Games in this course use print() and input(), or matplotlib for pictures and animations.`,easygui:Y,PySimpleGUI:Y,pyautogui:`{name} controls the mouse and keyboard of a desktop computer, which Python inside a web page cannot do.`,pynput:`{name} reads the keyboard and mouse of a desktop computer, which Python inside a web page cannot do. Use input() to ask the user instead.`,keyboard:`{name} reads the keyboard of a desktop computer, which Python inside a web page cannot do. Use input() to ask the user instead.`,wx:Y,PyQt5:Y,PyQt6:Y,PySide6:Y,kivy:Y,requests:X,urllib3:X,httpx:X,aiohttp:X,socket:X,websockets:X,ftplib:X,smtplib:X,"urllib.request":X,"http.client":X,webbrowser:`webbrowser opens other web pages, which Python here is not allowed to do.`,pip:`Nothing needs installing here: libraries load by themselves when you import them (for example import numpy).`,micropip:`Nothing needs installing here: libraries load by themselves when you import them (for example import numpy).`};function Be(){return`
import builtins

def _educlub_make_import_guard(original_import, blocked, explained):
    def explain(name, root):
        if name in explained:
            return explained[name].replace("{name}", name)
        if root in explained:
            return explained[root].replace("{name}", root)
        return None

    def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
        if level == 0:
            root = name.split(".", 1)[0]
            if root in blocked or name in blocked or any(name.startswith(b + ".") for b in blocked):
                message = explain(name, root) or f"{name} is unavailable in the safe eduClub runner"
                raise ModuleNotFoundError("[educlub] " + message, name=name)
            if globals is not None and globals.get("__name__") == "__main__":
                message = explain(name, root)
                if message is None:
                    for item in fromlist or ():
                        message = explained.get(f"{name}.{item}")
                        if message:
                            message = message.replace("{name}", f"{name}.{item}")
                            break
                if message is not None:
                    raise ModuleNotFoundError("[educlub] " + message, name=name)
        return original_import(name, globals, locals, fromlist, level)
    return guarded_import

builtins.__import__ = _educlub_make_import_guard(
    builtins.__import__,
    frozenset(${JSON.stringify(ze)}),
    ${JSON.stringify(Z)},
)
del _educlub_make_import_guard
`}let Ve=new Set([...ze.map(e=>e.split(`.`)[0]),...Object.keys(Z).map(e=>e.split(`.`)[0])]),He=Object.freeze({maxImages:8,maxStaticPixels:16e5,maxImageLength:25e5,maxAnimations:2,maxGifFrames:48,maxFrameUpdates:720,maxAnimationSide:360,maxGifLength:59e5,animationSeconds:8});function Ue(){return`
import sys, types

_source = r'''
import base64, io, itertools, json, math, sys, time

LIMITS = ${JSON.stringify(He)}

_images = []
_notes = []
_animations = []
_pending = []
_installed = False
_warmed = False


def preimport(names):
    """Import libraries before the learner's program starts its 3-second clock."""
    import importlib
    for name in names:
        try:
            importlib.import_module(name)
        except Exception:
            pass  # the learner's own run reports any real problem
    if "matplotlib" in sys.modules:
        _install()


def _note(text):
    if text not in _notes:
        _notes.append(text)


def _install():
    global _installed, _warmed
    if _installed:
        return
    import matplotlib
    matplotlib.use("Agg", force=True)
    import matplotlib.pyplot as plt
    import matplotlib.animation as animation

    plt.show = show
    original_init = animation.Animation.__init__

    def init(self, fig, *args, **kwargs):
        original_init(self, fig, *args, **kwargs)
        _animations.append(self)

    animation.Animation.__init__ = init

    def save(self, filename=None, *args, **kwargs):
        # A browser cannot keep the file, so the animation is shown instead.
        _note("Animations are shown below your output instead of being saved as a file.")
        _queue_animation(self._fig, self)

    animation.Animation.save = save
    _installed = True
    if not _warmed:
        # The first drawing loads fonts; do it now, not on the learner's clock.
        fig = plt.figure(figsize=(1, 1))
        fig.text(0.5, 0.5, "0")
        fig.canvas.draw()
        plt.close(fig)
        _warmed = True


def begin():
    """A fresh start for each run: no figures left over from the last one."""
    _images.clear()
    _notes.clear()
    _animations.clear()
    _pending.clear()
    if _installed:
        import matplotlib.pyplot as plt
        plt.close("all")


def _data_url(raw, mime):
    return f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")


def _add(item, limit):
    if len(_images) >= LIMITS["maxImages"]:
        _note(f"Only the first {LIMITS['maxImages']} charts are shown.")
        return
    if len(item["src"]) > limit:
        _note("A chart was too big to show. Try a smaller figure size.")
        return
    _images.append(item)


def _png(fig):
    width, height = fig.get_size_inches()
    dpi = fig.dpi
    area = max(width * height, 0.01)
    if area * dpi * dpi > LIMITS["maxStaticPixels"]:
        dpi = math.sqrt(LIMITS["maxStaticPixels"] / area)
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=dpi)
    return buffer.getvalue()


def _animation_for(fig):
    for anim in _animations:
        if getattr(anim, "_fig", None) is fig:
            return anim
    return None


def _queue_animation(fig, anim):
    if any(queued is anim for _, queued in _pending):
        return
    if len(_pending) >= LIMITS["maxAnimations"]:
        _note(f"Only the first {LIMITS['maxAnimations']} animations are shown.")
        return
    _pending.append((fig, anim))


def show(*args, **kwargs):
    """plt.show(): every open figure becomes a picture under the output."""
    import matplotlib.pyplot as plt
    from matplotlib._pylab_helpers import Gcf
    for manager in list(Gcf.get_all_fig_managers()):
        fig = manager.canvas.figure
        anim = _animation_for(fig)
        if anim is not None:
            _queue_animation(fig, anim)
        else:
            try:
                _add({"kind": "image", "src": _data_url(_png(fig), "image/png")}, LIMITS["maxImageLength"])
            except Exception as error:
                _note(f"A chart could not be drawn: {error}")
        plt.close(fig)


def needs_drawing():
    if not _installed:
        return False
    from matplotlib._pylab_helpers import Gcf
    return bool(_pending) or bool(Gcf.get_all_fig_managers())


def _render_animation(fig, anim):
    import numpy as np
    from PIL import Image
    from matplotlib import cbook

    try:
        fig.canvas.mpl_disconnect(anim._first_draw_id)
    except Exception:
        pass
    anim._draw_was_started = True  # no "deleted without rendering" warning

    frames_data = list(itertools.islice(anim.new_saved_frame_seq(), LIMITS["maxFrameUpdates"] + 1))
    too_many = len(frames_data) > LIMITS["maxFrameUpdates"]
    frames_data = frames_data[: LIMITS["maxFrameUpdates"]]
    total = len(frames_data)
    if not total:
        return
    # Every frame is computed (so animations that build on the last frame stay
    # right), but only every step-th one becomes a picture.
    step = max(1, math.ceil(total / LIMITS["maxGifFrames"]))
    width, height = fig.get_size_inches()
    fig.set_dpi(min(fig.dpi, LIMITS["maxAnimationSide"] / max(width, height, 0.01)))

    pictures = []
    computed = 0
    deadline = time.monotonic() + LIMITS["animationSeconds"]
    with cbook._setattr_cm(fig.canvas, _is_saving=True, manager=None):
        anim._init_draw()
        for index, data in enumerate(frames_data):
            if time.monotonic() > deadline:
                break
            anim._draw_frame(data)
            computed = index + 1
            if index % step:
                continue
            fig.canvas.draw()
            rgba = np.asarray(fig.canvas.buffer_rgba())
            pictures.append(Image.fromarray(rgba[:, :, :3].copy()))
    if not pictures:
        return
    interval = getattr(anim, "_interval", 100) or 100
    buffer = io.BytesIO()
    pictures[0].save(
        buffer,
        format="GIF",
        save_all=True,
        append_images=pictures[1:],
        duration=max(20, int(interval * step)),
        loop=0,
    )
    note = ""
    if computed < total:
        note = f"This animation was cut short: drawing it took too long, so {computed} of {total} frames are shown."
    elif too_many:
        note = f"This animation was cut short: only the first {total} frames are shown."
    _add({"kind": "animation", "src": _data_url(buffer.getvalue(), "image/gif"), "note": note}, LIMITS["maxGifLength"])


def finish():
    """Figures still open become pictures; queued animations are drawn."""
    if _installed:
        show()
        for fig, anim in list(_pending):
            try:
                _render_animation(fig, anim)
            except Exception as error:
                _note(f"The animation stopped while drawing a frame: {type(error).__name__}: {error}")
        _pending.clear()
        _animations.clear()
    result = json.dumps({"images": _images, "notes": _notes})
    _images.clear()
    _notes.clear()
    return result
'''

_module = types.ModuleType("_educlub_runtime")
exec(compile(_source, "_educlub_runtime.py", "exec"), _module.__dict__)
sys.modules["_educlub_runtime"] = _module
del _module, _source
`}let We=Object.freeze(Object.create(null)),Ge,Q;function Ke(e,t){return J(e?`${e}\n${t}`:t)}async function qe(){return Ge||=Oe({indexURL:`https://cdn.jsdelivr.net/pyodide/v314.0.6/full/`,jsglobals:We,env:{HOME:`/home/pyodide`,MPLBACKEND:`Agg`}}).then(async e=>(await e.runPythonAsync(Be()),await e.runPythonAsync(Ue()),e)),Ge}function $(e,t){if(!Q){Q=new Map;for(let[t,n]of Object.entries(e.lockfile?.packages||{}))for(let e of n.imports||[])Q.set(e,t)}return Q.get(t)}let Je=e=>String(e).toLowerCase().replace(/[-_.]+/g,`-`);function Ye(e,t){let n=Je(t);return Object.keys(e.loadedPackages).some(e=>Je(e)===n)}function Xe(e,t){let n;try{n=e.pyimport(`pyodide.code`).find_imports(t);let r=n.toJs();return[...new Set(r.map(e=>String(e).split(`.`)[0]))]}catch{return[]}finally{n?.destroy?.()}}async function Ze(e,t,n){let r=Xe(e,t).filter(e=>!Ve.has(e));r.includes(`pandas`)&&/\.(?:plot|hist|boxplot)\b/.test(t)&&r.push(`matplotlib`);let i=r.filter(t=>$(e,t)),a=[...new Set(i.map(t=>$(e,t)))].filter(t=>!Ye(e,t));if(a.length){let t=i.filter(t=>a.includes($(e,t)));n(`loading`,`Loading ${t.join(`, `)}… (first time only)`);try{await e.loadPackage(a,{messageCallback:()=>{},errorCallback:e=>console.warn(e)})}catch(e){throw console.warn(e),Error(`${t.join(`, `)} could not be downloaded. Check your internet connection and select Run Python again.`)}for(let n of a)if(!Ye(e,n))throw Error(`${t.join(`, `)} could not be downloaded. Check your internet connection and select Run Python again.`)}if(i.length){let t=[...i];t.includes(`matplotlib`)&&t.push(`matplotlib.pyplot`,`matplotlib.animation`);let n=e.pyimport(`_educlub_runtime`),r=e.toPy(t);try{n.preimport(r)}finally{r.destroy(),n.destroy()}}}function Qe(e,t){let n=e.pyimport(`_educlub_runtime`);try{return n.needs_drawing()&&t(`drawing`),JSON.parse(n.finish())}catch{return{images:[],notes:[`Your charts could not be drawn.`]}}finally{n.destroy()}}async function $e({code:e,inputs:t=[],seed:n,page:r,clicked:i},a){let o=String(e||``);if(!o.trim())throw Error(`Add some Python code before selecting Run Python.`);if(o.length>2e4)throw Error(`Python code is limited to ${2e4.toLocaleString()} characters.`);let{code:s,notices:c}=Le(o);if(!s.trim())return a(`running`),{stdout:``,stderr:``,result:``,notices:c,images:[]};let l=await qe();await Ze(l,s,a);let u=l.pyimport(`_educlub_runtime`);u.begin(),u.destroy(),a(`running`);let d=``,f=``,p=r===void 0?je(t):null;if(p){let e=new TextDecoder;l.setStdout({write:t=>(p.write(e.decode(t,{stream:!0})),t.length)})}else l.setStdout({batched:e=>d=Ke(d,e)});l.setStderr({batched:e=>f=Ke(f,e)}),l.setStdin({stdin:()=>p?p.readLine():null,autoEOF:!0});let m=Me(n);m!==null&&l.runPython(`import random\nrandom.seed(${m})`);let h=l.globals.get(`dict`)();h.set(`__name__`,`__main__`);let g;r!==void 0&&(g=l.toPy(new Map(ke(r))),h.set(`page`,g),h.set(`clicked`,Ae(i)));let _,v;try{_=await l.runPythonAsync(s,{globals:h,locals:h,filename:`learner.py`})}catch(e){v=e}finally{l.runPython(`import sys
sys.stdout.flush()
sys.stderr.flush()`),g?.destroy(),h.destroy()}let y=``;_!=null&&(y=J(String(_))),_&&typeof _.destroy==`function`&&_.destroy();let b=Qe(l,a),x={notices:[...c,...b.notes],images:b.images};if(p?.awaitingInput)return{stdout:p.text,stderr:f,result:``,awaitingInput:!0,...x};if(v)throw v.stdout=p?p.text:d,v.extras=x,v;return{stdout:p?p.text:d,stderr:f,result:y,...x}}self.addEventListener(`message`,async e=>{let t=e.data;if(!Ne(t)||t.type!==`run`)return;let n=performance.now(),r=(e,n=``)=>self.postMessage(q(`phase`,{id:t.id,phase:e,text:n}));try{let e=await $e(t,r);self.postMessage(q(`result`,{id:t.id,ok:!0,...e,durationMs:Math.round(performance.now()-n)}))}catch(e){self.postMessage(q(`result`,{id:t.id,ok:!1,stdout:typeof e?.stdout==`string`?e.stdout:``,...e?.extras||{},error:J(Re(e?.message)||`Python could not run this program.`),durationMs:Math.round(performance.now()-n)}))}}),qe().then(()=>self.postMessage(q(`ready`))).catch(e=>self.postMessage(q(`startup_error`,{error:J(e?.message||`The Python runtime could not start.`)})))})();