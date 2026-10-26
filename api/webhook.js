const { initAgentSystem } = require("../lib/agents");

function parseWebhookBody(body) {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (error) {
      return null;
    }
  }

  return body;
}

function getMessageText(payload) {
  if (!payload) {
    return null;
  }

  if (payload.message?.text) {
    return payload.message.text;
  }

  if (payload.edited_message?.text) {
    return payload.edited_message.text;
  }

  if (payload.callback_query?.message?.text) {
    return payload.callback_query.data || payload.callback_query.message.text;
  }

  return null;
}

function getChatId(payload) {
  if (!payload) {
    return null;
  }

  if (payload.message?.chat?.id) {
    return payload.message.chat.id;
  }

  if (payload.edited_message?.chat?.id) {
    return payload.edited_message.chat.id;
  }

  if (payload.callback_query?.message?.chat?.id) {
    return payload.callback_query.message.chat.id;
  }

  return null;
}

async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  return response.json();
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        service: "telegram-ai-agent-crew",
        status: "ready",
        message: "Telegram bot bridge is online.",
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const payload = parseWebhookBody(req.body);

    if (!payload || !payload.message) {
      return res.status(200).json({ ok: true, status: "ignoring non-message update" });
    }

    const messageText = getMessageText(payload);
    const chatId = getChatId(payload);
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!messageText || !chatId || !botToken) {
      return res.status(400).json({ ok: false, error: "Missing payload data or bot token" });
    }

    const responseText = await initAgentSystem(messageText);

    await sendTelegramMessage(botToken, chatId, responseText);

    return res.status(200).json({ ok: true, response: responseText });
  } catch (error) {
    console.error("Webhook failed:", error);
    return res.status(500).json({ ok: false, error: error.message || "Internal server error" });
  }
};
