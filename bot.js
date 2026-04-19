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
// 👤 usuario
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
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /bingo para ver el tablero");
});

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
// 🎯 ELEGIR NÚMERO
// =========================
bot.on('callback_query', (query) => {

    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    const user = getUser(query.from);

    // =====================
    // 🎱 SELECCIÓN NÚMERO
    // =====================
    if (data.startsWith("num_")) {

        const num = parseInt(data.split("_")[1]);

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
    }

    // =====================
    // 💰 APROBAR / RECHAZAR
    // =====================
    if (data.startsWith("ok_") || data.startsWith("no_")) {

        const num = parseInt(data.split("_")[1]);

        if (!numeros[num]) return;

        if (data.startsWith("ok_")) {

            numeros[num].estado = "pagado";

            bot.sendMessage(ADMIN_ID,
                `🔴 Número ${num} APROBADO`
            );

        } else {

            delete numeros[num];

            bot.sendMessage(ADMIN_ID,
                `❌ Número ${num} RECHAZADO`
            );
        }

        bot.answerCallbackQuery(query.id);
    }
});

// =========================
// 📸 COMPROBANTE
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
        caption: `💰 COMPROBANTE\n👤 ${user}\n🎱 Número: ${numero}`,
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ APROBAR", callback_data: `ok_${numero}` },
                    { text: "❌ RECHAZAR", callback_data: `no_${numero}` }
                ]
            ]
        }
    });

    bot.sendMessage(msg.chat.id, "⏳ Esperando aprobación...");
});