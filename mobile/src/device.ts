import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Pedometer } from 'expo-sensors';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable';

export type DevicePermissions = {
  motion: PermissionState;
  location: PermissionState;
  camera: PermissionState;
  notifications: PermissionState;
};

type Point = { latitude: number; longitude: number };

const DEFAULT_PERMISSIONS: DevicePermissions = {
  motion: 'unknown',
  location: 'unknown',
  camera: 'unknown',
  notifications: 'unknown',
};

function distanceMeters(a: Point, b: Point) {
  const earthRadius = 6_371_000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function useDeviceActivity() {
  const [permissions, setPermissions] = useState<DevicePermissions>(DEFAULT_PERMISSIONS);
  const [steps, setSteps] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const stepSubscription = useRef<{ remove: () => void } | null>(null);
  const lastPoint = useRef<Point | null>(null);

  const setPermission = useCallback((key: keyof DevicePermissions, value: PermissionState) => {
    setPermissions((current) => ({ ...current, [key]: value }));
  }, []);

  const refreshPermissions = useCallback(async () => {
    const [motion, location, camera, notifications] = await Promise.allSettled([
      Pedometer.getPermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
      ImagePicker.getCameraPermissionsAsync(),
      Notifications.getPermissionsAsync(),
    ]);

    setPermissions({
      motion: motion.status === 'fulfilled' ? (motion.value.granted ? 'granted' : 'unknown') : 'unavailable',
      location: location.status === 'fulfilled' ? (location.value.granted ? 'granted' : 'unknown') : 'unavailable',
      camera: camera.status === 'fulfilled' ? (camera.value.granted ? 'granted' : 'unknown') : 'unavailable',
      notifications: notifications.status === 'fulfilled' ? (notifications.value.granted ? 'granted' : 'unknown') : 'unavailable',
    });
  }, []);

  const loadSteps = useCallback(async () => {
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setPermission('motion', 'unavailable');
        return;
      }
      const result = await Pedometer.requestPermissionsAsync();
      if (!result.granted) {
        setPermission('motion', 'denied');
        return;
      }
      setPermission('motion', 'granted');
      if (Platform.OS === 'ios') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const today = await Pedometer.getStepCountAsync(start, new Date());
        setSteps(today.steps);
      }
    } catch {
      setPermission('motion', 'unavailable');
    }
  }, [setPermission]);

  useEffect(() => {
    refreshPermissions();
    AsyncStorage.getItem('4x7:evidence').then((uri) => uri && setEvidenceUri(uri));
    return () => {
      locationSubscription.current?.remove();
      stepSubscription.current?.remove();
    };
  }, [refreshPermissions]);

  useEffect(() => {
    if (permissions.motion !== 'granted') return;
    stepSubscription.current?.remove();
    stepSubscription.current = Pedometer.watchStepCount((result) => {
      setSteps((current) => Platform.OS === 'ios' ? Math.max(current, result.steps) : result.steps);
    });
    return () => stepSubscription.current?.remove();
  }, [permissions.motion]);

  const requestLocation = useCallback(async () => {
    const result = await Location.requestForegroundPermissionsAsync();
    setPermission('location', result.granted ? 'granted' : 'denied');
    return result.granted;
  }, [setPermission]);

  const requestCamera = useCallback(async () => {
    const result = await ImagePicker.requestCameraPermissionsAsync();
    setPermission('camera', result.granted ? 'granted' : 'denied');
    return result.granted;
  }, [setPermission]);

  const requestNotifications = useCallback(async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('motivation', {
        name: 'Motivación 4x7',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const result = await Notifications.requestPermissionsAsync();
    setPermission('notifications', result.granted ? 'granted' : 'denied');
    if (result.granted) {
      const previousReminder = await AsyncStorage.getItem('4x7:daily-reminder');
      if (previousReminder) {
        await Notifications.cancelScheduledNotificationAsync(previousReminder).catch(() => undefined);
      }
      const reminderId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Tu racha te está esperando 🔥',
          body: 'Un entrenamiento más y completas tu meta 4x7.',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 18, minute: 30 },
      });
      await AsyncStorage.setItem('4x7:daily-reminder', reminderId);
    }
    return result.granted;
  }, [setPermission]);

  const captureEvidence = useCallback(async () => {
    const allowed = permissions.camera === 'granted' || await requestCamera();
    if (!allowed) return null;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.78,
    });
    if (result.canceled || !result.assets[0]) return null;
    const uri = result.assets[0].uri;
    setEvidenceUri(uri);
    await AsyncStorage.setItem('4x7:evidence', uri);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return uri;
  }, [permissions.camera, requestCamera]);

  const startWorkout = useCallback(async () => {
    const allowed = permissions.location === 'granted' || await requestLocation();

    setDistance(0);
    lastPoint.current = null;
    setStartedAt(Date.now());
    setIsTracking(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!allowed) {
      Alert.alert('Ubicación desactivada', 'Puedes registrar el entrenamiento, pero no podremos calcular la ruta ni la distancia.');
      return true;
    }

    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 4000,
        distanceInterval: 8,
      },
      ({ coords }) => {
        const next = { latitude: coords.latitude, longitude: coords.longitude };
        if (lastPoint.current) {
          const delta = distanceMeters(lastPoint.current, next);
          if (delta < 120) setDistance((current) => current + delta);
        }
        lastPoint.current = next;
      },
    );
    return true;
  }, [permissions.location, requestLocation]);

  const stopWorkout = useCallback(async () => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    setIsTracking(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return {
    permissions,
    steps,
    isTracking,
    startedAt,
    distance,
    evidenceUri,
    loadSteps,
    requestLocation,
    requestCamera,
    requestNotifications,
    captureEvidence,
    startWorkout,
    stopWorkout,
  };
}
