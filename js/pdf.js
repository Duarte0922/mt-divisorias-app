// Garante o carregamento correto do jsPDF
window.jsPDF = window.jspdf.jsPDF;

// Link da logo: usa o arquivo local da pasta assets (mesmo que aparece no cabeçalho do site)
const LOGO_URL = "assets/logo.png";

// ESCUTADOR DO BOTÃO GERAR PDF
document.getElementById("gerarPDF").addEventListener("click", () => {
    const tipo = document.getElementById("tipo").value;

    if (tipo === "Recibo") {
        gerarReciboPdf();
        return;
    }

    const dados = {
        numero: Math.floor(Date.now() / 1000).toString().slice(-5),
        cliente: document.getElementById("cliente").value,
        telefone: document.getElementById("telefone").value,
        endereco: document.getElementById("endereco").value,
        cidade: document.getElementById("cidade").value,
        data: document.getElementById("data").value,
        tipo: tipo,
        entrada: document.getElementById("entrada").value,
        formaPagamento: document.getElementById("pagamento").value,
        observacoes: document.getElementById("observacoes").value,
        total: document.getElementById("totalGeral").innerText,
        itens: []
    };

    document.querySelectorAll("#itens tr").forEach(tr => {
        const qtd = tr.querySelector(".qtd").value;
        const unidade = tr.querySelector(".unidade") ? tr.querySelector(".unidade").value : "un";
        const desc = tr.querySelector(".descricao").value;
        const unit = tr.querySelector(".unitario").value;
        const tot = tr.querySelector(".valorTotal").innerText;
        if (desc) {
            dados.itens.push({ qtd, unidade, descricao: desc, unitario: unit, totalItem: tot });
        }
    });

    if (!dados.cliente) {
        alert("Preencha o nome do cliente para gerar o PDF.");
        return;
    }

    gerarDocumentoPDF(dados, true);
});

// FUNÇÃO PARA GERAR O RECIBO
async function gerarReciboPdf() {
    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a5"
    });

    const cliente = (document.getElementById("cliente").value || "").toUpperCase();
    const dataInput = document.getElementById("data").value;
    const valorRecibo = document.getElementById("entrada").value || document.getElementById("totalGeral").innerText || "R$ 0,00";
    const observacoes = document.getElementById("observacoes").value || "Serviços prestados.";
    const cidade = document.getElementById("cidade").value || "Belo Horizonte";

    if (!cliente) {
        alert("Por favor, preencha o nome do cliente.");
        return;
    }

    let dia = "__", mes = "___________", ano = "20__";
    if (dataInput) {
        const partesData = dataInput.split("-");
        dia = partesData[2];
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        mes = meses[parseInt(partesData[1]) - 1];
        ano = partesData[0];
    }

    const carregarLogo = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = LOGO_URL;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
    });

    const imgLogo = await carregarLogo;

    // CABEÇALHO
    doc.setFillColor(18, 38, 58);
    doc.rect(0, 0, 210, 4, "F");

    if (imgLogo) {
        doc.addImage(imgLogo, "PNG", 10, 8, 25, 25);
    }

    doc.setTextColor(18, 38, 58);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18); // Aumentado de 16 para 18
    doc.text("MT Divisórias", 40, 15);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11); // Aumentado de 9 para 11
    doc.setTextColor(80, 80, 80); // Um pouco mais escuro para melhor leitura
    doc.text("Forros, Divisórias e Acabamentos para o seu Espaço", 40, 21);
    doc.text("Contato: (31) 9 9944-6472 | claudomiro.gomes@yahoo.com.br", 40, 26);
    doc.text("Instagram: @mtdivisorias", 40, 31);

    doc.setDrawColor(120, 130, 140);
    doc.setLineWidth(1);
    doc.line(10, 36, 200, 36);

    // CORPO DO RECIBO
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(24); // Aumentado de 22 para 24
    doc.setTextColor(18, 38, 58);
    doc.text("RECIBO", 10, 48);

    // === RETÂNGULO DO VALOR AJUSTADO ===
    const valorTexto = `R$ ${valorRecibo}`;
    const larguraRetangulo = 110;
    const alturaRetangulo = 14; // Aumentado ligeiramente para a fonte maior
    const xPosRetangulo = 90;
    const yPosRetangulo = 38;

    doc.setFillColor(230, 235, 240);
    doc.rect(xPosRetangulo, yPosRetangulo, larguraRetangulo, alturaRetangulo, "F");

    doc.setFontSize(12); // Aumentado de 9 para 12 (Texto do valor bem maior)
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(18, 38, 58);

    const valorQuebrado = doc.splitTextToSize(valorTexto, larguraRetangulo - 6);
    const espacamentoLinha = 5;
    const numLinhas = Array.isArray(valorQuebrado) ? valorQuebrado.length : 1;
    const alturaTotalTexto = numLinhas * espacamentoLinha;
    const inicioY = yPosRetangulo + (alturaRetangulo - alturaTotalTexto) / 2 + espacamentoLinha - 1;

    doc.text(valorQuebrado, xPosRetangulo + 4, inicioY);

    // Restante do recibo
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(13); // Aumentado de 11 para 13
    doc.setTextColor(30, 30, 30); // Mais escuro

    let yPos = 68;
    const margemEsq = 10;
    const larguraTexto = 130;
    const xPosValor = 52; // Afastado para não sobrepor o texto em negrito que aumentou

    // 1. Recebi(emos) de
    doc.setFont("Helvetica", "bold");
    doc.text("Recebi(emos) de:", margemEsq, yPos);
    
    doc.setFont("Helvetica", "bold"); // Nome do cliente agora sai em Negrito para destacar
    const clienteLinhas = doc.splitTextToSize(cliente, larguraTexto);
    doc.text(clienteLinhas, xPosValor, yPos);
    yPos += (Array.isArray(clienteLinhas) ? clienteLinhas.length : 1) * 7 + 4;

    // 2. A importância de
    doc.setFont("Helvetica", "bold");
    doc.text("A importância de:", margemEsq, yPos);
    
    doc.setFont("Helvetica", "normal");
    const valorLinhas = doc.splitTextToSize(valorRecibo, larguraTexto);
    doc.text(valorLinhas, xPosValor, yPos);
    yPos += (Array.isArray(valorLinhas) ? valorLinhas.length : 1) * 7 + 4;

    // 3. Proveniente de
    doc.setFont("Helvetica", "bold");
    doc.text("Proveniente de:", margemEsq, yPos);
    
    doc.setFont("Helvetica", "normal");
    const obsLinhas = doc.splitTextToSize(observacoes, larguraTexto);
    doc.text(obsLinhas, xPosValor, yPos);
    yPos += (Array.isArray(obsLinhas) ? obsLinhas.length : 1) * 7 + 6;

    doc.setFont("Helvetica", "italic");
    doc.text("para clareza firmo(amos) o presente.", margemEsq, yPos);
    yPos += 14;

    // Data
    doc.setFont("Helvetica", "normal");
    const dataTexto = `${cidade}, ${dia} de ${mes} de ${ano}.`;
    doc.text(dataTexto, margemEsq, yPos);
    yPos += 3;

    // Assinatura
    doc.line(120, yPos, 190, yPos);
    doc.setFontSize(11); // Aumentado de 10 para 11
    doc.setFont("Helvetica", "bold");
    doc.text("Assinatura", 155, yPos + 6, { align: "center" });

    window.open(doc.output('bloburl'), '_blank');
}

// FUNÇÃO PARA VISUALIZAR DO HISTÓRICO
async function visualizarPedidoPdf(idDocumento) {
    try {
        const docSnap = await db.collection("pedidos").doc(idDocumento).get();
        if (!docSnap.exists) { alert("Pedido não encontrado."); return; }
        const pedido = docSnap.data();

        const dadosPedido = {
            numero: pedido.numero || '---',
            cliente: pedido.cliente || '---',
            telefone: pedido.telefone || '---',
            endereco: pedido.endereco || '---',
            cidade: pedido.cidade || '',
            data: pedido.data || '---',
            tipo: pedido.tipo || 'Orçamento',
            entrada: pedido.entrada || 'R$ 0,00',
            formaPagamento: pedido.formaPagamento || '---',
            observacoes: pedido.observacoes || '',
            total: pedido.total || 'R$ 0,00',
            itens: pedido.itens || []
        };

        if (dadosPedido.tipo === "Recibo") {
            document.getElementById("cliente").value = dadosPedido.cliente;
            document.getElementById("data").value = dadosPedido.data;
            document.getElementById("entrada").value = dadosPedido.entrada;
            document.getElementById("observacoes").value = dadosPedido.observacoes;
            document.getElementById("cidade").value = dadosPedido.cidade;
            gerarReciboPdf();
        } else {
            gerarDocumentoPDF(dadosPedido, false);
        }

    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao recuperar arquivo.");
    }
}

// FUNÇÃO PRINCIPAL PARA GERAR PDF (ORÇAMENTO/PEDIDO)
function gerarDocumentoPDF(pedido, baixarDireto = true) {
    const doc = new jsPDF();
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = LOGO_URL;

    img.onload = function() {
        desenharConteudo(doc, img, pedido, baixarDireto);
    };
    img.onerror = function() {
        desenharConteudo(doc, null, pedido, baixarDireto);
    };
}

// FUNÇÃO QUE DESENHA O CONTEÚDO DO PDF (A4)
function desenharConteudo(doc, imgElement, pedido, baixarDireto) {
    let inicioTextoX = 14;
    if (imgElement) {
        doc.addImage(imgElement, 'PNG', 14, 15, 38, 30);
        inicioTextoX = 58;
    }

    // Cabeçalho
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(24); // Aumentado de 22 para 24
    doc.text("MT DIVISÓRIAS", inicioTextoX, 25);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11); // Aumentado de 10 para 11
    doc.text("Forros, Divisórias e Acabamentos para o seu Espaço", inicioTextoX, 32);
    doc.text("WhatsApp: (31) 9 9944-6472 | claudomiro.gomes@yahoo.com.br", inicioTextoX, 39);
    doc.text("Instagram: @mtdivisorias", inicioTextoX, 46);

    doc.setLineWidth(0.5);
    doc.line(14, 50, 196, 50);

    // Tipo e Número
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18); // Aumentado de 16 para 18
    doc.text(`${pedido.tipo.toUpperCase()} N° ${pedido.numero}`, 14, 60);

    // Dados do Cliente
    doc.setFontSize(13); // Aumentado de 11 para 13
    doc.text("DADOS DO CLIENTE", 14, 72);
    doc.setFont("Helvetica", "normal");
    
    // Deixei o conteúdo dos dados com tamanho 12 para excelente leitura
    doc.setFontSize(12);
    doc.text(`Cliente: ${pedido.cliente}`, 14, 80);
    doc.text(`Telefone: ${pedido.telefone}`, 14, 87);
    doc.text(`Endereço: ${pedido.endereco} - ${pedido.cidade}`, 14, 94);
    doc.text(`Data: ${pedido.data}`, 14, 101);

    doc.line(14, 106, 196, 106);

    // Itens do Serviço
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13); // Aumentado para 13
    doc.text("ITENS DO SERVIÇO", 14, 114);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(12); // Texto dos itens aumentado de 11 para 12
    let linhaAtual = 123;
    const larguraDescricao = 140; // Ajustado largura para a nova fonte
    const posXValor = 196;

    pedido.itens.forEach((item) => {
        const qtdUnidade = `${item.qtd}${item.unidade ? ' ' + item.unidade : ''}`;
        const descricaoCompleta = `${qtdUnidade} - ${item.descricao}`;
        const descricaoQuebrada = doc.splitTextToSize(descricaoCompleta, larguraDescricao);
        
        doc.text(descricaoQuebrada, 14, linhaAtual);
        
        const numLinhas = Array.isArray(descricaoQuebrada) ? descricaoQuebrada.length : 1;
        // Preço do item em Negrito para facilitar a leitura dos valores
        doc.setFont("Helvetica", "bold");
        doc.text(`${item.totalItem}`, posXValor, linhaAtual + (numLinhas - 1) * 5, { align: "right" });
        doc.setFont("Helvetica", "normal");
        
        linhaAtual += (numLinhas * 7) + 3; // Ajustado espaçamento para não encavalar
    });

    doc.line(14, linhaAtual + 2, 196, linhaAtual + 2);
    linhaAtual += 12;

    // Total Geral destacado
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14); // Aumentado o Total Geral para tamanho 14
    doc.text(`TOTAL GERAL: ${pedido.total}`, 14, linhaAtual);
    
    linhaAtual += 12;
    doc.setFontSize(12); // Volta para 12 para as informações adicionais
    
    // Entrada
    doc.setFont("Helvetica", "normal");
    const entradaTexto = `Entrada: ${pedido.entrada}`;
    const entradaQuebrada = doc.splitTextToSize(entradaTexto, 180);
    doc.text(entradaQuebrada, 14, linhaAtual);
    linhaAtual += (Array.isArray(entradaQuebrada) ? entradaQuebrada.length : 1) * 7 + 2;
    
    // Forma de Pagamento
    const pagTexto = `Forma de Pagamento: ${pedido.formaPagamento}`;
    const pagQuebrada = doc.splitTextToSize(pagTexto, 180);
    doc.text(pagQuebrada, 14, linhaAtual);
    linhaAtual += (Array.isArray(pagQuebrada) ? pagQuebrada.length : 1) * 7 + 2;
    
    // Observações
    if (pedido.observacoes) {
        const obsQuebrada = doc.splitTextToSize(`Observações: ${pedido.observacoes}`, 180);
        doc.text(obsQuebrada, 14, linhaAtual);
        linhaAtual += (Array.isArray(obsQuebrada) ? obsQuebrada.length : 1) * 7 + 2;
    }

    // Assinatura
    doc.line(50, 265, 160, 265);
    doc.setFont("Helvetica", "bold");
    doc.text("Assinatura do Emitente", 105, 271, { align: "center" });

    if (baixarDireto) {
        doc.save(`${pedido.tipo}_${pedido.cliente}.pdf`);
    } else {
        window.open(doc.output('bloburl'), '_blank');
    }
}
