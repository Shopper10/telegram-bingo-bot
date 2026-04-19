const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

let numeros = {}; // {1: {user, estado}}

// 🔄 Generar teclado con estados
function generarTeclado() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {
        let estado = "🟢";

        if (numeros[i]) {
            if (numeros[i].estado === "reservado") estado = "🟡";
            if (numeros[i].estado === "pagado") estado = "🔴";
        }

        keyboard.push([{
            text: `${estado} ${i}`,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// 🎮 START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /numeros");
});

// 🎱 MOSTRAR NÚMEROS
bot.onText(/\/numeros/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Elige tu número:", {
        reply_markup: {
            inline_keyboard: generarTeclado()
        }
    });
});

// 🎯 CLICK NÚMERO
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    const user = query.from.username
        ? `@${query.from.username}`
        : query.from.first_name;

    const num = parseInt(query.data.split("_")[1]);

    // ❌ ya ocupado
    if (numeros[num]) {
        bot.answerCallbackQuery(query.id, {
            text: "❌ Número no disponible"
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

    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTeclado() },
        { chat_id: chatId, message_id: messageId }
    );

    bot.sendMessage(chatId,
        `🟡 ${user} reservó el número ${num}\n💰 Pendiente de pago`
    );
});

// 💰 CONFIRMAR PAGO (ADMIN)
bot.onText(/\/pagar (\d+)/, (msg, match) => {
    const num = parseInt(match[1]);

    if (!numeros[num]) {
        bot.sendMessage(msg.chat.id, "❌ Ese número no está reservado");
        return;
    }

    numeros[num].estado = "pagado";

    bot.sendMessage(msg.chat.id,
        `🔴 Número ${num} confirmado como PAGADO por ${numeros[num].user}`
    );
});

// 🔓 LIBERAR NÚMERO
bot.onText(/\/liberar (\d+)/, (msg, match) => {
    const num = parseInt(match[1]);

    if (!numeros[num]) {
        bot.sendMessage(msg.chat.id, "❌ Ese número no existe");
        return;
    }

    delete numeros[num];

    bot.sendMessage(msg.chat.id,
        `🟢 Número ${num} liberado nuevamente`
    );
});

// 🔄 RESET
bot.onText(/\/reset/, (msg) => {
    numeros = {};
    bot.sendMessage(msg.chat.id, "🔄 Bingo reiniciado");
});