import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import type { Agent, ChatPendingTask } from "@multica/core/types";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { api } from "@/data/api";
import { cn } from "@/lib/utils";

type CallStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "ready"
  | "sending"
  | "permission_denied"
  | "failed";

interface Props {
  agent: Agent;
  pendingTask?: ChatPendingTask;
  disabled?: boolean;
  disabledReason?: string;
  onClose: () => void;
  onStop: () => void;
  ensureSession: (titleSeed: string) => Promise<string | null>;
  onSend: (content: string, attachmentIds?: string[]) => Promise<void> | void;
}

const IS_IOS = process.env.EXPO_OS === "ios";

export function VoiceCallPanel({
  agent,
  pendingTask,
  disabled = false,
  disabledReason,
  onClose,
  onStop,
  ensureSession,
  onSend,
}: Props) {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const agentWorking = !!pendingTask?.task_id;
  const hasRecording = !!recordingUri;
  const transcriptText = transcript.trim();
  const canSend =
    !disabled &&
    !agentWorking &&
    hasRecording &&
    transcriptText.length > 0 &&
    status !== "sending";

  const statusLabel = useMemo(() => {
    if (disabled && disabledReason) return disabledReason;
    if (agentWorking) return "Agent is working";
    switch (status) {
      case "requesting_permission":
        return "Connecting microphone";
      case "recording":
        return "Recording";
      case "ready":
        return "Ready to send";
      case "sending":
        return "Sending voice message";
      case "permission_denied":
        return "Microphone blocked";
      case "failed":
        return "Voice call failed";
      default:
        return "Connected";
    }
  }, [agentWorking, disabled, disabledReason, status]);

  const resetRecording = useCallback(() => {
    setRecordingUri(null);
    setTranscript("");
    setStatus("idle");
    setError(null);
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || agentWorking || status === "recording") return;
    setError(null);
    setStatus("requesting_permission");
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setStatus("permission_denied");
        setError("Enable microphone access in Settings to start a voice call.");
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingUri(null);
      setStatus("recording");
      if (IS_IOS) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Could not start recording.");
    }
  }, [agentWorking, disabled, recorder, status]);

  const stopRecording = useCallback(async () => {
    if (status !== "recording") return;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) {
        setStatus("failed");
        setError("Recording did not produce an audio file. Try again.");
        return;
      }
      setRecordingUri(uri);
      setStatus("ready");
      if (IS_IOS) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Could not stop recording.");
    }
  }, [recorder, status]);

  const sendVoice = useCallback(async () => {
    if (!canSend) return;
    const uri = recordingUri;
    if (!uri) return;
    setStatus("sending");
    setError(null);
    try {
      const content = `Voice input transcript:\n\n${transcriptText}`;
      const sessionId = await ensureSession(transcriptText);
      if (!sessionId) {
        throw new Error("No chat session is available for this agent.");
      }
      const attachment = await api.uploadFile(
        {
          uri,
          name: `voice-${Date.now()}.m4a`,
          type: "audio/mp4",
        },
        { chatSessionId: sessionId },
      );
      await onSend(content, attachment.id ? [attachment.id] : []);
      resetRecording();
    } catch (err) {
      setStatus("failed");
      const message =
        err instanceof Error ? err.message : "Voice message failed to send.";
      setError(message);
      Alert.alert("Voice message failed", message);
    }
  }, [
    canSend,
    ensureSession,
    onSend,
    recordingUri,
    resetRecording,
    transcriptText,
  ]);

  return (
    <View className="border-t border-border bg-background px-4 py-3">
      <View className="rounded-md border border-border bg-card p-4 gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xs font-medium uppercase text-muted-foreground">
              Voice call
            </Text>
            <Text className="mt-0.5 text-lg font-semibold text-foreground">
              {agent.name}
            </Text>
            <View className="mt-2 flex-row items-center gap-2">
              <View
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  status === "recording"
                    ? "bg-destructive"
                    : agentWorking
                      ? "bg-primary"
                      : status === "failed" || status === "permission_denied"
                        ? "bg-destructive"
                        : "bg-emerald-500",
                )}
              />
              <Text className="text-sm text-muted-foreground">
                {statusLabel}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-secondary"
            accessibilityRole="button"
            accessibilityLabel="End voice call"
          >
            <Ionicons name="call-outline" size={19} color="#ef4444" />
          </Pressable>
        </View>

        <View className="items-center gap-2">
          <Pressable
            onPress={status === "recording" ? stopRecording : startRecording}
            disabled={disabled || agentWorking || status === "sending"}
            className={cn(
              "h-20 w-20 items-center justify-center rounded-full",
              status === "recording"
                ? "bg-destructive"
                : "bg-primary",
              (disabled || agentWorking || status === "sending") && "opacity-50",
            )}
            accessibilityRole="button"
            accessibilityLabel={
              status === "recording" ? "Stop recording" : "Start recording"
            }
          >
            <Ionicons
              name={status === "recording" ? "stop" : "mic"}
              size={34}
              color="white"
            />
          </Pressable>
          <Text className="text-xs text-muted-foreground">
            {status === "recording"
              ? `Recording ${formatDuration(recorderState.durationMillis)}`
              : hasRecording
                ? "Recording captured"
                : "Tap to record a voice message"}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-xs font-medium text-muted-foreground">
            Transcript
          </Text>
          <TextField
            value={transcript}
            onChangeText={setTranscript}
            placeholder="Type or paste the transcript before sending"
            editable={!disabled && !agentWorking && status !== "sending"}
            multiline
            className="min-h-20 py-2"
            style={{ textAlignVertical: "top" }}
          />
          <Text className="text-xs text-muted-foreground">
            The agent receives this text prompt. Audio is attached for context.
          </Text>
        </View>

        {error ? (
          <View className="rounded-md bg-destructive/10 px-3 py-2">
            <Text className="text-xs text-destructive">{error}</Text>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onPress={agentWorking ? onStop : resetRecording}
            disabled={status === "sending"}
          >
            <Text>{agentWorking ? "Stop Agent" : "Reset"}</Text>
          </Button>
          <Button
            className="flex-1"
            onPress={sendVoice}
            disabled={!canSend}
          >
            <Text>{status === "sending" ? "Sending..." : "Send Voice"}</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}

function formatDuration(ms: number | undefined) {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
