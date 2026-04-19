const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

// 📦 DATA
let numeros = {};
let tableroMessageId = null;
let tableroChatId = null;

// 👤 USER
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// 🎱 TABLERO 1–15
function generarTablero() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];

        let texto = `${i} 🎱 Disponible`;

        if (item) {

            const u = item.user;

            if (item.estado === "reservado") {
                texto = `${i} ⛔️ ${u} reservado`;
            }

            if (item.estado === "pagado") {
                texto = `${i} ✅ ${u} pagado`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// 🔄 ACTUALIZAR TABLERO
function actualizarTablero() {

    if (!tableroChatId || !tableroMessageId) return;

    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        {
            chat_id: tableroChatId,
            message_id: tableroMessageId
        }
    ).catch(() => {});
}

// ⏳ BLOQUEO AUTOMÁTICO (5 MIN)
function bloqueoAutomatico(num, tiempo = 300000) {

    setTimeout(() => {

        if (numeros[num] && numeros[num].estado === "reservado") {

            const user = numeros[num].user;

            delete numeros[num];

            actualizarTablero();

            bot.sendMessage(tableroChatId,
`⛔️ Número liberado por falta de pago

🔢 Número: ${num}
👤 ${user}`
            );
        }

    }, tiempo);
}

// 🎱 CREAR TABLERO
bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id, "🎱 TABLERO BINGO:", {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// 🎯 TOMAR NÚMERO
bot.on('callback_query', (query) => {

    const num = parseInt(query.data.split("_")[1]);
    const user = getUser(query.from);

    if (numeros[num]) {
        bot.answerCallbackQuery(query.id, {
            text: "❌ Ocupado"
        });
        return;
    }

    numeros[num] = {
        user: user,
        estado: "reservado"
    };

    actualizarTablero();

    bloqueoAutomatico(num);

    bot.answerCallbackQuery(query.id, {
        text: `✔ ${user} tomó ${num}`
    });

    bot.sendMessage(tableroChatId,
`🎱 ${user} reservó el número ${num}

💰 Envía tu pago con comprobante`
    );
});

// 📸 FOTO EN GRUPO → ENVÍA AL ADMIN
bot.on('photo', (msg) => {

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
        bot.sendMessage(msg.chat.id, `❌ ${user} no tiene número reservado`);
        return;
    }

    numeros[numero].estado = "pendiente";

    actualizarTablero();

    bot.sendMessage(msg.chat.id,
`💰 Pago recibido
👤 ${user}
🎱 Número: ${numero}
⏳ En espera de confirmación`
    );

    // 📥 ENVIAR AL ADMIN
    bot.sendPhoto(ADMIN_ID, fileId, {
        caption: `📥 PAGO PENDIENTE\n👤 ${user}\n🎱 Número: ${numero}`,
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

// 🔥 ADMIN APRUEBA / RECHAZA
bot.on('callback_query', (query) => {

    const data = query.data;
    const userId = query.from.id;

    if (userId !== ADMIN_ID) {
        bot.answerCallbackQuery(query.id, {
            text: "⛔ No autorizado"
        });
        return;
    }

    const num = parseInt(data.split("_")[1]);

    if (!numeros[num]) return;

    if (data.startsWith("ok_")) {
        numeros[num].estado = "pagado";
    }

    if (data.startsWith("no_")) {
        delete numeros[num];
    }

    actualizarTablero();

    bot.answerCallbackQuery(query.id, {
        text: "✔ actualizado"
    });
});