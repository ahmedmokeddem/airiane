import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, AppState, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, Easing, interpolate, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { hideNativeSplash } from './splash';
import { openingSession, openingTiming as timing, shouldAnimateOpening } from './timing';
import { symbolStrokes } from './symbol.generated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const ease = Easing.bezier(.23, 1, .32, 1).factory();
const navy = '#081018';

/** A single cold-launch layer, outside navigation and independent of provider/auth state. */
export function OpeningExperience({ ready, children }: PropsWithChildren<{ ready: boolean }>) {
  const [visible, setVisible] = useState(() => !openingSession.completed);
  const [laidOut, setLaidOut] = useState(false);
  const [imageSettled, setImageSettled] = useState(false);
  const [lightSettled, setLightSettled] = useState(false);
  const initialReduced = useReducedMotion();
  const started = useRef(false);
  const [mountedAt] = useState(() => Date.now());
  const progress = useSharedValue(0);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size = Math.min(320, Math.max(200, width - 48));
  const finish = useCallback(() => {
    hideNativeSplash();
    openingSession.completed = true;
    cancelAnimation(progress);
    setVisible(false);
  }, [progress]);

  useEffect(() => {
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', reduced => { if(reduced) finish(); });
    const state = AppState.addEventListener('change', next => { if(next !== 'active') finish(); });
    return () => { motion.remove(); state.remove(); cancelAnimation(progress); };
  }, [finish, progress]);

  useEffect(() => {
    if (!laidOut || !ready || !imageSettled || !lightSettled || started.current) return;
    started.current = true;
    // Two frames let the completed RN scene paint beneath Android's retained splash.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        hideNativeSplash();
        if (!visible || !shouldAnimateOpening(initialReduced, Date.now() - mountedAt)) {
          finish(); return;
        }
        progress.set(withTiming(timing.duration, { duration: timing.duration, easing: Easing.linear }, done => {
          if(done) scheduleOnRN(finish);
        }));
      });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [finish, imageSettled, initialReduced, laidOut, lightSettled, mountedAt, progress, ready, visible]);

  useEffect(() => {
    // Image/font errors, dev-client splash quirks and slow devices cannot hold the UI indefinitely.
    const deadline = setTimeout(() => { hideNativeSplash(); finish(); }, timing.readyDeadline + 150);
    return () => clearTimeout(deadline);
  }, [finish]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [timing.fade, timing.duration], [1, 0], 'clamp') }));
  const plateStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [130, 430], [0, 1], 'clamp'), transform: [{scale: interpolate(progress.get(), [130, 650], [.96, 1], 'clamp')}] }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, timing.light, 500, 850], [0, .9, .65, 0], 'clamp'), transform: [{scale: interpolate(progress.get(), [0, 600], [.94, 1.1], 'clamp')}] }));
  const symbolStyle = useAnimatedStyle(() => {
    const t = ease(Math.max(0, Math.min(1, (progress.get() - timing.settle) / 400)));
    // The final transform aligns the original 256x256 symbol with its exact .88 lockup transform.
    return { opacity: interpolate(progress.get(), [1950, 2110], [1, 0], 'clamp'), transform: [{translateX: ((10+.88*128)*320/920-160) * t}, {translateY: ((4+.88*128)*320/920-120*320/920) * t}, {scale: 1 + (.88*256*320/920/160 - 1) * t}] };
  });
  const wordmarkStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [timing.wordmark, 2100], [0,1], 'clamp') }));
  const lower = useAnimatedProps(() => ({ opacity: Math.max(0,Math.min(1,(progress.get()-timing.firstStart)/40)), strokeDashoffset: symbolStrokes[0].length * (1 - Math.max(0, Math.min(1,(progress.get()-timing.firstStart)/timing.firstDuration))) }));
  const upper = useAnimatedProps(() => ({ opacity: Math.max(0,Math.min(1,(progress.get()-timing.secondStart)/40)), strokeDashoffset: symbolStrokes[1].length * (1 - Math.max(0, Math.min(1,(progress.get()-timing.secondStart)/timing.secondDuration))) }));
  const endpoint = useAnimatedProps(() => ({ opacity: Math.max(0, Math.min(1,(progress.get()-timing.endpoint)/160)) }));

  return <View style={styles.root} onLayout={() => setLaidOut(true)} onPointerDownCapture={() => { if(visible && started.current) finish(); }} onTouchStartCapture={() => { if(visible && started.current) finish(); }}>
    {children}
    {visible && <Animated.View testID="opening-experience" pointerEvents="box-none" needsOffscreenAlphaCompositing style={[StyleSheet.absoluteFill, styles.overlay, rootStyle]}>
      <StatusBar style="light"/>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor:navy}]}/>
      <View pointerEvents="none" style={styles.scene}>
        <View style={{width:size,height:size* .75}}>
          <View style={[styles.artboard,{top:(size*.75-240)/2,transform:[{scale:size/320}]}]}>
            <Animated.View style={[styles.plate,plateStyle]}>
              <Image source={require('../../../assets/opening/illumination.png')} resizeMode="contain" style={{width:560,height:400}} onLoadEnd={() => setLightSettled(true)}/>
            </Animated.View>
            <Animated.View style={[styles.light,lightStyle]}><Image source={require('../../../assets/opening/illumination.png')} resizeMode="stretch" tintColor="#78DCC8" style={{width:40,height:40}}/></Animated.View>
            <Animated.View style={[styles.symbol,symbolStyle]}>
              <Svg width={160} height={160} viewBox="0 0 256 256">
                <Defs><LinearGradient id="approved-thread" x1="0" y1="1" x2="1" y2="0"><Stop offset="0" stopColor="#123B4B"/><Stop offset="1" stopColor="#268F89"/></LinearGradient></Defs>
                <AnimatedPath d={symbolStrokes[0].d} fill="none" stroke="#102F40" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[symbolStrokes[0].length,symbolStrokes[0].length]} animatedProps={lower}/>
                <AnimatedPath d={symbolStrokes[1].d} fill="none" stroke="url(#approved-thread)" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[symbolStrokes[1].length,symbolStrokes[1].length]} animatedProps={upper}/>
                <AnimatedCircle cx={207} cy={210} r={8} fill="#78DCC8" animatedProps={endpoint}/>
              </Svg>
            </Animated.View>
            <Animated.View style={[styles.wordmark,wordmarkStyle]}>
              <Image source={require('../../../assets/brand/airiane-wordmark.png')} resizeMode="contain" style={styles.wordmarkImage} onLoadEnd={() => setImageSettled(true)}/>
            </Animated.View>
          </View>
        </View>
      </View>
      <Pressable testID="skip-opening" accessibilityRole="button" accessibilityLabel="Skip opening animation" onPress={finish} style={[styles.skip,{bottom:Math.max(24,insets.bottom+12)}]}><Text style={styles.skipText}>Skip introduction</Text><Text style={styles.arrow}>→</Text></Pressable>
    </Animated.View>}
  </View>;
}
const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:navy},overlay:{zIndex:100},scene:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center'},
  artboard:{width:320,height:240,position:'absolute',alignSelf:'center'},
  plate:{position:'absolute',left:-120,top:-80,width:560,height:400},
  symbol:{position:'absolute',left:80,top:40,width:160,height:160},
  light:{position:'absolute',left:96,top:131,width:40,height:40},
  wordmark:{position:'absolute',left:0,top:78.26,width:320,height:83.48},wordmarkImage:{width:320,height:83.48},
  skip:{position:'absolute',alignSelf:'center',minHeight:48,paddingHorizontal:22,borderRadius:24,flexDirection:'row',gap:12,alignItems:'center',backgroundColor:'#ffffff0b',borderWidth:1,borderColor:'#ffffff20'},skipText:{color:'#c6d5df',fontSize:13},arrow:{color:'#78DCC8',fontSize:18},
});
