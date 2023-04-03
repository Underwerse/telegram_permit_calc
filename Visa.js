import mongoose from 'mongoose';

const VisaSchema = new mongoose.Schema(
  {
    chatId: {
      type: String,
      required: true,
    },
    first_name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    visas: {
      type: [
        {
          startDate: {
            type: String,
          },
          endDate: {
            type: String,
          },
          visaType: {
            type: String,
          },
          _id: false,
        },
      ],
      default: [],
    },
    created: {
      type: String,
      default: () =>
        new Date().toISOString().slice(0, 19).replace('T', ' ') + '.000',
    },
    modified: {
      type: String,
      default: () =>
        new Date().toISOString().slice(0, 19).replace('T', ' ') + '.000',
    },
  },
  { versionKey: false }
);

VisaSchema.pre('save', function (next) {
  this.modified =
    new Date().toISOString().slice(0, 19).replace('T', ' ') + '.000'
  next()
})

export default mongoose.model('Visa', VisaSchema);
