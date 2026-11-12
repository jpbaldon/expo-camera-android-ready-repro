import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Short enough that a recording started before the first frame can fail with ERROR_NO_VALID_DATA. */
const STOP_AFTER_MS = 300;

const STEPS = [
  { id: 'mount-back-video', facing: 'back', mode: 'video', action: 'record' },
  { id: 'front-video', facing: 'front', mode: 'video', action: 'record' },
  { id: 'back-video-again', facing: 'back', mode: 'video', action: 'record' },
  { id: 'picture-rebind', facing: 'back', mode: 'picture', action: 'skip' },
  { id: 'video-after-picture', facing: 'back', mode: 'video', action: 'record' },
];

export default function App() {
  const cameraRef = useRef(null);
  const stepRef = useRef(0);
  const busyRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [running, setRunning] = useState(false);
  const [facing, setFacing] = useState('back');
  const [mode, setMode] = useState('video');
  const [logs, setLogs] = useState([]);

  const log = (message, extra) => {
    const line = extra === undefined ? message : `${message} ${JSON.stringify(extra)}`;
    const stamped = `${new Date().toISOString()} ${line}`;
    console.log(stamped);
    setLogs((prev) => [...prev, stamped]);
  };

  const applyStep = (index) => {
    const step = STEPS[index];
    if (!step) {
      setRunning(false);
      log('sequence complete');
      return;
    }
    stepRef.current = index;
    setFacing(step.facing);
    setMode(step.mode);
    log(`waiting for onCameraReady (${step.id}) facing=${step.facing} mode=${step.mode}`);
  };

  const start = () => {
    setLogs([]);
    busyRef.current = false;
    setRunning(true);
    applyStep(0);
  };

  const onCameraReady = async () => {
    const index = stepRef.current;
    const step = STEPS[index];
    if (!running || !step || busyRef.current) {
      return;
    }
    if (step.facing !== facing || step.mode !== mode) {
      log(`ignore stale onCameraReady (step=${step.id} view=${facing}/${mode})`);
      return;
    }

    log(`onCameraReady (${step.id})`);
    if (step.action === 'skip') {
      applyStep(index + 1);
      return;
    }

    busyRef.current = true;
    const startedAt = Date.now();
    log(`recordAsync immediately after onCameraReady (${step.id})`);
    const stopTimer = setTimeout(() => {
      log(`stopRecording after ${STOP_AFTER_MS}ms (${step.id})`);
      cameraRef.current?.stopRecording();
    }, STOP_AFTER_MS);

    try {
      const result = await cameraRef.current?.recordAsync();
      log(`recordAsync resolved (${step.id})`, {
        ms: Date.now() - startedAt,
        uri: result?.uri ?? null,
      });
    } catch (err) {
      log(`recordAsync FAILED (${step.id})`, {
        ms: Date.now() - startedAt,
        name: err?.name,
        message: String(err?.message ?? err),
      });
    } finally {
      clearTimeout(stopTimer);
      busyRef.current = false;
      applyStep(index + 1);
    }
  };

  const granted = cameraPermission?.granted && micPermission?.granted;

  return (
    <View style={styles.root}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Android onCameraReady repro</Text>
      <Text style={styles.subtitle}>
        Records for {STOP_AFTER_MS}ms as soon as onCameraReady fires, including after facing and
        picture↔video rebinds.
      </Text>
      {!granted ? (
        <Pressable
          style={styles.button}
          onPress={() => {
            void requestCameraPermission();
            void requestMicPermission();
          }}
        >
          <Text style={styles.buttonText}>Grant camera and microphone</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.button} onPress={start} disabled={running}>
          <Text style={styles.buttonText}>{running ? 'Running…' : 'Run sequence'}</Text>
        </Pressable>
      )}
      <View style={styles.preview}>
        {granted && running ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode={mode}
            mute={false}
            onCameraReady={() => {
              void onCameraReady();
            }}
            onMountError={(event) => {
              log('onMountError', event.message);
            }}
          />
        ) : (
          <Text style={styles.placeholder}>Camera mounts while the sequence runs</Text>
        )}
      </View>
      <ScrollView style={styles.log} contentContainerStyle={styles.logContent}>
        {logs.map((line, i) => (
          <Text key={`${i}-${line}`} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: '#333',
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  preview: {
    height: 220,
    marginTop: 12,
    backgroundColor: '#222',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#ccc',
  },
  log: {
    flex: 1,
    marginTop: 12,
    marginBottom: 16,
  },
  logContent: {
    paddingBottom: 24,
  },
  logLine: {
    fontFamily: 'monospace',
    fontSize: 11,
    marginBottom: 6,
  },
});
