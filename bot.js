const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ⚙️ CONFIG
const ADMIN_ID = 1448948861; // 👈 CAMBIAR
const NEQUI_NUMERO = "3123902322";
const NEQUI_NOMBRE = "Carlos";

// 📦 memoria
let numeros = {};

// =========================
// 👤 usuario helper
// =========================
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// =========================
// 🎱 TABLERO
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
// 🎮 START
// =========================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /bingo");
});

// =========================
// 🎱 MOSTRAR TABLERO
// =========================
bot.onText(/\/bingo/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 TABLERO:", {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });
});

// =========================
// 🎯 RESERVAR NÚMERO
// =========================
bot.on('callback_query', (query) => {

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    const num = parseInt(query.data.split("_")[1]);
    const user = getUser(query.from);

    if (numeros[num]) {
        bot.answerCallbackQuery(query.id, {
            text: "❌ No disponible"
        });
        return;
    }

    numeros[num] = {
        user: user,
        estado: "reservado"
    };

    bot.answerCallbackQuery(query.id, {
        text: `🟡 Reservado ${num}`
    });

    // 🔄 actualizar tablero
    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        {
            chat_id: chatId,
            message_id: messageId
        }
    ).catch(() => {});

    bot.sendMessage(chatId,
`🟡 ${user} reservaste el número ${num}

💰 Paga a Nequi:
📱 ${NEQUI_NUMERO}
👤 ${NEQUI_NOMBRE}

📸 Envía comprobante aquí`
    );
});

// =========================
// 📸 RECIBIR COMPROBANTE
// =========================
bot.on('photo', (msg) => {

    const user = getUser(msg.from);
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    let numero = null;

    for (let n in numeros) {
        if (numeros[n].user === user && numeros[n].estado === "reservado") {
            numero = n;
            break;
        }
    }

    if (!numero) {
        bot.sendMessage(msg.chat.id, "❌ No tienes número reservado");
        return;
    }

    // 📩 ENVIAR AL ADMIN CON BOTONES
    bot.sendPhoto(ADMIN_ID, fileId, {
        caption: `💰 COMPROBANTE DE PAGO\n\n👤 Usuario: ${user}\n🎱 Número: ${numero}`,
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "✅ APROBAR",
                        callback_data: `ok_${numero}`
                    },
                    {
                        text: "❌ RECHAZAR",
                        callback_data: `no_${numero}`
                    }
                ]
            ]
        }
    });

    bot.sendMessage(msg.chat.id, "⏳ Pago enviado, esperando aprobación...");
});

// =========================
// ✅ / ❌ APROBAR PAGO
// =========================
bot.on('callback_query', (query) => {

    if (!query.data.startsWith("ok_") && !query.data.startsWith("no_")) return;

    const num = parseInt(query.data.split("_")[1]);

    if (!numeros[num]) return;

    if (query.data.startsWith("ok_")) {

        numeros[num].estado = "pagado";

        bot.sendMessage(ADMIN_ID,
            `🔴 Número ${num} APROBADO`
        );

    } else {

        delete numeros[num];

        bot.sendMessage(ADMIN_ID,
            `❌ Pago rechazado número ${num}`
        );
    }
});

// =========================
// 🔄 RESET
// =========================
bot.onText(/\/reset/, (msg) => {
    numeros = {};
    bot.sendMessage(msg.chat.id, "🔄 Bingo reiniciado");
});