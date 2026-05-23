'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useVoiceAssistant,
  BarVisualizer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function VoiceCallPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const callId = params.id;
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string>('');
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getLiveKitToken(callId, `caller-${Math.random().toString(36).slice(2, 8)}`)
      .then((data) => {
        if (cancelled) return;
        setToken(data.token);
        setUrl(data.url);
      })
      .catch((err) => console.error('Token fetch failed', err));
    return () => {
      cancelled = true;
    };
  }, [callId]);

  const endCall = async () => {
    setEnding(true);
    try {
      await api.endCall(callId);
    } finally {
      router.push(`/calls/${callId}`);
    }
  };

  if (!token || !url) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-neutral-500">Connecting…</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect
      audio
      video={false}
      onDisconnected={() => router.push(`/calls/${callId}`)}
      className="min-h-screen flex flex-col"
    >
      <header className="border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-mono text-sm font-semibold hover:underline">
            callflow
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="font-mono text-xs text-neutral-600">{callId.slice(0, 8)}</span>
        </div>
        <button
          onClick={endCall}
          disabled={ending}
          className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
        >
          {ending ? 'Ending…' : 'End call'}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <AgentVisualizer />
      </main>

      <RoomAudioRenderer />
      <StartAudio label="Tap to allow microphone access" />
    </LiveKitRoom>
  );
}

function AgentVisualizer() {
  const { state, audioTrack } = useVoiceAssistant();

  return (
    <div className="flex flex-col items-center gap-3">
      <BarVisualizer
        state={state}
        trackRef={audioTrack}
        barCount={5}
        style={{ width: '240px', height: '120px' }}
      />
      <p className="font-mono text-xs text-neutral-500 lowercase">{state}</p>
    </div>
  );
}
