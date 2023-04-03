import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { dbConnect } from './mongo.js';
import { createNewVisa, getUserVisas, removeVisas } from './visasProcessing.js';

dotenv.config();
dbConnect();

// токен бота, полученный от BotFather
const TOKEN = process.env.TELEGRAM_TOKEN;

// let chatId = '';
// let endDate = ''
// создаем бота
const bot = new TelegramBot(TOKEN, { polling: true });
const menu = {
  reply_markup: {
    keyboard: [
      [
        { text: 'Добавить новый ВНЖ' },
        { text: 'Показать мои ВНЖ' },
      ],
      [
        { text: 'Удалить мои ВНЖ' },
        { text: 'Рассчитать даты' },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};
const usersStatistics = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot
    .sendMessage(chatId, `Я помогу Вам рассчитать разрешенную дату подачи 
    заявлений на ПМЖ и гражданство Финляндии на основании имеющегося у Вас стажа по ВНЖ.
    Если ваши ВНЖ пересекались по датам (например, получили новый ВНЖ с датой начала, 
    которая входит в период действия предыдущего), то вводите дату следующего так, 
    как будто предыдущий закончился в день начала следующего. Итак, приступим.`, menu)
    .then(async () => {
      const visaDoc = await getUserVisas(chatId);

      if (visaDoc) {
        const visas = visaDoc.visas;
        if (visas.length > 0) {
          let message = 'Ваши добавленные ранее ВНЖ:\n';
          visas.forEach((visa, index) => {
            message += `ВНЖ #${index + 1}\n`;
            message += `Тип: ${visa.visaType}\n`;
            message += `Дата начала: ${visa.startDate}\n`;
            message += `Дата окончания: ${visa.endDate}\n\n`;
          });
          bot.sendMessage(chatId, message);
        } else {
          bot.sendMessage(chatId, `***************************\nУ вас еще нет добавленных ВНЖ для расчета. 
          Вы можете добавить новый ВНЖ по кнопке "Добавить" в меню Бота`);
        }
      } else {
        bot.sendMessage(chatId, `***************************\nУ вас еще нет добавленных ВНЖ для расчета. 
        Вы можете добавить новый ВНЖ по кнопке "Добавить" в меню Бота`);
      }
    })
    .catch((err) => 
    {
      console.log(err);
    });
});

bot.onText(/Добавить новый ВНЖ/, (msg) => {
  const chatId = msg.chat.id
  // Запускаем процесс сбора информации о визах
  bot.sendMessage(chatId, 'Введите дату начала действия ВНЖ в формате ДД.ММ.ГГГГ (например, 01.01.2021):');
  if (!usersStatistics[chatId]) {
    usersStatistics[chatId] = [];
  }
  let userVisaData = usersStatistics[chatId];
  userVisaData.push({});
  // Объект, в котором будут храниться данные о ВНЖ пользователя
  // let userVisaData = []

  // Функция для обработки входящих сообщений от пользователя
  const visaHandler = (msg) => {
    const currentVisaData = userVisaData[userVisaData.length - 1] || {};
    // Если пользователь ответил на вопрос о дате начала ВНЖ
    if (msg.text.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      if (!currentVisaData.startDate) {
        currentVisaData.startDate = msg.text;

        bot.sendMessage(chatId, 'Введите дату окончания действия ВНЖ в формате ДД.ММ.ГГГГ (например, 01.01.2021):');
      } else if (!currentVisaData.endDate) {
        currentVisaData.endDate = msg.text;

        // Показываем пользователю кнопки для выбора типа ВНЖ
        bot.sendMessage(chatId, 'Укажите тип вашего ВНЖ:', {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Тип А',
                  callback_data: 'visaType_A',
                },
                {
                  text: 'Тип Б',
                  callback_data: 'visaType_B',
                },
              ],
            ],
          },
        });
      }
    }
  };

  // Обработчик нажатий на кнопки
  bot.on('callback_query', async (query) => {
    const chatId = query.from.chat.id;

    const currentVisaData = userVisaData[userVisaData.length - 1] || {};
    currentVisaData.first_name = query.from.first_name
    currentVisaData.username = query.from.username

    if (query.data === 'visaType_A' || query.data === 'visaType_B') {
      currentVisaData.visaType = query.data.split('_')[1];

      await createNewVisa({ chatId, ...currentVisaData });

      // Отправляем пользователю статистику о ВНЖ
      bot
        .sendMessage(
          chatId,
          `Дата начала: ${currentVisaData.startDate}\nДата окончания: ${currentVisaData.endDate}\nТип ВНЖ: ${currentVisaData.visaType}`
        )
        .then(() => {
          // Спрашиваем пользователя, есть ли еще ВНЖ
          bot.sendMessage(chatId, 'Добавить еще один ВНЖ?', {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Да',
                    callback_data: 'moreVisa_yes',
                  },
                  {
                    text: 'Нет',
                    callback_data: 'moreVisa_no',
                  },
                ],
              ],
            },
          });
        })
        .catch((err) => {
          console.log(err);
        });
    } else if (query.data === 'moreVisa_yes') {
      // Добавляем новый объект для нового ВНЖ
      userVisaData.push({});
      bot.sendMessage(
        chatId,
        'Введите дату начала действия нового ВНЖ в формате ДД.ММ.ГГГГ (например, 01.01.2021):'
      );
    } else if (query.data === 'moreVisa_no') {
      // Если больше нет ВНЖ, то показываем статистику по всем ВНЖ

      bot.sendMessage(chatId, `ВНЖ сохранены. Можете посмотреть Ваши ВНЖ 
      и рассчитать даты по кнопкам в меню Бота`);
    }
  });

  bot.on('message', visaHandler);
});

bot.onText(/Показать мои ВНЖ/, (msg) => {
  const chatId = msg.chat.id;
  bot
    .sendMessage(chatId, '***************************')
    .then(async () => {
      const visaDoc = await getUserVisas(chatId);
      const userVisaData = visaDoc.visas;
      let statistics = '';

      for (let i = 0; i < userVisaData.length; i++) {
        const visa = userVisaData[i];
        statistics += `Дата начала: ${visa.startDate}\nДата окончания: ${visa.endDate}\nТип ВНЖ: ${visa.visaType}\n\n`;
      }

      bot.sendMessage(chatId, `Статистика ВНЖ:\n\n${statistics}`);
    })
    .catch((err) => {
      console.log(err);
    });
});

bot.onText(/Удалить мои ВНЖ/, (msg) => {
  const chatId = msg.chat.id;
  bot
    .sendMessage(chatId, 'Удаляю введенные ВНЖ...')
    .then(async () => {
      await removeVisas(chatId);
    })
    .catch((err) => {
      console.log(err);
    });
});

bot.onText(/Рассчитать даты/, (msg) => {
  const chatId = msg.chat.id;
  bot
    .sendMessage(chatId, '***************************')
    .then(async () => {
      const visaDoc = await getUserVisas(chatId);
      const userVisaData = visaDoc.visas;
      let typeADays = 0;
      let typeBDays = 0;

      for (let i = 0; i < userVisaData.length; i++) {
        const visa = userVisaData[i];
        const endDate = parseDate(visa.endDate);

        if (endDate <= Date.now()) {
          if (visa.visaType === 'A') {
            typeADays += countDays(parseDate(visa.startDate), endDate);
          } else if (visa.visaType === 'B') {
            typeBDays += countDays(parseDate(visa.startDate), endDate) / 2;
          }
        } else {
          const today = new Date();
          if (visa.visaType === 'A') {
            typeADays += countDays(parseDate(visa.startDate), today);
          } else if (visa.visaType === 'B') {
            typeBDays += countDays(parseDate(visa.startDate), today) / 2;
          }
          break;
        }
      }

      // Вычисляем дату, когда накопится 4 года стажа
      const requiredDays = 4 * 365;
      const remainingDays = requiredDays - typeADays - typeBDays;
      let today = new Date();
      const milliseconds = today.setDate(today.getDate() + remainingDays);
      const date = new Date(milliseconds);
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.getMonth().toString().padStart(2, '0');
      const year = date.getFullYear().toString();
      const yearForPassport = (date.getFullYear() + 1).toString();
      const formattedDate = `${day}.${month}.${year}`;
      const formattedDateForPassport = `${day}.${month}.${yearForPassport}`;

      // Выводим результат
      bot.sendMessage(
        chatId,
        `Дата, когда можно подавать на ПМЖ: ${formattedDate}\n\nДата, когда можно подавать на гражданство: ${formattedDateForPassport}`
      );
    })
    .catch((err) => {
      console.log(err);
    });
});

// Функция для перевода даты из строки формата 'dd.mm.yyyy' в объект Date
function parseDate(str) {
  const parts = str.split('.');
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

// Функция для подсчета количества дней между двумя датами
function countDays(start, end) {
  const DAY_IN_MS = 24 * 60 * 60 * 1000; // количество миллисекунд в одном дне
  return Math.round(Math.abs((start - end) / DAY_IN_MS));
}
