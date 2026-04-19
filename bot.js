const TelegramBot = require('node-telegram-bot-api');

// 🔑 IMPORTANTE: luego esto lo pasas a variable de entorno en Render
const token = process.env.TOKEN || 'TU_TOKEN_AQUI';

const bot = new TelegramBot(token, { polling: true });

// 📦 Base de datos simple en memoria (luego se mejora con DB real)
let numerosReservados = {};

// 🎮 /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        "🎱 Bienvenido al Bingo\n\nUsa /numeros para elegir tu número del 1 al 15"
    );
});

// 🎱 Mostrar números en forma vertical con botones
bot.onText(/\/numeros/, (msg) => {
    const chatId = msg.chat.id;

    let keyboard = [];

    for (let i = 1; i <= 15; i++) {
        let estado = numerosReservados[i] ? "🔴" : "🟢";

        keyboard.push([{
            text: `${estado} ${i}`,
            callback_data: `num_${i}`
        }]);
    }

    bot.sendMessage(chatId, "🎱 Elige tu número:", {
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
});

// 🎯 Cuando presionan un número
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const user = query.from.username || query.from.first_name;
    const data = query.data;

    if (!data.startsWith("num_")) return;

    const num = data.split("_")[1];

    // ❌ Si ya está reservado
    if (numerosReservados[num]) {
        bot.answerCallbackQuery(query.id, {
            text: `❌ El número ${num} ya está ocupado`
        });
        return;
    }

    // ✔ Reservar número
    numerosReservados[num] = {
        user: user,
        status: "reservado"
    };

    bot.answerCallbackQuery(query.id, {
        text: `✔ Número ${num} reservado`
    });

    bot.sendMessage(
        chatId,
        `🎟 @${user} reservó el número ${num}`
    );
});

// 🔄 Reset (opcional admin)
bot.onText(/\/reset/, (msg) => {
    numerosReservados = {};
    bot.sendMessage(msg.chat.id, "🔄 Bingo reiniciado");
});
