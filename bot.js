const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 📦 Base de datos en memoria
let numeros = {};
let bloqueando = {}; // anti doble click

const TIEMPO_RESERVA = 5 * 60 * 1000;

// ==========================
// 🎮 START
// ==========================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Bingo PRO activo\nUsa /bingo para ver el tablero");
});

// ==========================
// 🎱 TABLERO 5x3
// ==========================
function generarTablero() {
    let keyboard = [];
    let fila = [];

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

        fila.push({
            text: texto,
            callback_data: `num_${i}`
        });

        // 🔥 5 columnas por fila (5x3)
        if (fila.length === 5) {
            keyboard.push(fila);
            fila = [];
        }
    }

    return keyboard;
}

// ==========================
// 🎱 MOSTRAR BINGO
// ==========================
bot.onText(/\/bingo/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 TABLERO BINGO:", {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });
});

// ==========================
// 🎯 CLICK NÚMERO
// ==========================
bot.on('callback_query', (query) => {

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    const user = query.from.username
        ? `@${query.from.username}`
        : query.from.first_name;

    const num = parseInt(query.data.split("_")[1]);

    // 🛑 ANTI DOBLE CLICK
    if (bloqueando[num]) {
        bot.answerCallbackQuery(query.id, {
            text: "⏳ Procesando..."
        });
        return;
    }

    bloqueando[num] = true;

    // ❌ ocupado
    if (numeros[num]) {
        bloqueando[num] = false;
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

    // ⏱ auto liberación
    setTimeout(() => {
        if (numeros[num] && numeros[num].estado === "reservado") {
            delete numeros[num];
            bot.sendMessage(chatId, `⏱ Número ${num} liberado por no pago`);
        }
    }, TIEMPO_RESERVA);

    bot.answerCallbackQuery(query.id, {
        text: `🟡 Reservaste ${num}`
    });

    // ⚡ actualizar tablero (animación real)
    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        {
            chat_id: chatId,
            message_id: messageId
        }
    ).catch(() => {});

    bot.sendMessage(chatId, `🟡 ${user} reservó el número ${num}`);

    bloqueando[num] = false;
});

// ==========================
// 💰 MARCAR PAGO (MANUAL)
// ==========================
bot.onText(/\/pagar (\d+)/, (msg, match) => {

    const num = parseInt(match[1]);

    if (!numeros[num]) {
        bot.sendMessage(msg.chat.id, "❌ No existe");
        return;
    }

    numeros[num].estado = "pagado";

    bot.sendMessage(msg.chat.id,
        `🔴 Número ${num} PAGADO por ${numeros[num].user}`
    );
});

// ==========================
// 🔄 RESET
// ==========================
bot.onText(/\/reset/, (msg) => {
    numeros = {};
    bot.sendMessage(msg.chat.id, "🔄 Bingo reiniciado");
});