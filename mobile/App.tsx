import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DevicePermissions, PermissionState, useDeviceActivity } from './src/device';

const COLORS = {
  background: '#F4F7F4',
  card: '#FFFFFF',
  ink: '#17231F',
  muted: '#748078',
  line: '#E4EAE6',
  green: '#185A40',
  bright: '#6FDEA0',
  pale: '#E8F7EE',
  coral: '#FFDCD2',
  lilac: '#E9E1FF',
  yellow: '#FFE7A4',
};

type Tab = 'Inicio' | 'Muro' | 'Registrar' | 'Progreso' | 'Familia';

const tabs: { key: Tab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'Inicio', icon: 'home-outline' },
  { key: 'Muro', icon: 'people-outline' },
  { key: 'Registrar', icon: 'add' },
  { key: 'Progreso', icon: 'stats-chart-outline' },
  { key: 'Familia', icon: 'trophy-outline' },
];

const family = [
  { name: 'Ana', points: 1280, color: COLORS.coral },
  { name: 'Pedro', points: 1160, color: '#C8F3D8' },
  { name: 'Sofi', points: 980, color: COLORS.lilac },
  { name: 'Mateo', points: 760, color: COLORS.yellow },
];

const permissionCopy: Record<keyof DevicePermissions, { title: string; body: string; icon: keyof typeof Ionicons.glyphMap }> = {
  motion: { title: 'Movimiento y pasos', body: 'Cuenta pasos y detecta actividad física.', icon: 'walk-outline' },
  location: { title: 'Ubicación durante ejercicio', body: 'Calcula distancia y recorrido de tu entrenamiento.', icon: 'location-outline' },
  camera: { title: 'Cámara', body: 'Toma evidencia para compartir con tu familia.', icon: 'camera-outline' },
  notifications: { title: 'Notificaciones', body: 'Recibe recordatorios de rachas y retos.', icon: 'notifications-outline' },
};

function formatDuration(startedAt: number | null, now: number) {
  if (!startedAt) return '00:00';
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

function Avatar({ name, color, size = 38 }: { name: string; color: string; size?: number }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{name[0]}</Text>
    </View>
  );
}

function PermissionBadge({ state }: { state: PermissionState }) {
  const label = state === 'granted' ? 'Activo' : state === 'denied' ? 'Denegado' : state === 'unavailable' ? 'No disponible' : 'Conectar';
  return (
    <View style={[styles.permissionBadge, state === 'granted' && styles.permissionBadgeOn]}>
      <Text style={[styles.permissionBadgeText, state === 'granted' && styles.permissionBadgeTextOn]}>{label}</Text>
    </View>
  );
}

function AppContent() {
  const [tab, setTab] = useState<Tab>('Inicio');
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [liked, setLiked] = useState(false);
  const [workoutType, setWorkoutType] = useState('Caminar');
  const device = useDeviceActivity();

  useEffect(() => {
    if (!device.isTracking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [device.isTracking]);

  const duration = formatDuration(device.startedAt, now);
  const kilometers = (device.distance / 1000).toFixed(2);
  const calories = Math.round(device.distance * 0.055);
  const goalProgress = Math.min(1, device.steps / 8000);

  const permissionAction = async (key: keyof DevicePermissions) => {
    if (key === 'motion') await device.loadSteps();
    if (key === 'location') await device.requestLocation();
    if (key === 'camera') await device.requestCamera();
    if (key === 'notifications') {
      const enabled = await device.requestNotifications();
      if (enabled) Alert.alert('Recordatorio activado', '4x7 te recordará a las 6:30 p. m. cuando tu meta siga pendiente.');
    }
  };

  const openRegister = () => setTab('Registrar');

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.overline}>LUNES, 10 DE AGOSTO</Text>
          <Text style={styles.pageTitle}>Hola, Pedro</Text>
        </View>
        <Pressable style={styles.headerAvatar} onPress={() => setPermissionOpen(true)}>
          <Avatar name="Pedro" color="#C8F3D8" size={43} />
          <View style={styles.onlineDot} />
        </Pressable>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroLabel}>TU SEMANA 4×7</Text>
            <Text style={styles.heroTitle}>Un día más y{`\n`}cumples la meta</Text>
            <View style={styles.streakPill}><Text>🔥</Text><Text style={styles.streakText}>6 semanas de racha</Text></View>
          </View>
          <View style={styles.progressCircle}>
            <Text style={styles.progressBig}>3</Text>
            <Text style={styles.progressSmall}>de 4 días</Text>
          </View>
        </View>
        <View style={styles.weekRow}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
            <View key={`${day}-${index}`} style={styles.dayWrap}>
              <Text style={styles.dayLabel}>{day}</Text>
              <View style={[styles.dayCircle, index < 3 && styles.dayCircleDone, index === 4 && styles.dayCircleNext]}>
                <Text style={[styles.dayNumber, index < 3 && styles.dayNumberDone]}>{index < 3 ? '✓' : 10 + index}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View><Text style={styles.overline}>DATOS DEL TELÉFONO</Text><Text style={styles.sectionTitle}>Tu actividad de hoy</Text></View>
        <Pressable onPress={() => setPermissionOpen(true)}><Ionicons name="settings-outline" size={21} color={COLORS.green} /></Pressable>
      </View>

      <View style={styles.metricGrid}>
        <Pressable style={styles.metricCard} onPress={device.loadSteps}>
          <View style={[styles.metricIcon, { backgroundColor: COLORS.pale }]}><Ionicons name="footsteps-outline" size={20} color={COLORS.green} /></View>
          <Text style={styles.metricLabel}>PASOS</Text>
          <Text style={styles.metricValue}>{device.steps.toLocaleString('es-MX')}</Text>
          <View style={styles.miniProgress}><View style={[styles.miniProgressFill, { width: `${goalProgress * 100}%` }]} /></View>
          <Text style={styles.metricFoot}>Meta: 8,000</Text>
        </Pressable>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, { backgroundColor: '#FFF0EB' }]}><Ionicons name="flame-outline" size={20} color="#B85E42" /></View>
          <Text style={styles.metricLabel}>ENERGÍA</Text>
          <Text style={styles.metricValue}>{Math.max(320, calories)} <Text style={styles.metricUnit}>kcal</Text></Text>
          <Text style={styles.metricTrend}>+12% vs. ayer</Text>
          <Text style={styles.metricFoot}>Datos estimados</Text>
        </View>
      </View>

      <Pressable style={styles.startCard} onPress={openRegister}>
        <View style={styles.startIcon}><Ionicons name="play" size={18} color="white" /></View>
        <View style={styles.startCopy}><Text style={styles.startTitle}>Iniciar entrenamiento</Text><Text style={styles.startBody}>GPS, tiempo y distancia en vivo</Text></View>
        <Ionicons name="chevron-forward" size={20} color="#A9B5AE" />
      </Pressable>

      <View style={styles.sectionHeading}>
        <View><Text style={styles.overline}>MURO DEL SUDOR</Text><Text style={styles.sectionTitle}>Tu familia se movió</Text></View>
        <Pressable onPress={() => setTab('Muro')}><Text style={styles.seeAll}>Ver todo</Text></Pressable>
      </View>
      <View style={styles.compactPost}>
        <View style={styles.postHeader}><Avatar name="Ana" color={COLORS.coral} /><View style={styles.postPerson}><Text style={styles.postName}>Ana</Text><Text style={styles.postTime}>Hace 32 min · Parque México</Text></View><Ionicons name="ellipsis-horizontal" size={18} color="#9AA69F" /></View>
        <View style={styles.postArt}>
          <Text style={styles.postArtWord}>AIRE</Text>
          <View style={styles.routeShape} />
          <View style={styles.statPill}><Text style={styles.statPillText}>5.0 KM · 31 MIN</Text></View>
        </View>
        <View style={styles.postBody}>
          <Text style={styles.postTitle}>Mi mejor ritmo del mes ✨</Text>
          <Text style={styles.postCaption}>Hoy costó salir, pero valió cada paso.</Text>
          <View style={styles.postActions}><Pressable style={styles.action} onPress={() => setLiked((value) => !value)}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#E7675B' : COLORS.muted} /><Text style={styles.actionText}>{liked ? 9 : 8}</Text></Pressable><View style={styles.action}><Ionicons name="chatbubble-outline" size={18} color={COLORS.muted} /><Text style={styles.actionText}>3</Text></View><Ionicons name="share-social-outline" size={19} color={COLORS.muted} /></View>
        </View>
      </View>
    </ScrollView>
  );

  const renderFeed = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}><View><Text style={styles.overline}>EN FAMILIA</Text><Text style={styles.pageTitle}>Muro del Sudor</Text></View><Pressable style={styles.roundButton} onPress={device.captureEvidence}><Ionicons name="camera-outline" size={22} color={COLORS.green} /></Pressable></View>
      <Text style={styles.introText}>Fotos, entrenamientos y pequeñas victorias de quienes más quieres.</Text>
      {device.evidenceUri && (
        <View style={styles.evidenceCard}>
          <Image source={{ uri: device.evidenceUri }} style={styles.evidenceImage} />
          <View style={styles.evidenceOverlay}><Text style={styles.evidenceLabel}>TU EVIDENCIA DE HOY</Text><Text style={styles.evidenceTitle}>Listo para compartir</Text></View>
        </View>
      )}
      <View style={styles.feedPost}>
        <View style={styles.postHeader}><Avatar name="Sofi" color={COLORS.lilac} /><View style={styles.postPerson}><Text style={styles.postName}>Sofi</Text><Text style={styles.postTime}>Ayer · En casa</Text></View><Ionicons name="ellipsis-horizontal" size={18} color="#9AA69F" /></View>
        <View style={[styles.postArt, styles.strengthArt]}><Text style={styles.postArtWord}>FUERZA</Text><View style={styles.weightShape}><View /><View /></View><View style={styles.statPill}><Text style={styles.statPillText}>46 MIN · +100 PTS</Text></View></View>
        <View style={styles.postBody}><Text style={styles.postTitle}>Día de piernas completado</Text><Text style={styles.postCaption}>Semana 3 del reto. Ya se siente la diferencia.</Text><View style={styles.postActions}><View style={styles.action}><Ionicons name="heart" size={20} color="#E7675B" /><Text style={styles.actionText}>12</Text></View><View style={styles.action}><Ionicons name="chatbubble-outline" size={18} color={COLORS.muted} /><Text style={styles.actionText}>5</Text></View></View></View>
      </View>
      <Pressable style={styles.cameraCta} onPress={device.captureEvidence}><Ionicons name="camera" size={22} color="white" /><View><Text style={styles.cameraCtaTitle}>Subir evidencia</Text><Text style={styles.cameraCtaBody}>Usa la cámara del teléfono</Text></View></Pressable>
    </ScrollView>
  );

  const renderRegister = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, styles.registerContent]} showsVerticalScrollIndicator={false}>
      <View style={styles.centerHeader}><Text style={styles.overline}>ENTRENAMIENTO EN VIVO</Text><Text style={styles.pageTitle}>{device.isTracking ? 'Sigue así, Pedro' : '¿Qué harás hoy?'}</Text><Text style={styles.introText}>{device.isTracking ? 'Estamos usando el GPS mientras entrenas.' : 'Elige una actividad y deja que 4x7 mida el resto.'}</Text></View>

      {!device.isTracking ? (
        <>
          <View style={styles.workoutTypes}>
            {[
              ['Caminar', 'walk-outline'],
              ['Correr', 'fitness-outline'],
              ['Bicicleta', 'bicycle-outline'],
              ['Fuerza', 'barbell-outline'],
            ].map(([label, icon]) => (
              <Pressable key={label} style={[styles.workoutType, workoutType === label && styles.workoutTypeOn]} onPress={() => setWorkoutType(label)}>
                <View style={[styles.workoutTypeIcon, workoutType === label && styles.workoutTypeIconOn]}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={26} color={workoutType === label ? 'white' : COLORS.green} /></View>
                <Text style={[styles.workoutTypeText, workoutType === label && styles.workoutTypeTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.gpsNote}><Ionicons name="location" size={20} color={COLORS.green} /><View><Text style={styles.gpsNoteTitle}>Ruta inteligente</Text><Text style={styles.gpsNoteBody}>Para actividades al aire libre usaremos tu ubicación solamente durante el entrenamiento.</Text></View></View>
          <Pressable style={styles.bigStartButton} onPress={device.startWorkout}><Ionicons name="play" size={26} color={COLORS.green} /><Text style={styles.bigStartText}>Comenzar {workoutType.toLowerCase()}</Text></Pressable>
        </>
      ) : (
        <View style={styles.liveWorkout}>
          <View style={styles.livePulse}><View style={styles.livePulseInner}><Ionicons name="walk" size={40} color="white" /></View></View>
          <Text style={styles.liveType}>{workoutType.toUpperCase()}</Text>
          <Text style={styles.timer}>{duration}</Text>
          <View style={styles.liveMetrics}>
            <View><Text style={styles.liveMetricValue}>{kilometers}</Text><Text style={styles.liveMetricLabel}>KM</Text></View>
            <View style={styles.metricDivider} />
            <View><Text style={styles.liveMetricValue}>{calories}</Text><Text style={styles.liveMetricLabel}>KCAL</Text></View>
            <View style={styles.metricDivider} />
            <View><Text style={styles.liveMetricValue}>{Math.round(device.distance / 0.78)}</Text><Text style={styles.liveMetricLabel}>PASOS</Text></View>
          </View>
          <Pressable style={styles.stopButton} onPress={async () => { await device.stopWorkout(); Alert.alert('¡Entrenamiento completado!', `Recorriste ${kilometers} km y sumaste +100 puntos.`); }}><View style={styles.stopSquare} /><Text style={styles.stopText}>Finalizar entrenamiento</Text></Pressable>
        </View>
      )}
    </ScrollView>
  );

  const renderProgress = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}><View><Text style={styles.overline}>TU EVOLUCIÓN</Text><Text style={styles.pageTitle}>Progreso</Text></View><View style={styles.periodPill}><Text style={styles.periodText}>30 días⌄</Text></View></View>
      <View style={styles.weightCard}>
        <View style={styles.weightTop}><View><Text style={styles.metricLabel}>PESO ACTUAL</Text><Text style={styles.weightValue}>82.4 <Text style={styles.weightUnit}>kg</Text></Text></View><View style={styles.positivePill}><Ionicons name="trending-down" size={13} color={COLORS.green} /><Text style={styles.positiveText}>−2.1 kg</Text></View></View>
        <View style={styles.chart}>
          {[68, 58, 62, 47, 50, 35, 31, 23].map((height, index) => <View key={index} style={styles.chartColumn}><View style={[styles.chartDot, index === 7 && styles.chartDotLast]} /><View style={[styles.chartBar, { height }]} /></View>)}
        </View>
        <View style={styles.chartLabels}><Text>12 JUL</Text><Text>26 JUL</Text><Text>10 AGO</Text></View>
      </View>
      <Text style={styles.sectionTitle}>Indicadores</Text>
      <View style={styles.progressList}>
        {[
          ['Cintura', '91.5 cm', '−3.0 cm', 'resize-outline', COLORS.pale],
          ['Entrenamientos', '14', '+18%', 'fitness-outline', '#FFF0EB'],
          ['Racha actual', '6 sem', 'Mejor: 9', 'flame-outline', '#FFF6D8'],
          ['Pasos promedio', '7,240', '+820', 'footsteps-outline', '#EEE8FF'],
        ].map(([label, value, trend, icon, color]) => (
          <View style={styles.progressRow} key={label}><View style={[styles.progressRowIcon, { backgroundColor: color }]}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={COLORS.green} /></View><View style={styles.progressRowCopy}><Text style={styles.progressRowLabel}>{label}</Text><Text style={styles.progressRowValue}>{value}</Text></View><Text style={styles.progressRowTrend}>{trend}</Text></View>
        ))}
      </View>
      <View style={styles.aiCard}><View style={styles.aiIcon}><Ionicons name="sparkles" size={20} color="#7158B3" /></View><View style={styles.aiCopy}><Text style={styles.aiLabel}>ANÁLISIS 4×7</Text><Text style={styles.aiTitle}>Vas a buen ritmo</Text><Text style={styles.aiBody}>Con tu constancia actual podrías llegar a tu siguiente meta en aproximadamente 7 semanas.</Text></View></View>
    </ScrollView>
  );

  const renderFamily = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}><View><Text style={styles.overline}>FAMILIA GONZÁLEZ</Text><Text style={styles.pageTitle}>Liga 4×7</Text></View><Pressable style={styles.roundButton}><Ionicons name="person-add-outline" size={21} color={COLORS.green} /></Pressable></View>
      <View style={styles.podiumCard}>
        <Text style={styles.podiumLabel}>PUNTOS EN FAMILIA</Text><Text style={styles.podiumTotal}>4,180</Text><Text style={styles.podiumTrend}>+740 esta semana</Text>
        <View style={styles.podiumPeople}><View style={[styles.podiumPerson, { marginTop: 28 }]}><Avatar name="Pedro" color="#C8F3D8" size={58} /><Text style={styles.podiumName}>Pedro</Text><View style={[styles.podiumBlock, styles.podiumSecond]}><Text style={styles.podiumPlace}>2</Text><Text style={styles.podiumPoints}>1,160</Text></View></View><View style={styles.podiumPerson}><View style={styles.crown}><Ionicons name="trophy" size={17} color="#8E6914" /></View><Avatar name="Ana" color={COLORS.coral} size={66} /><Text style={styles.podiumName}>Ana</Text><View style={[styles.podiumBlock, styles.podiumFirst]}><Text style={styles.podiumPlace}>1</Text><Text style={styles.podiumPoints}>1,280</Text></View></View><View style={[styles.podiumPerson, { marginTop: 46 }]}><Avatar name="Sofi" color={COLORS.lilac} size={54} /><Text style={styles.podiumName}>Sofi</Text><View style={[styles.podiumBlock, styles.podiumThird]}><Text style={styles.podiumPlace}>3</Text><Text style={styles.podiumPoints}>980</Text></View></View></View>
      </View>
      <View style={styles.challengeCard}><View style={styles.challengeTop}><View><Text style={styles.overline}>RETO ACTIVO</Text><Text style={styles.challengeTitle}>Constancia familiar</Text></View><View style={styles.challengeDays}><Text style={styles.challengeDaysBig}>21</Text><Text style={styles.challengeDaysSmall}>DÍAS</Text></View></View><Text style={styles.challengeBody}>Que todos cumplan su meta semanal durante tres semanas consecutivas.</Text><View style={styles.challengeProgress}><View style={styles.challengeProgressFill} /></View><View style={styles.challengeBottom}><Text style={styles.challengeWeek}>Semana 2 de 3</Text><Text style={styles.challengePercent}>67%</Text></View></View>
      <Text style={styles.sectionTitle}>Clasificación</Text>
      <View style={styles.rankingCard}>{family.map((member, index) => <View key={member.name} style={[styles.rankingRow, member.name === 'Pedro' && styles.rankingRowMe]}><Text style={styles.rankNumber}>{index + 1}</Text><Avatar name={member.name} color={member.color} size={36} /><View style={styles.rankingPerson}><Text style={styles.rankingName}>{member.name}{member.name === 'Pedro' ? ' · Tú' : ''}</Text><Text style={styles.rankingGain}>+{120 - index * 20} esta semana</Text></View><Text style={styles.rankingPoints}>{member.points.toLocaleString('es-MX')}</Text></View>)}</View>
    </ScrollView>
  );

  const screen = tab === 'Inicio' ? renderHome() : tab === 'Muro' ? renderFeed() : tab === 'Registrar' ? renderRegister() : tab === 'Progreso' ? renderProgress() : renderFamily();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {screen}
      <View style={styles.tabBar}>
        {tabs.map((item) => {
          const selected = tab === item.key;
          const isAdd = item.key === 'Registrar';
          return (
            <Pressable key={item.key} style={styles.tabItem} onPress={() => setTab(item.key)}>
              <View style={[isAdd && styles.addTab, isAdd && selected && styles.addTabSelected]}><Ionicons name={item.icon} size={isAdd ? 27 : 22} color={isAdd ? 'white' : selected ? COLORS.green : '#919C96'} /></View>
              {!isAdd && <Text style={[styles.tabLabel, selected && styles.tabLabelOn]}>{item.key}</Text>}
            </Pressable>
          );
        })}
      </View>

      <Modal visible={permissionOpen} transparent animationType="slide" onRequestClose={() => setPermissionOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPermissionOpen(false)}>
          <Pressable style={styles.permissionSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.overline}>CONECTA TU TELÉFONO</Text>
            <Text style={styles.sheetTitle}>Permisos de 4×7</Text>
            <Text style={styles.sheetIntro}>Tú decides qué comparte el celular. Puedes cambiarlo cuando quieras.</Text>
            {(Object.keys(permissionCopy) as (keyof DevicePermissions)[]).map((key) => {
              const item = permissionCopy[key];
              return (
                <Pressable style={styles.permissionRow} key={key} onPress={() => permissionAction(key)}>
                  <View style={styles.permissionIcon}><Ionicons name={item.icon} size={22} color={COLORS.green} /></View>
                  <View style={styles.permissionCopy}><Text style={styles.permissionTitle}>{item.title}</Text><Text style={styles.permissionBody}>{item.body}</Text></View>
                  <PermissionBadge state={device.permissions[key]} />
                </Pressable>
              );
            })}
            <Pressable style={styles.sheetDone} onPress={() => setPermissionOpen(false)}><Text style={styles.sheetDoneText}>Listo</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NativeStatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <AppContent />
    </SafeAreaProvider>
  );
}

const width = Dimensions.get('window').width;
const cardWidth = Math.min((width - 44) / 2, 220);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 116 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  overline: { color: '#839088', fontSize: 10, fontWeight: '800', letterSpacing: 1.25, marginBottom: 5 },
  pageTitle: { color: COLORS.ink, fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -1.15 },
  headerAvatar: { position: 'relative' },
  onlineDot: { position: 'absolute', right: 0, bottom: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#48C984', borderWidth: 2, borderColor: COLORS.background },
  roundButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,.9)' },
  avatarText: { color: '#304139', fontWeight: '800' },
  heroCard: { backgroundColor: COLORS.green, borderRadius: 26, paddingHorizontal: 21, paddingTop: 23, paddingBottom: 18, marginBottom: 27, shadowColor: '#153D2D', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroCopy: { flex: 1, paddingRight: 8 },
  heroLabel: { color: 'rgba(255,255,255,.58)', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  heroTitle: { color: 'white', fontSize: 26, lineHeight: 28, fontWeight: '800', letterSpacing: -1, marginTop: 10 },
  streakPill: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(255,255,255,.10)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, marginTop: 15 },
  streakText: { color: 'white', fontSize: 10, fontWeight: '700' },
  progressCircle: { width: 99, height: 99, borderRadius: 50, borderWidth: 9, borderColor: COLORS.bright, borderRightColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' },
  progressBig: { color: 'white', fontSize: 31, lineHeight: 34, fontWeight: '900' },
  progressSmall: { color: 'rgba(255,255,255,.62)', fontSize: 9 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  dayWrap: { alignItems: 'center', gap: 7 },
  dayLabel: { color: 'rgba(255,255,255,.5)', fontSize: 9, fontWeight: '700' },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.09)' },
  dayCircleDone: { backgroundColor: COLORS.bright },
  dayCircleNext: { borderWidth: 1, borderColor: COLORS.bright, backgroundColor: 'transparent' },
  dayNumber: { color: 'rgba(255,255,255,.65)', fontSize: 10, fontWeight: '700' },
  dayNumberDone: { color: COLORS.green },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: COLORS.ink, fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.6 },
  seeAll: { color: COLORS.green, fontSize: 12, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  metricCard: { flex: 1, minHeight: 178, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 20, padding: 15 },
  metricIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  metricLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.05 },
  metricValue: { color: COLORS.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.9, marginTop: 4 },
  metricUnit: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  metricTrend: { color: COLORS.green, fontSize: 10, fontWeight: '700', marginTop: 9 },
  metricFoot: { color: '#98A39D', fontSize: 9, marginTop: 'auto' },
  miniProgress: { height: 5, borderRadius: 4, backgroundColor: '#E7ECE9', marginTop: 11, overflow: 'hidden' },
  miniProgressFill: { height: '100%', backgroundColor: COLORS.bright, borderRadius: 4 },
  startCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, padding: 14, marginBottom: 29 },
  startIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.green, marginRight: 12 },
  startCopy: { flex: 1 },
  startTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '800' },
  startBody: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  compactPost: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 22, overflow: 'hidden' },
  feedPost: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 22, overflow: 'hidden', marginTop: 18 },
  postHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  postPerson: { flex: 1 },
  postName: { color: COLORS.ink, fontSize: 13, fontWeight: '800' },
  postTime: { color: COLORS.muted, fontSize: 9, marginTop: 2 },
  postArt: { height: 205, backgroundColor: '#BFDACD', padding: 17, justifyContent: 'space-between', overflow: 'hidden' },
  strengthArt: { backgroundColor: '#D4B8AA' },
  postArtWord: { color: 'rgba(24,70,50,.55)', fontSize: 10, fontWeight: '900', letterSpacing: 2.2 },
  routeShape: { position: 'absolute', width: 180, height: 130, borderRadius: 90, borderWidth: 4, borderLeftColor: 'transparent', borderBottomColor: 'transparent', borderColor: 'rgba(255,255,255,.75)', right: 40, top: 30, transform: [{ rotate: '-18deg' }] },
  weightShape: { position: 'absolute', alignSelf: 'center', top: 70, flexDirection: 'row', gap: 12 },
  statPill: { alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,.84)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  statPillText: { color: '#294237', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  postBody: { padding: 15 },
  postTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  postCaption: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 18, borderTopWidth: 1, borderTopColor: '#EDF0EE', marginTop: 13, paddingTop: 11 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  introText: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: -10, marginBottom: 20 },
  evidenceCard: { height: 280, borderRadius: 22, overflow: 'hidden', marginBottom: 18, backgroundColor: '#DCE5E0' },
  evidenceImage: { width: '100%', height: '100%' },
  evidenceOverlay: { position: 'absolute', left: 14, right: 14, bottom: 14, backgroundColor: 'rgba(18,47,35,.78)', borderRadius: 15, padding: 14 },
  evidenceLabel: { color: 'rgba(255,255,255,.6)', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  evidenceTitle: { color: 'white', fontSize: 17, fontWeight: '800', marginTop: 3 },
  cameraCta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.green, borderRadius: 18, padding: 16, marginTop: 16 },
  cameraCtaTitle: { color: 'white', fontSize: 14, fontWeight: '800' },
  cameraCtaBody: { color: 'rgba(255,255,255,.65)', fontSize: 10, marginTop: 2 },
  registerContent: { minHeight: '100%' },
  centerHeader: { alignItems: 'center', marginTop: 10 },
  workoutTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  workoutType: { width: cardWidth, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 20, padding: 15, alignItems: 'center' },
  workoutTypeOn: { backgroundColor: COLORS.pale, borderColor: '#75BE92' },
  workoutTypeIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pale, marginBottom: 10 },
  workoutTypeIconOn: { backgroundColor: COLORS.green },
  workoutTypeText: { color: COLORS.ink, fontSize: 12, fontWeight: '700' },
  workoutTypeTextOn: { color: COLORS.green },
  gpsNote: { flexDirection: 'row', gap: 11, backgroundColor: '#EEF2FF', borderRadius: 17, padding: 15, marginTop: 20 },
  gpsNoteTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  gpsNoteBody: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 3, paddingRight: 20 },
  bigStartButton: { height: 62, borderRadius: 20, backgroundColor: COLORS.bright, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 },
  bigStartText: { color: COLORS.green, fontSize: 16, fontWeight: '900' },
  liveWorkout: { alignItems: 'center', backgroundColor: COLORS.green, borderRadius: 30, padding: 26, marginTop: 20 },
  livePulse: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(111,222,160,.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  livePulseInner: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#2D7959', alignItems: 'center', justifyContent: 'center' },
  liveType: { color: COLORS.bright, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  timer: { color: 'white', fontSize: 60, lineHeight: 70, fontWeight: '800', letterSpacing: -2 },
  liveMetrics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%', marginVertical: 24 },
  liveMetricValue: { color: 'white', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  liveMetricLabel: { color: 'rgba(255,255,255,.55)', fontSize: 8, fontWeight: '800', letterSpacing: 1, textAlign: 'center', marginTop: 4 },
  metricDivider: { width: 1, height: 35, backgroundColor: 'rgba(255,255,255,.16)' },
  stopButton: { width: '100%', height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'white', borderRadius: 18 },
  stopSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#E85C55' },
  stopText: { color: COLORS.ink, fontSize: 14, fontWeight: '800' },
  periodPill: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, paddingVertical: 9 },
  periodText: { color: COLORS.ink, fontSize: 10, fontWeight: '700' },
  weightCard: { backgroundColor: COLORS.card, borderRadius: 22, borderWidth: 1, borderColor: COLORS.line, padding: 18, marginBottom: 24 },
  weightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weightValue: { color: COLORS.ink, fontSize: 32, fontWeight: '900', letterSpacing: -1.3, marginTop: 3 },
  weightUnit: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
  positivePill: { flexDirection: 'row', gap: 4, backgroundColor: COLORS.pale, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  positiveText: { color: COLORS.green, fontSize: 10, fontWeight: '800' },
  chart: { height: 110, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  chartColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: 2, backgroundColor: '#8AC6A3' },
  chartDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4AA477', marginBottom: -4, zIndex: 2 },
  chartDotLast: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: 'white', backgroundColor: COLORS.green },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressList: { backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, marginTop: 12, overflow: 'hidden' },
  progressRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#EDF0EE' },
  progressRowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  progressRowCopy: { flex: 1 },
  progressRowLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '700' },
  progressRowValue: { color: COLORS.ink, fontSize: 16, fontWeight: '900', marginTop: 2 },
  progressRowTrend: { color: COLORS.green, fontSize: 10, fontWeight: '800' },
  aiCard: { flexDirection: 'row', backgroundColor: '#F0EBFF', borderRadius: 20, padding: 16, marginTop: 16, gap: 12 },
  aiIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' },
  aiCopy: { flex: 1 },
  aiLabel: { color: '#7158B3', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  aiTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '800', marginTop: 3 },
  aiBody: { color: '#6F6684', fontSize: 10, lineHeight: 15, marginTop: 4 },
  podiumCard: { backgroundColor: COLORS.green, borderRadius: 27, paddingTop: 22, paddingHorizontal: 18, marginBottom: 15, alignItems: 'center', overflow: 'hidden' },
  podiumLabel: { color: 'rgba(255,255,255,.55)', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  podiumTotal: { color: 'white', fontSize: 38, fontWeight: '900', letterSpacing: -1.5, marginTop: 3 },
  podiumTrend: { color: COLORS.bright, fontSize: 10, fontWeight: '700' },
  podiumPeople: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', width: '100%', marginTop: 18 },
  podiumPerson: { width: '31%', alignItems: 'center' },
  podiumName: { color: 'white', fontSize: 10, fontWeight: '800', marginVertical: 5 },
  podiumBlock: { width: '100%', alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  podiumFirst: { height: 90, backgroundColor: '#32775A' },
  podiumSecond: { height: 65, backgroundColor: '#2B694F' },
  podiumThird: { height: 49, backgroundColor: '#285F49' },
  podiumPlace: { color: 'rgba(255,255,255,.45)', fontSize: 22, fontWeight: '900' },
  podiumPoints: { color: 'white', fontSize: 9, fontWeight: '800' },
  crown: { position: 'absolute', top: -18, zIndex: 2, width: 31, height: 31, borderRadius: 16, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  challengeCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 22, padding: 18, marginBottom: 24 },
  challengeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeTitle: { color: COLORS.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  challengeDays: { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  challengeDaysBig: { color: '#6D5315', fontSize: 20, lineHeight: 21, fontWeight: '900' },
  challengeDaysSmall: { color: '#8A6A1B', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  challengeBody: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 10, maxWidth: 280 },
  challengeProgress: { height: 7, borderRadius: 5, backgroundColor: '#EDF0EE', marginTop: 17, overflow: 'hidden' },
  challengeProgressFill: { width: '67%', height: '100%', backgroundColor: '#F2BD3D', borderRadius: 5 },
  challengeBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  challengeWeek: { color: COLORS.muted, fontSize: 9 },
  challengePercent: { color: '#866616', fontSize: 9, fontWeight: '800' },
  rankingCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 20, overflow: 'hidden', marginTop: 12 },
  rankingRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 9, borderBottomWidth: 1, borderBottomColor: '#EDF0EE' },
  rankingRowMe: { backgroundColor: COLORS.pale },
  rankNumber: { width: 16, color: COLORS.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  rankingPerson: { flex: 1 },
  rankingName: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  rankingGain: { color: COLORS.muted, fontSize: 8, marginTop: 2 },
  rankingPoints: { color: COLORS.ink, fontSize: 12, fontWeight: '900' },
  tabBar: { position: 'absolute', left: 12, right: 12, bottom: Platform.OS === 'ios' ? 8 : 10, height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,.97)', borderWidth: 1, borderColor: COLORS.line, borderRadius: 22, shadowColor: '#173B2C', shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14 },
  tabItem: { flex: 1, height: 62, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { color: '#919C96', fontSize: 8, fontWeight: '700' },
  tabLabelOn: { color: COLORS.green },
  addTab: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.green, marginTop: -23, borderWidth: 4, borderColor: COLORS.background },
  addTabSelected: { backgroundColor: '#0F4833' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(13,31,23,.46)' },
  permissionSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 32 : 22 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#C9D1CC', alignSelf: 'center', marginBottom: 21 },
  sheetTitle: { color: COLORS.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.9 },
  sheetIntro: { color: COLORS.muted, fontSize: 11, lineHeight: 17, marginTop: 7, marginBottom: 15 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 17, padding: 12, marginBottom: 8 },
  permissionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pale, marginRight: 10 },
  permissionCopy: { flex: 1, paddingRight: 5 },
  permissionTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  permissionBody: { color: COLORS.muted, fontSize: 8, lineHeight: 12, marginTop: 2 },
  permissionBadge: { borderRadius: 10, backgroundColor: '#EEF1EF', paddingHorizontal: 8, paddingVertical: 6 },
  permissionBadgeOn: { backgroundColor: COLORS.pale },
  permissionBadgeText: { color: COLORS.muted, fontSize: 8, fontWeight: '800' },
  permissionBadgeTextOn: { color: COLORS.green },
  sheetDone: { height: 51, borderRadius: 17, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  sheetDoneText: { color: 'white', fontSize: 14, fontWeight: '900' },
});
