// Rasterize decorative lighting once; the approved logo is never touched.
// Requires playwright-cli/Chromium on the asset-authoring workstation, not in the app.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const svg = readFileSync(new URL('../assets/opening/illumination.svg',import.meta.url),'utf8');
const output = fileURLToPath(new URL('../assets/opening/illumination.png',import.meta.url));
const temp = mkdtempSync(join(tmpdir(),'airiane-light-'));
const session = '-s=airiane-light-export';
try {
 const script=join(temp,'render.js');
 writeFileSync(script,`async page => { await page.setViewportSize({width:560,height:400}); await page.setContent(${JSON.stringify('<style>html,body{margin:0;background:transparent}</style>'+svg)}); await page.screenshot({path:${JSON.stringify(output)},omitBackground:true}); return {width:560,height:400}; }`);
 execFileSync('playwright-cli',[session,'open','about:blank'],{stdio:'pipe'});
 execFileSync('playwright-cli',[session,'run-code','--filename='+script],{stdio:'pipe'});
 console.log('Exported decorative illumination, 560x400 RGBA. Approved logos unchanged.');
} finally {
 try {execFileSync('playwright-cli',[session,'close'],{stdio:'pipe'});} catch {}
 rmSync(temp,{recursive:true,force:true});
}
