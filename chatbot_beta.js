const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode'); 
const express = require('express'); 
const fs = require('fs');

const app = express(); 
const PORT = process.env.PORT || 3000;
const HOST = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`; 

const SESSION_PATH = './session'; 


if (fs.existsSync(SESSION_PATH)) {
    fs.rmSync(SESSION_PATH, { recursive: true, force: true }); 
}


const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'default', 
        dataPath: SESSION_PATH, 
    }),
});

let qrCodeImageURL = ''; 


client.on('qr', async (qr) => {
    console.log('QR Code gerado. Acesse o navegador para escanear.');

    
    qrCodeImageURL = await qrcode.toDataURL(qr);
});


app.get('/', (req, res) => {
    if (qrCodeImageURL) {
        res.send(`
            <h1>Escaneie o QR Code abaixo:</h1>
            <img src="${qrCodeImageURL}" alt="QR Code">
        `);
    } else {
        res.send(`
            <h1>QR Code ainda não gerado. Tentando novamente em 5 segundos...</h1>
            <script>
                setTimeout(() => {
                    window.location.reload();
                }, 5000); // Recarrega a página automaticamente após 5 segundos
            </script>
        `);
    }
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em ${HOST}`);
});


client.on('ready', async () => {
    console.log('Bot conectado com sucesso!');

    const chats = await client.getChats();
    for (let chat of chats) {
        if (chat.unreadCount > 0) {
            if (chat.id.server === 'g.us') {
                console.log(`Ignorando mensagens não lidas no grupo: ${chat.name}`);
                continue;
            }

            console.log(`Processando mensagens não lidas de ${chat.name || chat.id.user}`);

            const messages = await chat.fetchMessages({ limit: chat.unreadCount });
            for (let message of messages) {
                if (!message.fromMe) {
                    processMessage(message);
                }
            }
        }
    }
});

const chatStates = {};

async function processMessage(message) {
    const chat = await message.getChat();

    if (chat.id.server === 'g.us') {
        console.log(`Mensagem ignorada no grupo: ${chat.name}`);
        return;
    }

    const userId = message.from;
    const now = Date.now();

    if (!chatStates[userId]) {
        chatStates[userId] = {
            welcomed: false,
            lastInteraction: 0,
        };
    }

    const userState = chatStates[userId];
    const fiveMinutesPassed = now - userState.lastInteraction > 300000;

    if (!userState.welcomed || fiveMinutesPassed) {
        message.reply(
            `Bem-vindo(a) à Have Odonto! Escolha uma das opções abaixo:
1. Horários de Funcionamento
2. Serviços Disponíveis
3. Localização e Contato`
        );
        userState.welcomed = true;
        userState.lastInteraction = now;
        return;
    }

    userState.lastInteraction = now;

    if (message.body === '1') {
        message.reply('Horários de funcionamento: Segunda a sexta, das 8h às 18h.');
    } else if (message.body === '2') {
        message.reply('Serviços disponíveis: Limpeza, restauração, clareamento...');
    } else if (message.body === '3') {
        message.reply('Localização: Av. José dos Santos e Silva, 26. Teresina-PI.');
    } else {
        console.log(`Mensagem irrelevante de ${message.from}: ${message.body}`);
    }
}

client.on('message', processMessage);


client.initialize();
