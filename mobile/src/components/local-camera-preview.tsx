import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { AppState, View, Text } from 'react-native';
import { Action } from './ui';
export function LocalCameraPreview({visible}:{visible:boolean}) {
 const [permission,requestPermission]=useCameraPermissions();
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state!=='active')setEnabled(false);});return()=>sub.remove();},[]);
 // CameraView alone: no ref, capture, frame callback, recording, file output or provider reference.
 return <View style={{gap:10}}><Text>Camera preview only — RE cannot see your video yet.</Text>
 <Action label={enabled?'Turn camera preview off':'Turn camera preview on'} secondary onPress={async()=>{if(enabled){setEnabled(false);return;}const result=await requestPermission();setEnabled(result.granted);}}/>
 {permission?.status==='denied'&&!permission.canAskAgain&&<Text>Camera permission denied. Enable it in system settings to preview; voice is unaffected.</Text>}
 {visible&&enabled&&permission?.granted&&<CameraView style={{height:180,borderRadius:20,overflow:'hidden'}} facing="front" mode="picture" mute />}
 </View>;
}
