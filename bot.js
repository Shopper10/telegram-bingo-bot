const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ⚙️ CONFIG
const ADMIN_ID = 123456789; // 👈 CAMBIAR TU ID
const NEQUI_NUMERO = "3001234567";
const NEQUI_NOMBRE = "Carlos";

// 📦 memoria
let numeros = {};

// =========================
// 👤 USER HELP
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
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /bingo para ver números");
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
// 🎯 CALLBACK ÚNICO (ARREGLADO)
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

📸 Envía la captura en el grupo`
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

            bot.sendMessage(chatId,
                `🔴 Número ${num} APROBADO`
            );

        } else {

            delete numeros[num];

            bot.sendMessage(chatId,
                `❌ Número ${num} RECHAZADO`
            );
        }

        bot.answerCallbackQuery(query.id);
    }
});

// =========================
// 📸 FOTO EN GRUPO (CLAVE)
// =========================
bot.on('photo', (msg) => {

    const chatId = msg.chat.id;

    // 🚫 ignorar privados
    if (msg.chat.type === "private") return;

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
        bot.sendMessage(chatId, `❌ ${user} no tiene número reservado`);
        return;
    }

    // 📩 MENSAJE EN GRUPO CON BOTONES
    bot.sendPhoto(chatId, fileId, {
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
});