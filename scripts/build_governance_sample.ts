import { readFile, writeFile } from "node:fs/promises";
import type {
  ActionEvent,
  CompileResult,
  VerifyResult
} from "../shared/types.js";
import { governanceLedgerJsonl } from "../server/governance-ledger.js";
import {
  getGovernanceLedger,
  getSkillPromotionReview,
  promoteStoredSkill,
  saveVerifiedSkill
} from "../server/storage.js";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Expected input and output paths");
}

const input = JSON.parse(await readFile(inputPath, "utf8")) as {
  compilation: CompileResult;
  verification: VerifyResult;
};
const actions: ActionEvent[] =
  input.verification.proofBundle.actionContract?.events || [];
const skill = await saveVerifiedSkill({
  name: input.compilation.projectName,
  status: "verified",
  compilation: input.compilation,
  verification: input.verification,
  actions
});
const review = await getSkillPromotionReview(skill.id);
await promoteStoredSkill(skill.id, {
  reviewHash: review.reviewHash,
  acknowledgeRisk: true
});
const ledger = await getGovernanceLedger();
if (ledger.status !== "valid" || ledger.receiptCount !== 1) {
  throw new Error("Isolated governance sample did not validate");
}
await writeFile(outputPath, governanceLedgerJsonl(ledger), "utf8");
