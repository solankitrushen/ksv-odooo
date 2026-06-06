import mongoose from "mongoose";

const ocrIngestEventSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "InstaStore", index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, index: true },
    imageHash: { type: String, index: true },
    bytes: { type: Number, default: 0 },
    mimeType: { type: String },
    stage: { type: String, enum: ["parse", "commit"], required: true },
    status: { type: String, enum: ["ok", "error", "cached"], required: true },
    itemCount: { type: Number, default: 0 },
    comboCount: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    errorCode: { type: String, default: null },
    provider: { type: String, default: "googleVision" },
  },
  { timestamps: true }
);

ocrIngestEventSchema.index({ storeId: 1, createdAt: -1 });

const OcrIngestEvent =
  mongoose.models.InstaOcrIngestEvent ||
  mongoose.model("InstaOcrIngestEvent", ocrIngestEventSchema);

export default OcrIngestEvent;
