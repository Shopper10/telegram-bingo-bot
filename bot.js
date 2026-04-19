const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 📦 memoria
let numeros = {};

// =========================
// 🎮 START
// =========================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /bingo para ver los números");
});

// =========================
// 👤 OBTENER USUARIO
// =========================
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// =========================
// 🎱 GENERAR TABLERO
// =========================
function generarTablero() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        let texto = `🟢 ${i}`;

        if (numeros[i]) {
            let u = numeros[i].user;

            if (numeros[i].estado === "reservado") {
                texto = `🟡 ${i} ${u}`;
            }

            if (numeros[i].estado === "pagado") {
                texto = `🔴 ${i} ${u}`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// =========================
// 🎱 MOSTRAR TABLERO
// =========================
bot.onText(/\/bingo/, (msg) => {

    bot.sendMessage(msg.chat.id, "🎱 TABLERO BINGO:", {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });
});

// =========================
// 🎯 CLICK EN NÚMERO
// =========================
bot.on('callback_query', (query) => {

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    const num = parseInt(query.data.split("_")[1]);
    const user = getUser(query.from);

    // ❌ ocupado
    if (numeros[num]) {
        bot.answerCallbackQuery(query.id, {
            text: "❌ Ya ocupado"
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

    // 🔄 ACTUALIZAR TABLERO EN VIVO (MISMO MENSAJE)
    bot.editMessageReplyMarkup(
        {
            inline_keyboard: generarTablero()
        },
        {
            chat_id: chatId,
            message_id: messageId
        }
    ).catch(() => {});

    bot.sendMessage(chatId, `🟡 ${user} reservó el número ${num}`);
});

// =========================
// 💰 MARCAR PAGO (ADMIN)
// =========================
bot.onText(/\/pagar (\d+)/, (msg, match) => {

    const num = parseInt(match[1]);

    if (!numeros[num]) {
        bot.sendMessage(msg.chat.id, "❌ Número no existe");
        return;
    }

    numeros[num].estado = "pagado";

    bot.sendMessage(msg.chat.id,
        `🔴 Número ${num} PAGADO por ${numeros[num].user}`
    );

    // 🔄 actualizar tablero en vivo
    bot.sendMessage(msg.chat.id, "🎱 TABLERO ACTUALIZADO:", {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });
});

// =========================
// 🔄 RESET
// =========================
bot.onText(/\/reset/, (msg) => {
    numeros = {};
    bot.sendMessage(msg.chat.id, "🔄 Bingo reiniciado");
});