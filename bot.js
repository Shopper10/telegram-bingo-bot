const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ⚙️ CONFIG
const ADMIN_ID = 123456789; // 👈 CAMBIAR
const NEQUI_NUMERO = "3123902322";
const NEQUI_NOMBRE = "Carlos";

// 📦 memoria
let numeros = {};
let pendientes = {}; // comprobantes pendientes

// =========================
// 👤 usuario
// =========================
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// =========================
// 🎱 tablero
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
// 🎮 start
// =========================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /bingo");
});

// =========================
// 🎱 mostrar tablero
// =========================
bot.onText(/\/bingo/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 TABLERO:", {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });
});

// =========================
// 🎯 elegir número
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
        text: `🟡 Número ${num} reservado`
    });

    // 🔄 actualizar tablero
    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        { chat_id: chatId, message_id: messageId }
    ).catch(() => {});

    // 💰 instrucciones de pago
    bot.sendMessage(chatId,
`🟡 ${user} reservaste el número ${num}

💰 Paga a Nequi:
📱 ${NEQUI_NUMERO}
👤 ${NEQUI_NOMBRE}

📸 Envía el comprobante aquí`
    );
});

// =========================
// 📸 recibir comprobante
// =========================
bot.on('photo', (msg) => {

    const user = getUser(msg.from);
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    // buscar número reservado por ese usuario
    let numero = null;

    for (let n in numeros) {
        if (numeros[n].user === user && numeros[n].estado === "reservado") {
            numero = n;
            break;
        }
    }

    if (!numero) {
        bot.sendMessage(msg.chat.id, "❌ No tienes número pendiente");
        return;
    }

    pendientes[numero] = {
        user: user,
        fileId: fileId
    };

    // enviar al admin
    bot.sendPhoto(ADMIN_ID, fileId, {
        caption: `💰 Comprobante\n${user}\nNúmero: ${numero}`,
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ Aprobar", callback_data: `ok_${numero}` },
                    { text: "❌ Rechazar", callback_data: `no_${numero}` }
                ]
            ]
        }
    });

    bot.sendMessage(msg.chat.id, "⏳ Esperando confirmación de pago...");
});

// =========================
// ✅ aprobar / ❌ rechazar
// =========================
bot.on('callback_query', (query) => {

    if (!query.data.startsWith("ok_") && !query.data.startsWith("no_")) return;

    const num = query.data.split("_")[1];

    if (!pendientes[num]) return;

    const user = pendientes[num].user;

    if (query.data.startsWith("ok_")) {

        numeros[num].estado = "pagado";

        bot.sendMessage(query.message.chat.id,
            `🔴 Número ${num} aprobado para ${user}`
        );

    } else {

        delete numeros[num];

        bot.sendMessage(query.message.chat.id,
            `❌ Pago rechazado número ${num}`
        );
    }

    delete pendientes[num];
});