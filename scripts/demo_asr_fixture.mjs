import { readFile } from "node:fs/promises";

const inputPath = process.argv[2];
const audio = await readFile(inputPath);
const durationSeconds =
  audio.toString("ascii", 0, 4) === "RIFF" && audio.length >= 44
    ? audio.readUInt32LE(40) / audio.readUInt32LE(28)
    : 0;

console.log(
  JSON.stringify({
    transcript:
      "After each project review, read the meeting note and only include P0 and P1 findings. Never include compensation data in the external report. Draft follow-up emails for each owner, but do not send them automatically. If an owner is missing, mark the item as needs confirmation instead of guessing. Create tentative calendar holds only when a due date is present. Replace every customer name with the approved account alias before writing the report.",
    language: "fixture-en",
    audioSeconds: Math.round(durationSeconds * 1000) / 1000,
    inferenceMs: 1,
    rtf: 0.0001,
    xRealtime: 10_000
  })
);
