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

            const u = item.user;

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

// 🔄 ACTUALIZAR TABLERO + DINERO
function actualizarTablero() {

    if (!tableroChatId || !tableroMessageId) return;

    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        {
            chat_id: tableroChatId,
            message_id: tableroMessageId
        }
    ).catch(() => {});

    // 💰 mensaje fijo de dinero
    bot.sendMessage(tableroChatId,
`💰 TOTAL RECAUDADO: $${totalDinero.toLocaleString()}`, {
        disable_notification: true
    });
}

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

// 🎯 TOMAR NÚMERO
bot.on('callback_query', (query) => {

    const num = parseInt(query.data.split("_")[1]);
    const user = getUser(query.from);

    if (numeros[num]) {
        bot.answerCallbackQuery(query.id, { text: "❌ Ocupado" });
        return;
    }

    numeros[num] = {
        user: user,
        estado: "reservado"
    };

    actualizarTablero();

    bot.answerCallbackQuery(query.id, {
        text: `✔ ${num} tomado`
    });

    // 🔔 EFECTO CASINO VISUAL
    bot.sendMessage(tableroChatId,
`🎰🎰🎰 NÚMERO EN JUEGO 🎰🎰🎰

👤 ${user}
🔢 ${num}

💰 Paga $3.000 NEQUI
📸 Envía captura`);
});

// 🔥 ADMIN ACCIONES
bot.on('callback_query', async (query) => {

    const data = query.data;
    const userId = query.from.id;

    if (userId !== ADMIN_ID) {
        bot.answerCallbackQuery(query.id, { text: "⛔ No autorizado" });
        return;
    }

    const num = parseInt(data.split("_")[1]);

    if (!numeros[num]) return;

    const user = numeros[num].user;

    // ❌ RECHAZAR
    if (data.startsWith("no_")) {

        delete numeros[num];

        bot.sendMessage(tableroChatId,
`❌ PAGO RECHAZADO

🔢 ${num}
👤 ${user}`);

        actualizarTablero();

        bot.answerCallbackQuery(query.id, { text: "Rechazado" });
        return;
    }

    // ✅ APROBAR + RUEDA + DINERO
    if (data.startsWith("ok_")) {

        let anim = await bot.sendMessage(tableroChatId,
`🎰 GIRANDO RUEDA...`);

        // 🎰 ANIMACIÓN RUEDA
        let frames = ["🎰", "🎲", "🎯", "💰", "🎰"];

        for (let i = 0; i < frames.length; i++) {
            setTimeout(() => {
                bot.editMessageText(`${frames[i]} PROCESANDO PAGO...`, {
                    chat_id: tableroChatId,
                    message_id: anim.message_id
                });
            }, i * 700);
        }

        setTimeout(() => {

            numeros[num].estado = "pagado";

            totalDinero += 3000;

            bot.editMessageText(
`✅ PAGO APROBADO

👤 ${user}
🔢 ${num}

💰 +$3.000 CONFIRMADO`, {
                chat_id: tableroChatId,
                message_id: anim.message_id
            });

            actualizarTablero();

        }, 4000);

        bot.answerCallbackQuery(query.id, { text: "Procesando..." });
    }
});