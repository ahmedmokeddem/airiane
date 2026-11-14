// Explicit LOCAL unsigned artifact preparation; never reads a production keystore.
import fs from 'node:fs';
if(process.env.EXPO_PUBLIC_APP_ENV!=='production')throw new Error('Set the reviewed production mobile environment first.');
const file=new URL('../android/app/build.gradle',import.meta.url);
const source=fs.readFileSync(file,'utf8');
const pattern=/(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
if(!pattern.test(source))throw new Error('Unexpected release signing configuration; inspect Gradle instead of changing it automatically.');
fs.writeFileSync(file,source.replace(pattern,'$1// AIriane: unsigned release. Production signing requires separate operator approval.'));
console.log('Removed debug signing from release only. The debug variant and native dependencies are unchanged.');
