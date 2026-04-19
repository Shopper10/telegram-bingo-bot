const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 📦 Estado global
let numerosReservados = {};

// 🎮 /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /numeros");
});

// 🔄 Generar teclado dinámico
function generarTeclado() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {
        let estado = numerosReservados[i] ? "🔴" : "🟢";

        keyboard.push([{
            text: `${estado} ${i}`,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// 🎱 Mostrar números
bot.onText(/\/numeros/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Elige tu número:", {
        reply_markup: {
            inline_keyboard: generarTeclado()
        }
    });
});

// 🎯 Click en número
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    const user = query.from.username
        ? `@${query.from.username}`
        : query.from.first_name;

    const num = query.data.split("_")[1];

    // ❌ Ya ocupado
    if (numerosReservados[num]) {
        bot.answerCallbackQuery(query.id, {
            text: "❌ Ya está ocupado"
        });
        return;
    }

    // ✔ Reservar
    numerosReservados[num] = {
        user: user
    };

    bot.answerCallbackQuery(query.id, {
        text: `✔ Tomaste el ${num}`
    });

    // 🔄 ACTUALIZAR BOTONES EN VIVO
    bot.editMessageReplyMarkup(
        {
            inline_keyboard: generarTeclado()
        },
        {
            chat_id: chatId,
            message_id: messageId
        }
    );

    // 📢 Aviso en grupo
    bot.sendMessage(chatId, `🎟 ${user} tomó el número ${num}`);
});

// 🔄 Reset
bot.onText(/\/reset/, (msg) => {
    numerosReservados = {};
    bot.sendMessage(msg.chat.id, "🔄 Reiniciado");
});