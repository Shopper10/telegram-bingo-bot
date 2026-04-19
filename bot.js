const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 📦 DATA
let numeros = {};
let tableroMessageId = null;
let tableroChatId = null;

// 👤 USERNAME
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// 🎱 TABLERO 1–15 (FORMATO EXACTO)
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

    numeros[numero].estado = "pagado";

    actualizarTablero();

    bot.sendMessage(tableroChatId,
`💰 Pago recibido
👤 ${user}
🎱 Número: ${numero}
⛔️ En revisión`
    );
});