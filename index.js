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

function keyboard() {
  let rows = [];

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];

    let text =
      n.state === 'free'
        ? `1 ${i} DISPONIBLE`
        : n.state === 'reserved'
        ? `0 ${i} ${n.user}`
        : `2 ${i} ${n.user}`;

    rows.push([
      Markup.button.callback(text, `pick_${i}`)
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

bot.command('start', async (ctx) => {
  const msg = await ctx.reply('BINGO BOT', keyboard());

  board = {
    chatId: ctx.chat.id,
    messageId: msg.message_id
  };
});

bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('ocupado');
  }

  data[num] = {
    state: 'reserved',
    user: ctx.from.username || ctx.from.first_name,
    time: TIME
  };

  await update();
  ctx.answerCbQuery('ok');
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

console.log("OK BOT RUNNING");