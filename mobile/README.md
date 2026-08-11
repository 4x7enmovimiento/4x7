# 4x7 Mobile

Aplicación móvil nativa de fitness familiar construida con Expo y React Native para iOS y Android.

## Lo que ya funciona

- Registro e inicio de sesión con sesiones seguras.
- Creación de familia o acceso mediante código privado de invitación.
- Panel semanal con la meta de 4 entrenamientos de 7 días.
- Lectura del podómetro del teléfono y conteo de pasos.
- Registro de entrenamientos con duración, distancia GPS y calorías estimadas.
- Cámara para publicar evidencia en el Muro del Sudor.
- Recordatorio local diario configurable desde la aplicación.
- Pantallas de progreso, liga familiar, retos, rachas y ranking.
- Permisos nativos preparados para movimiento, cámara, ubicación y notificaciones.
- Sincronización con el backend 4x7 para guardar entrenamientos y evidencias.

## Ejecutar en un teléfono

```bash
npm install
npm start
```

Después, escanea el código QR con Expo Go. La cámara, el podómetro, la ubicación en primer plano y las notificaciones locales pueden probarse directamente en un dispositivo físico.

La aplicación usa por defecto el backend publicado de 4x7. Para trabajar contra otra instalación se puede definir `EXPO_PUBLIC_API_URL` antes de iniciar Expo.

## Compilación nativa

Para usar ubicación en segundo plano, notificaciones push y conectar completamente Apple HealthKit o Android Health Connect se requiere un *development build* o una compilación de tienda, no Expo Go.

```bash
npx expo run:ios
npx expo run:android
```

Los identificadores nativos de ambas plataformas son `com.familia4x7.app`. Antes de distribuir la aplicación se deberán configurar las cuentas de Apple Developer y Google Play Console, certificados de firma, política de privacidad y credenciales de servicios externos.

## Validación

```bash
npm run typecheck
npm run export:ios
npm run export:android
```

## Siguiente etapa

La base actual usa el podómetro del dispositivo. La sincronización histórica y escritura de entrenamientos en HealthKit y Health Connect debe añadirse en el desarrollo nativo. El backend ya cubre cuentas, familias, sesiones, entrenamientos y fotografías; la siguiente ampliación incorporará publicaciones, comentarios, retos y puntuación dinámica.
