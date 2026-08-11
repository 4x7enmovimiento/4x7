import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (payload: { name: string; email: string; password: string; familyName?: string; inviteCode?: string }) => Promise<void>;
};

export function AuthScreen({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [familyMode, setFamilyMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [family, setFamily] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await onLogin(email, password);
      else await onRegister({
        name,
        email,
        password,
        ...(familyMode === 'create' ? { familyName: family } : { inviteCode: family.toUpperCase() }),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos continuar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}><Text style={styles.brandFour}>4</Text><Text style={styles.brandX}>×</Text><Text style={styles.brandSeven}>7</Text></View>
        <Text style={styles.eyebrow}>FITNESS EN FAMILIA</Text>
        <Text style={styles.title}>{mode === 'login' ? 'Qué bueno verte' : 'Empiecen juntos'}</Text>
        <Text style={styles.subtitle}>{mode === 'login' ? 'Entra y continúa tu racha.' : 'Crea tu cuenta y una liga privada para tu familia.'}</Text>

        <View style={styles.switcher}>
          <Pressable style={[styles.switch, mode === 'register' && styles.switchOn]} onPress={() => setMode('register')}><Text style={[styles.switchText, mode === 'register' && styles.switchTextOn]}>Crear cuenta</Text></Pressable>
          <Pressable style={[styles.switch, mode === 'login' && styles.switchOn]} onPress={() => setMode('login')}><Text style={[styles.switchText, mode === 'login' && styles.switchTextOn]}>Ya tengo cuenta</Text></Pressable>
        </View>

        {mode === 'register' && <Field icon="person-outline" placeholder="Tu nombre" value={name} onChangeText={setName} />}
        <Field icon="mail-outline" placeholder="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field icon="lock-closed-outline" placeholder="Contraseña (mínimo 8 caracteres)" value={password} onChangeText={setPassword} secureTextEntry />

        {mode === 'register' && (
          <>
            <Text style={styles.familyLabel}>TU FAMILIA</Text>
            <View style={styles.familySwitch}>
              <Pressable onPress={() => setFamilyMode('create')} style={[styles.familyOption, familyMode === 'create' && styles.familyOptionOn]}><Text style={[styles.familyText, familyMode === 'create' && styles.familyTextOn]}>Crear una</Text></Pressable>
              <Pressable onPress={() => setFamilyMode('join')} style={[styles.familyOption, familyMode === 'join' && styles.familyOptionOn]}><Text style={[styles.familyText, familyMode === 'join' && styles.familyTextOn]}>Tengo código</Text></Pressable>
            </View>
            <Field icon={familyMode === 'create' ? 'people-outline' : 'key-outline'} placeholder={familyMode === 'create' ? 'Nombre de la familia' : 'Código de invitación'} value={family} onChangeText={setFamily} autoCapitalize={familyMode === 'join' ? 'characters' : 'sentences'} />
          </>
        )}

        {!!error && <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color="#A84238" /><Text style={styles.errorText}>{error}</Text></View>}
        <Pressable style={[styles.button, busy && styles.buttonBusy]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="white" /> : <><Text style={styles.buttonText}>{mode === 'login' ? 'Entrar a 4x7' : 'Crear mi familia'}</Text><Ionicons name="arrow-forward" size={19} color="white" /></>}
        </Pressable>
        <Text style={styles.privacy}>Tus datos de salud son privados y solo se comparten con tu familia cuando tú lo decides.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { icon: keyof typeof Ionicons.glyphMap };
function Field({ icon, ...props }: FieldProps) {
  return <View style={styles.field}><Ionicons name={icon} size={20} color="#567064" /><TextInput {...props} style={styles.input} placeholderTextColor="#9AA7A0" /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F4' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 72 : 48, paddingBottom: 32 },
  brand: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 18 },
  brandFour: { color: '#185A40', fontSize: 42, fontWeight: '900', letterSpacing: -3 },
  brandX: { color: '#6FDEA0', fontSize: 29, fontWeight: '900', marginHorizontal: 2 },
  brandSeven: { color: '#185A40', fontSize: 42, fontWeight: '900', letterSpacing: -3 },
  eyebrow: { color: '#6B7D73', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#17231F', fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1.4, marginTop: 7 },
  subtitle: { color: '#748078', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24, maxWidth: 330 },
  switcher: { flexDirection: 'row', backgroundColor: '#E8EDE9', borderRadius: 15, padding: 4, marginBottom: 18 },
  switch: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  switchOn: { backgroundColor: 'white' },
  switchText: { color: '#7C8981', fontSize: 12, fontWeight: '800' },
  switchTextOn: { color: '#185A40' },
  field: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: 'white', borderWidth: 1, borderColor: '#E0E7E2', borderRadius: 16, paddingHorizontal: 15, marginBottom: 11 },
  input: { flex: 1, color: '#17231F', fontSize: 14, height: '100%' },
  familyLabel: { color: '#829088', fontSize: 9, fontWeight: '900', letterSpacing: 1.25, marginTop: 8, marginBottom: 9 },
  familySwitch: { flexDirection: 'row', gap: 8, marginBottom: 11 },
  familyOption: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDE5E0' },
  familyOptionOn: { backgroundColor: '#E8F7EE', borderColor: '#78BF94' },
  familyText: { color: '#7D8982', fontSize: 11, fontWeight: '800' },
  familyTextOn: { color: '#185A40' },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FFF0ED', borderRadius: 12, padding: 11, marginTop: 2 },
  errorText: { flex: 1, color: '#913E36', fontSize: 11, lineHeight: 16 },
  button: { height: 58, borderRadius: 18, backgroundColor: '#185A40', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  buttonBusy: { opacity: 0.72 },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '900' },
  privacy: { color: '#8B9790', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 17, paddingHorizontal: 20 },
});
