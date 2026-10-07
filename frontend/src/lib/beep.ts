let sharedAudio: AudioContext | null = null;

export function beep(ok: boolean) {
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      if (!sharedAudio || sharedAudio.state === "closed") sharedAudio = new Ctx();
      const ctx = sharedAudio;
      void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = ok ? 880 : 220;
      osc.type = ok ? "sine" : "square";
      gain.gain.value = 0.08;
      osc.start();
      osc.stop(ctx.currentTime + (ok ? 0.12 : 0.25));
    }
    navigator.vibrate?.(ok ? 30 : [80, 40, 80]);
  } catch {
    // suara & getar opsional
  }
}
