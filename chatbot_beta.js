const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode'); // Biblioteca para gerar o QR Code como imagem
const fs = require('fs'); // Para manipular arquivos

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true, // Garante que o Puppeteer rode em modo headless
        args: [
            '--no-sandbox', // Remove restrições de segurança no ambiente Render
            '--disable-setuid-sandbox', // Permite permissões de acesso necessárias
            '--disable-dev-shm-usage', // Evita problemas de memória compartilhada
            '--disable-accelerated-2d-canvas', // Desativa renderizações gráficas desnecessárias
            '--no-first-run', // Impede configurações iniciais desnecessárias
            '--no-zygote', // Reduz o consumo de memória
            '--single-process', // Ajuda em servidores com limitações de processos
            '--disable-gpu' // Remove a dependência de GPU (não usada em headless)
        ]
    }
});

// Evento para lidar com o QR Code
client.on('qr', async (qr) => {
    console.log('QR Code gerado. Salvando como imagem...');

    try {
        // Gera o QR Code e salva como "qrcode.png" na raiz do projeto
        await qrcode.toFile('./qrcode.png', qr);
        console.log('QR Code salvo como "qrcode.png". Faça o download para escanear.');
    } catch (err) {
        console.error('Erro ao salvar QR Code:', err);
    }
});

client.on('ready', async () => {
    console.log('Bot conectado com sucesso!');

    const chats = await client.getChats();
    for (let chat of chats) {
        if (chat.unreadCount > 0) {
            if (chat.id.server === 'g.us') {
                console.log(`Ignorando mensagens nao lidas no grupo: ${chat.name}`);
                continue;
            }

            console.log(`Processando mensagens nao lidas de ${chat.name || chat.id.user}`);

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
        message.reply('Serviços disponíveis: Limpeza, restauração, clareamento..');
    } else if (message.body === '3') {
        message.reply('Localização: Av. José dos Santos e Silva, 26. Teresina-PI.');
    } else {
        console.log(`Mensagem irrelevante de ${message.from}: ${message.body}`);
    }
}

client.on('message', processMessage);

client.initialize();
