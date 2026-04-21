const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);
const TOTAL = 15;
const TIME = 600;

let data = {};
let board = null;

for (let i = 1; i <= TOTAL; i++) {
  data[i] = { state: 'free', user: null, time: 0 };
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function keyboard() {
  let rows = [];

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];

    let text = '';

    if (n.state === 'free') {
      text = `🟢 ${i} - DISPONIBLE`;
    }

    if (n.state === 'reserved') {
      text = `⛔ ${i} - @${n.user} ⏱ ${formatTime(n.time)}`;
    }

    if (n.state === 'paid') {
      text = `✅ ${i} - @${n.user} PAGADO`;
    }

    rows.push([
      Markup.button.callback(text, `pick_${i}`)
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

bot.command('start', async (ctx) => {
  const msg = await ctx.reply(
    '🎱 BINGO RECKER - 15 NÚMEROS 🎰',
    keyboard()
  );

  board = {
    chatId: ctx.chat.id,
    messageId: msg.message_id
  };
});

bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('❌ No disponible');
  }

  data[num] = {
    state: 'reserved',
    user: ctx.from.username || ctx.from.first_name,
    time: TIME
  };

  ctx.reply(
`📩 Pago requerido

⏱ Tienes 10 minutos o vuelve a libre

💳 Nequi: 3123902322`
  );

  await update();
  ctx.answerCbQuery('✔ tomado');
});

async function update() {
  if (!board) return;

  try {
    await bot.telegram.editMessageReplyMarkup(
      board.chatId,
      board.messageId,
      null,
      keyboard().reply_markup
    );
  } catch {}
}

bot.launch();

console.log("🎱 BINGO BOT ONLINE 🚀");