const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 📦 memoria
let numeros = {};

// 🎮 START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /bingo para ver el tablero");
});

// 🎱 TABLERO (FORMATO QUE QUIERES)
function generarTablero() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        let texto = `🟢 ${i}`;

        if (numeros[i]) {
            let user = numeros[i].user;

            if (numeros[i].estado === "reservado") {
                texto = `🟡 ${i} ${user} (pendiente)`;
            }

            if (numeros[i].estado === "pagado") {
                texto = `🔴 ${i} ${user} (pagado)`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// 🎱 MOSTRAR TABLERO
bot.onText(/\/bingo/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 TABLERO BINGO:", {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });
});

// 🎯 CLICK EN NÚMERO
bot.on('callback_query', (query) => {

    const chatId = query.message.chat.id;

    const user = query.from.username
        ? `@${query.from.username}`
        : query.from.first_name;

    const num = parseInt(query.data.split("_")[1]);

    // ❌ ocupado
    if (numeros[num]) {
        bot.answerCallbackQuery(query.id, {
            text: "❌ No disponible"
        });
        return;
    }

    // 🟡 reservar
    numeros[num] = {
        user: user,
        estado: "reservado"
    };

    bot.answerCallbackQuery(query.id, {
        text: `🟡 Reservaste ${num}`
    });

    // ⚡ IMPORTANTE: enviamos nuevo tablero (más estable)
    bot.sendMessage(chatId, "🎱 TABLERO ACTUALIZADO:", {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    bot.sendMessage(chatId,
        `🟡 ${user} reservó el número ${num}`
    );
});

// 💰 PAGO (ADMIN)
bot.onText(/\/pagar (\d+)/, (msg, match) => {

    const num = parseInt(match[1]);

    if (!numeros[num]) {
        bot.sendMessage(msg.chat.id, "❌ No existe ese número");
        return;
    }

    numeros[num].estado = "pagado";

    bot.sendMessage(msg.chat.id,
        `🔴 Número ${num} PAGADO por ${numeros[num].user}`
    );

    // 🔄 actualizar tablero
    bot.sendMessage(msg.chat.id, "🎱 TABLERO ACTUALIZADO:", {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });
});

// 🔄 RESET
bot.onText(/\/reset/, (msg) => {
    numeros = {};
    bot.sendMessage(msg.chat.id, "🔄 Bingo reiniciado");
});