const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 📦 Base de datos en memoria
let numeros = {};

// 🎮 START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /numeros para jugar");
});

// 🎱 GENERAR BOTONES (CON USUARIO + ESTADO)
function generarTeclado() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        let texto = `🟢 ${i}`;

        if (numeros[i]) {
            let user = numeros[i].user;
            let estado = numeros[i].estado;

            if (estado === "reservado") {
                texto = `🟡 ${i} ${user}`;
            }

            if (estado === "pagado") {
                texto = `🔴 ${i} ${user}`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// 🎱 MOSTRAR NÚMEROS
bot.onText(/\/numeros/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Elige tu número:", {
        reply_markup: {
            inline_keyboard: generarTeclado()
        }
    });
});

// 🎯 CLICK EN NÚMERO
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    const user = query.from.username
        ? `@${query.from.username}`
        : query.from.first_name;

    const num = parseInt(query.data.split("_")[1]);

    // ❌ YA OCUPADO
    if (numeros[num]) {
        bot.answerCallbackQuery(query.id, {
            text: "❌ No disponible"
        });
        return;
    }

    // 🟡 RESERVAR
    numeros[num] = {
        user: user,
        estado: "reservado"
    };

    bot.answerCallbackQuery(query.id, {
        text: `🟡 Reservaste ${num}`
    });

    // 🔄 ACTUALIZAR EN VIVO
    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTeclado() },
        { chat_id: chatId, message_id: messageId }
    );

    bot.sendMessage(chatId, `🟡 ${user} reservó el número ${num}`);
});

// 💰 CONFIRMAR PAGO (ADMIN)
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

    // 🔄 actualizar si quieres (opcional)
});

// 🔓 LIBERAR
bot.onText(/\/liberar (\d+)/, (msg, match) => {
    const num = parseInt(match[1]);

    if (numeros[num]) {
        delete numeros[num];
        bot.sendMessage(msg.chat.id, `🟢 Número ${num} liberado`);
    }
});

// 🔄 RESET
bot.onText(/\/reset/, (msg) => {
    numeros = {};
    bot.sendMessage(msg.chat.id, "🔄 Bingo reiniciado");
});