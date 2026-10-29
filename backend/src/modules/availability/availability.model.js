import mongoose from 'mongoose';
const interval = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false, strict: 'throw' },
);
const absence = new mongoose.Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  { _id: false, strict: 'throw' },
);
const schema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    timezone: {
      type: String,
      enum: ['Africa/Banjul'],
      default: 'Africa/Banjul',
    },
    weekly: [interval],
    blockedDates: [String],
    timeOff: [absence],
  },
  { timestamps: true, strict: 'throw' },
);
export const Availability = mongoose.model('Availability', schema);
// All scheduling mutations contend on this row, including first-time bookings.
export const WorkerScheduleLock = mongoose.model(
  'WorkerScheduleLock',
  new mongoose.Schema(
    {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      revision: { type: Number, default: 0 },
    },
    { versionKey: false },
  ),
);
