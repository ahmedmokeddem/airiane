import { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import type { CompanionState } from './call-state';
// Original .riv artwork is absent. This native gradient orb follows Stitch code.html.
// Only transforms/opacity animate, on the native driver; no React renders per frame.
export const Companion=memo(function Companion({state,levelRef,size=210}:{state:CompanionState;levelRef:{current:number};size?:number}) {
 const [baseSize]=useState(size);const compact=useRef(new Animated.Value(1)).current;
 const [reduced,setReduced]=useState(false);const breath=useRef(new Animated.Value(0)).current;
 const energy=useRef(new Animated.Value(0)).current;
 useEffect(()=>{void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>sub.remove();},[]);
 useEffect(()=>{breath.stopAnimation();breath.setValue(0);if(reduced||state==='disconnected')return;
  const duration=state==='connecting'?1300:state==='listening'?2300:state==='speaking'?1500:3500;
  const loop=Animated.loop(Animated.sequence([Animated.timing(breath,{toValue:1,duration,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),Animated.timing(breath,{toValue:0,duration,easing:Easing.inOut(Easing.sin),useNativeDriver:true})]));loop.start();return()=>loop.stop();
 },[state,reduced,breath]);
 useEffect(()=>{const timer=setInterval(()=>{Animated.timing(energy,{toValue:reduced?0:Math.max(0,Math.min(levelRef.current*3,1)),duration:120,useNativeDriver:true}).start();},120);return()=>clearInterval(timer);},[levelRef,reduced,energy]);
 useEffect(()=>{Animated.timing(compact,{toValue:size/baseSize,duration:reduced?0:450,useNativeDriver:true}).start();},[size,baseSize,compact,reduced]);
 const scale=Animated.multiply(compact,Animated.add(breath.interpolate({inputRange:[0,1],outputRange:[1,1.035]}),energy.interpolate({inputRange:[0,1],outputRange:[0,0.09]})));
 return <View testID={`companion-${state}`} accessible accessibilityLabel={`RE companion, ${state}`} style={{width:size+90,height:size+48,alignItems:'center',justifyContent:'center'}}>
  <Animated.View style={[s.aura,{width:size+100,height:size+100,borderRadius:size,opacity:breath.interpolate({inputRange:[0,1],outputRange:[0.3,0.65]}),transform:[{scale}]}]}/>
  <Animated.View style={[s.orb,{width:baseSize,height:baseSize,borderRadius:baseSize/2,transform:[{scale},{translateY:reduced?0:breath.interpolate({inputRange:[0,1],outputRange:[3,-5]})}]}]}>
   <View style={s.shine}/><View style={s.face}><View style={s.eyes}><View style={[s.eye,state==='thinking'&&s.softEye]}/><View style={[s.eye,state==='thinking'&&s.softEye]}/></View><Animated.View style={[s.mouth,{transform:[{scaleY:state==='speaking'?energy.interpolate({inputRange:[0,1],outputRange:[1,4]}):1}]}]}/></View>
  </Animated.View>
 </View>;
});
const s=StyleSheet.create({
 aura:{position:'absolute',backgroundImage:'radial-gradient(circle, rgba(101,175,165,0.5) 0%, rgba(101,175,165,0) 70%)'},
 orb:{overflow:'hidden',backgroundColor:'#65afa5',backgroundImage:'radial-gradient(circle at 35% 30%, #ffffff 0%, #c4b5fd 28%, #65afa5 65%, #15283b 100%)',boxShadow:'0 16px 50px rgba(101,175,165,0.35)',alignItems:'center',justifyContent:'center'},
 shine:{position:'absolute',width:'94%',height:'94%',top:2,borderRadius:200,borderTopWidth:1,borderColor:'#ffffff55'},
 face:{alignItems:'center',gap:11,marginTop:12},eyes:{flexDirection:'row',gap:22},eye:{width:7,height:7,borderRadius:4,backgroundColor:'#f2fffc'},softEye:{height:3,marginVertical:2},mouth:{width:16,height:3,borderBottomWidth:2,borderColor:'#ecfff8',borderRadius:8},
});

export const AudioWave=memo(function AudioWave({levelRef,active}:{levelRef:{current:number};active:boolean}){
 const level=useRef(new Animated.Value(0.1)).current;const [reduced,setReduced]=useState(false);
 useEffect(()=>{void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>sub.remove();},[]);
 useEffect(()=>{if(!active||reduced){level.setValue(0.1);return;}const timer=setInterval(()=>{Animated.timing(level,{toValue:0.1+Math.max(0,Math.min(levelRef.current*3,1))*0.9,duration:120,useNativeDriver:true}).start();},120);return()=>clearInterval(timer);},[active,levelRef,level,reduced]);
 return <View accessibilityElementsHidden style={{height:30,flexDirection:'row',alignItems:'center',gap:5,marginTop:14}}>{[0.35,0.65,1,0.65,0.35].map((weight,i)=><Animated.View key={i} style={{height:26,width:3,borderRadius:3,backgroundColor:'#65afa5',transform:[{scaleY:Animated.multiply(level,weight)}]}}/>)}</View>;
});
