const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const TOTAL = 15;
const TIME = 10 * 60;

let data = {};
let board = null;

// INIT
for (let i = 1; i <= TOTAL; i++) {
  data[i] = {
    state: 'free',
    userId: null,
    user: null,
    time: 0
  };
}

# 🎯 BOTONES EN LISTA VERTICAL (FORMATO BINGO)
function keyboard() {
  let rows = [];

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];

    let label = '';

    if (n.state === 'free') {
      label = `🟢 ${i} DISPONIBLE`;
    }

    if (n.state === 'reserved') {
      let m = Math.floor(n.time / 60);
      let s = n.time % 60;
      label = `⛔ ${i} @${n.user} ${m}:${s.toString().padStart(2,'0')}`;
    }

    if (n.state === 'paid') {
      label = `✅ ${i} @${n.user}`;
    }

    rows.push([
      Markup.button.callback(label, `pick_${i}`)
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

# 🚀 START (MENSAJE FIJO)
bot.command('start', async (ctx) => {
  const msg = await ctx.reply(
    '🎱 BINGO RECKER - 15 NÚMEROS',
    keyboard()
  );

  board = {
    chatId: ctx.chat.id,
    messageId: msg.message_id
  };
});

# 🎯 TOMAR NÚMERO
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('❌ No disponible');
  }

  let user = '@' + (ctx.from.username || ctx.from.first_name);

  data[num] = {
    state: 'reserved',
    userId: ctx.from.id,
    user,
    time: TIME
  };

  ctx.reply(`📩 Envía comprobante de pago a Nequi`);

  startTimer(ctx, num);
  await updateBoard();

  ctx.answerCbQuery('✔ Reservado');
});

# ⏱ TIMER 10 MIN
function startTimer(ctx, num) {
  setInterval(async () => {

    if (data[num].state !== 'reserved') return;

    data[num].time--;

    if (data[num].time <= 0) {

      let user = data[num].user;

      data[num] = {
        state: 'free',
        userId: null,
        user: null,
        time: 0
      };

      bot.telegram.sendMessage(
        board.chatId,
        `⏰ ${user} no pagó. Número ${num} liberado`
      );

      await updateBoard();
    }

  }, 1000);
}

# 🔄 UPDATE TABLERO
async function updateBoard() {
  if (!board) return;

  try {
    await bot.telegram.editMessageReplyMarkup(
      board.chatId,
      board.messageId,
      null,
      keyboard().reply_markup
    );
  } catch (e) {}
}

bot.launch();

console.log("🎱 BINGO BOT LISTO");