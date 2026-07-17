import { createHash } from "node:crypto";
import type {
  VoiceEvidence,
  VoiceEvidenceStatus
} from "../shared/types.js";

type WavFormat = {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  blockAlign: number;
  dataOffset: number;
  dataLength: number;
};

export function analyzeAudioEvidence(buffer: Buffer): VoiceEvidence {
  const audioSha256 = createHash("sha256").update(buffer).digest("hex");
  const analyzedAt = new Date().toISOString();

  try {
    const format = parseWavFormat(buffer);
    const samples = decodeWavSamples(buffer, format);
    const frames = Math.floor(samples.length / format.channels);
    const durationSeconds = frames / format.sampleRate;
    const metrics = measureSamples(samples);
    const assessment = assessEvidence({
      durationSeconds,
      sampleRateHz: format.sampleRate,
      channels: format.channels,
      ...metrics
    });

    return {
      schemaVersion: "0.1.0",
      status: assessment.status,
      qualityScore: assessment.qualityScore,
      format: wavFormatName(format.audioFormat, format.bitsPerSample),
      sampleRateHz: format.sampleRate,
      channels: format.channels,
      durationSeconds: round(durationSeconds, 3),
      rmsDbfs: round(metrics.rmsDbfs, 2),
      peakDbfs: round(metrics.peakDbfs, 2),
      clippingRatio: round(metrics.clippingRatio, 6),
      silenceRatio: round(metrics.silenceRatio, 4),
      audioSha256,
      issues: assessment.issues,
      analyzedAt
    };
  } catch (error) {
    return {
      schemaVersion: "0.1.0",
      status: "quarantine",
      qualityScore: 0,
      format: "unrecognized",
      audioSha256,
      issues: [
        `Audio evidence could not be measured: ${
          error instanceof Error ? error.message : "unknown format"
        }`
      ],
      analyzedAt
    };
  }
}

function parseWavFormat(buffer: Buffer): WavFormat {
  if (
    buffer.length < 44 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("expected a RIFF/WAVE file");
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let blockAlign = 0;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkLength = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkStart + chunkLength > buffer.length) {
      throw new Error(`truncated ${chunkId || "unknown"} chunk`);
    }

    if (chunkId === "fmt ") {
      if (chunkLength < 16) throw new Error("invalid fmt chunk");
      audioFormat = buffer.readUInt16LE(chunkStart);
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      blockAlign = buffer.readUInt16LE(chunkStart + 12);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataOffset = chunkStart;
      dataLength = chunkLength;
      break;
    }

    offset = chunkStart + chunkLength + (chunkLength % 2);
  }

  if (!audioFormat || !channels || !sampleRate || !bitsPerSample || !dataLength) {
    throw new Error("missing WAV format or sample data");
  }
  if (![1, 3].includes(audioFormat)) {
    throw new Error(`unsupported WAV encoding ${audioFormat}`);
  }
  if (channels > 8) throw new Error(`unsupported channel count ${channels}`);

  return {
    audioFormat,
    channels,
    sampleRate,
    bitsPerSample,
    blockAlign,
    dataOffset,
    dataLength
  };
}

function decodeWavSamples(buffer: Buffer, format: WavFormat): Float64Array {
  const bytesPerSample = format.bitsPerSample / 8;
  if (!Number.isInteger(bytesPerSample) || bytesPerSample < 1) {
    throw new Error(`unsupported ${format.bitsPerSample}-bit samples`);
  }
  if (format.blockAlign !== bytesPerSample * format.channels) {
    throw new Error("compressed or padded WAV is not supported");
  }

  const sampleCount = Math.floor(format.dataLength / bytesPerSample);
  const samples = new Float64Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    const offset = format.dataOffset + index * bytesPerSample;
    samples[index] = readSample(buffer, offset, format);
  }
  return samples;
}

function readSample(buffer: Buffer, offset: number, format: WavFormat): number {
  if (format.audioFormat === 3) {
    if (format.bitsPerSample === 32) return clamp(buffer.readFloatLE(offset));
    if (format.bitsPerSample === 64) return clamp(buffer.readDoubleLE(offset));
    throw new Error(`unsupported float width ${format.bitsPerSample}`);
  }

  switch (format.bitsPerSample) {
    case 8:
      return (buffer.readUInt8(offset) - 128) / 128;
    case 16:
      return buffer.readInt16LE(offset) / 32768;
    case 24: {
      const value =
        buffer[offset] |
        (buffer[offset + 1] << 8) |
        (buffer[offset + 2] << 16);
      const signed = value & 0x800000 ? value | ~0xffffff : value;
      return signed / 8388608;
    }
    case 32:
      return buffer.readInt32LE(offset) / 2147483648;
    default:
      throw new Error(`unsupported PCM width ${format.bitsPerSample}`);
  }
}

function measureSamples(samples: Float64Array) {
  if (!samples.length) throw new Error("WAV contains no samples");

  let sumSquares = 0;
  let peak = 0;
  let clipped = 0;
  let silent = 0;
  const silenceThreshold = dbToAmplitude(-50);

  for (const sample of samples) {
    const amplitude = Math.abs(sample);
    sumSquares += sample * sample;
    peak = Math.max(peak, amplitude);
    if (amplitude >= 0.995) clipped += 1;
    if (amplitude <= silenceThreshold) silent += 1;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  return {
    rmsDbfs: amplitudeToDb(rms),
    peakDbfs: amplitudeToDb(peak),
    clippingRatio: clipped / samples.length,
    silenceRatio: silent / samples.length
  };
}

function assessEvidence(input: {
  durationSeconds: number;
  sampleRateHz: number;
  channels: number;
  rmsDbfs: number;
  peakDbfs: number;
  clippingRatio: number;
  silenceRatio: number;
}): {
  status: VoiceEvidenceStatus;
  qualityScore: number;
  issues: string[];
} {
  const reviewIssues: string[] = [];
  const quarantineIssues: string[] = [];
  let score = 100;

  if (input.durationSeconds < 1) {
    quarantineIssues.push("Audio is shorter than one second.");
    score -= 70;
  } else if (input.durationSeconds < 3) {
    reviewIssues.push("Audio is very short; review the transcript carefully.");
    score -= 15;
  }
  if (input.sampleRateHz < 16_000) {
    reviewIssues.push("Sample rate is below the 16 kHz speech baseline.");
    score -= 12;
  }
  if (input.rmsDbfs < -48 || input.silenceRatio > 0.9) {
    quarantineIssues.push("Audio is mostly silent or too quiet for reliable policy capture.");
    score -= 55;
  } else {
    if (input.rmsDbfs < -34) {
      reviewIssues.push("Speech level is low and may hide policy qualifiers.");
      score -= 18;
    }
    if (input.silenceRatio > 0.62) {
      reviewIssues.push("A high share of the recording is near-silent.");
      score -= 12;
    }
  }
  if (input.clippingRatio > 0.04) {
    quarantineIssues.push("Severe clipping can corrupt names, numbers, or negation.");
    score -= 50;
  } else if (input.clippingRatio > 0.005 || input.peakDbfs > -0.05) {
    reviewIssues.push("Clipping was detected in the speech signal.");
    score -= 20;
  }
  if (input.channels > 2) {
    reviewIssues.push("Multi-channel input was received; channel mixing should be reviewed.");
    score -= 8;
  }

  return {
    status: quarantineIssues.length
      ? "quarantine"
      : reviewIssues.length
        ? "review"
        : "pass",
    qualityScore: Math.max(0, Math.min(100, Math.round(score))),
    issues: [...quarantineIssues, ...reviewIssues]
  };
}

function wavFormatName(audioFormat: number, bitsPerSample: number): string {
  return `${audioFormat === 3 ? "IEEE float" : "PCM"} ${bitsPerSample}-bit WAV`;
}

function amplitudeToDb(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -120;
}

function dbToAmplitude(value: number): number {
  return 10 ** (value / 20);
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
