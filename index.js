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
    user: null,
    time: 0
  };
}

/* BOTONES EN LISTA VERTICAL */
function keyboard() {
  let rows = [];

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];

    let text =
      n.state === 'free'
        ? `🟢 ${i} DISPONIBLE`
        : n.state === 'reserved'
        ? `⛔ ${i} @${n.user}`
        : `✅ ${i} @${n.user}`;

    rows.push([
      Markup.button.callback(text, `pick_${i}`)
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

// START
bot.command('start', async (ctx) => {
  const msg = await ctx.reply(
    '🎱 BINGO RECKER',
    keyboard()
  );

  board = {
    chatId: ctx.chat.id,
    messageId: msg.message_id
  };
});

// CLICK
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('❌ Ocupado');
  }

  data[num] = {
    state: 'reserved',
    user: ctx.from.username || ctx.from.first_name,
    time: TIME
  };

  ctx.reply('📩 Envía comprobante');

  await update();
  ctx.answerCbQuery('✔ OK');
});

// UPDATE BOTONES
async function update() {
  if (!board) return;

  try {
    await bot.telegram.editMessageReplyMarkup(
      board.chatId,
      board.messageId,
      null,
      keyboard().reply_markup
    );
  } catch (e) {
    console.log(e.message);
  }
}

bot.launch();

console.log("BOT OK");