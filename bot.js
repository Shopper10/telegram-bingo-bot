const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 📦 DATA
let numeros = {};
let tableroMessageId = null;
let tableroChatId = null;

// 👤 USER
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// 🎱 TABLERO
function generarTablero() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        let texto = `🟢 ${i}`;

        const item = numeros[i];

        if (item) {

            const u = item.user;

            if (item.estado === "reservado") {
                texto = `🟡 ${i} ${u} ⏳`;
            }

            if (item.estado === "pagado") {
                texto = `🔴 ${i} ${u} ✅`;
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

// 🎬 ANIMACIÓN SIMPLE (SIMULADA)
function animarTablero(chatId) {

    let pasos = [
        "🎱 Preparando bingo...",
        "🎲 Mezclando números...",
        "🎯 Listo!"
    ];

    let i = 0;

    let interval = setInterval(() => {

        bot.editMessageText(pasos[i], {
            chat_id: chatId,
            message_id: tableroMessageId
        }).catch(() => {});

        i++;

        if (i >= pasos.length) {
            clearInterval(interval);
            actualizarTablero();
        }

    }, 700);
}

// ⛔ BLOQUEO AUTOMÁTICO
function bloquearAutomatico(num, tiempo = 300000) { // 5 min

    setTimeout(() => {

        if (numeros[num] && numeros[num].estado === "reservado") {

            delete numeros[num];

            actualizarTablero();

            bot.sendMessage(tableroChatId,
                `⛔ Número ${num} liberado por no pago`
            );
        }

    }, tiempo);
}

// 🎮 START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /bingo para iniciar tablero");
});

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

    bloquearAutomatico(num); // ⏳ activa tiempo límite

    bot.answerCallbackQuery(query.id, {
        text: "✔ reservado"
    });

    bot.sendMessage(tableroChatId,
`🟡 ${user} reservaste el número ${num}

💰 Envía tu pago en el grupo`
    );
});

// 📸 PAGO EN GRUPO
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

    numeros[numero].estado = "reservado"; // sigue pendiente hasta aprobación

    actualizarTablero();

    // 🎬 pequeña “animación visual”
    animarTablero(tableroChatId);

    bot.sendPhoto(msg.chat.id, fileId, {
        caption: `💰 Pago recibido\n👤 ${user}\n🎱 Número: ${numero}\n⏳ Esperando confirmación`
    });
});