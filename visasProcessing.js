import Visa from './Visa.js';

export async function getUserVisas(chatId) {
  try {
    const visa = await Visa.findOne({ chatId });

    return visa || null;
  } catch (error) {
    console.error('Error: ' + error.message);
  }
}

export async function createNewVisa(data) {
  try {
    const visa = await getUserVisas(data.chatId);

    if (visa) {
      visa.visas.push({
        startDate: data.startDate,
        endDate: data.endDate,
        visaType: data.visaType,
      });

      await visa.save();
    } else {
      const newVisa = Visa({
        chatId: data.chatId,
        first_name: data.first_name,
        username: data.username,
        visas: [
          {
            startDate: data.startDate,
            endDate: data.endDate,
            visaType: data.visaType,
          },
        ],
      });

      await newVisa.save()
    }
  } catch (error) {
    console.error('Error: ' + error.message);
  }
}