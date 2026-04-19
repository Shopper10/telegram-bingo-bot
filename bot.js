const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

// 📦 DATA
let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

// 👤 USER
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// 🎰 TABLERO
function generarTablero() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];

        let texto = `🟢 ${i} - DISPONIBLE`;

        if (item) {

            const u = item.user.name;

            if (item.estado === "reservado") {
                texto = `⛔️ ${i} - ${u} RESERVADO`;
            }

            if (item.estado === "pendiente") {
                texto = `⏱️ ${i} - ${u} PENDIENTE`;
            }

            if (item.estado === "pagado") {
                texto = `✅ ${i} - ${u} PAGADO`;
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

// 🔁 AUTO REFRESH
setInterval(() => {

    if (!tableroChatId || !tableroMessageId) return;

    actualizarTablero();

}, 10000);

// 🎰 CREAR TABLERO
bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 CASINO BINGO EN VIVO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// 🎯 TOMAR NÚMERO (MULTI USUARIO PERMITIDO)
bot.on('callback_query', (query) => {

    const num = parseInt(query.data.split("_")[1]);
    const user = getUser(query.from);

    if (numeros[num]) {
        bot.answerCallbackQuery(query.id, { text: "❌ Ocupado" });
        return;
    }

    numeros[num] = {
        user: {
            id: query.from.id,
            name: user,
            numeros: [] // 👈 permite múltiples
        },
        estado: "reservado"
    };

    numeros[num].user.numeros.push(num);

    actualizarTablero();

    bot.sendMessage(tableroChatId,
`🎯 NÚMERO RESERVADO

👤 ${user}
🔢 ${num}

💰 Paga $3.000 NEQUI
📸 Envía captura en el grupo`);
});

// 📸 FOTO (MULTI SOPORTADO)
bot.on('photo', (msg) => {

    if (msg.chat.type === "private") return;

    const userId = msg.from.id;
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    let numero = null;

    for (let n in numeros) {

        if (
            numeros[n].user &&
            numeros[n].user.id === userId &&
            numeros[n].estado === "reservado"
        ) {
            numero = n;
            break;
        }
    }

    if (!numero) {
        bot.sendMessage(msg.chat.id,
`❌ No tienes números reservados`);
        return;
    }

    numeros[numero].estado = "pendiente";

    actualizarTablero();

    bot.sendMessage(tableroChatId,
`⏱️ PAGO RECIBIDO

👤 ${numeros[numero].user.name}
🔢 ${numero}
⏳ En revisión admin`);

    bot.sendPhoto(tableroChatId, fileId, {
        caption: `📥 VERIFICAR PAGO

👤 ${numeros[numero].user.name}
🔢 ${numero}`,
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

// 🔥 ADMIN + SLOT + REPOST
bot.on('callback_query', async (query) => {

    const data = query.data;
    const userId = query.from.id;

    if (userId !== ADMIN_ID) {
        bot.answerCallbackQuery(query.id, { text: "⛔ No autorizado" });
        return;
    }

    const num = parseInt(data.split("_")[1]);

    if (!numeros[num]) return;

    const user = numeros[num].user.name;

    // ❌ RECHAZAR
    if (data.startsWith("no_")) {

        delete numeros[num];

        bot.sendMessage(tableroChatId,
`❌ PAGO RECHAZADO

🔢 ${num}
👤 ${user}`);

        actualizarTablero();
        return;
    }

    // ✅ APROBAR
    if (data.startsWith("ok_")) {

        const anim = await bot.sendMessage(tableroChatId,
`🎰 GIRANDO RUEDA...`);

        const slots = ["🎰 7", "🎲 12", "🎯 3", "💰 9", "🎰 1"];

        for (let i = 0; i < slots.length; i++) {
            setTimeout(() => {
                bot.editMessageText(
`🎰 SLOT MACHINE

${slots[i]}

⏳ verificando...`, {
                    chat_id: tableroChatId,
                    message_id: anim.message_id
                });
            }, i * 600);
        }

        setTimeout(() => {

            numeros[num].estado = "pagado";
            totalDinero += 3000;

            bot.editMessageText(
`🎉 PAGO APROBADO

👤 ${user}
🔢 ${num}
💰 +$3.000 NEQUI`, {
                chat_id: tableroChatId,
                message_id: anim.message_id
            });

            actualizarTablero();

            bot.sendMessage(tableroChatId,
`🎰 TABLERO ACTUALIZADO EN VIVO`, {
                reply_markup: {
                    inline_keyboard: generarTablero()
                }
            });

        }, 3500);

        bot.answerCallbackQuery(query.id, { text: "Procesando..." });
    }
});