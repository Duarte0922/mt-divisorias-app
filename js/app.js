// Configuração do Firebase extraída do teu painel (projeto: mt-divisorias-app)
const firebaseConfig = {
  apiKey: "AIzaSyAIqCz96eH2DHZT1oRE8fmWuT2RN-eYHbc",
  authDomain: "mt-divisorias-app.firebaseapp.com",
  projectId: "mt-divisorias-app",
  storageBucket: "mt-divisorias-app.firebasestorage.app",
  messagingSenderId: "6859365130",
  appId: "1:6859365130:web:16672ab1f09f696ad238f3"
};

// Inicializa o Firebase no modo compatibilidade
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const storage = firebase.storage(); // Inicializa o Storage corretamente

// Ativa o cache offline seguro
db.enablePersistence().catch((err) => {
    console.log("Persistência offline não ativada:", err.code);
});

const itensBody = document.getElementById("itens");
const totalGeral = document.getElementById("totalGeral");
let idPedidoEmEdicao = null; 

// ====== BANCO DE DADOS DE PRODUTOS/SERVIÇOS ======
// A lista abaixo é fixa no código: sempre vai aparecer no autocomplete, mesmo se o
// Firestore estiver fora do ar ou sem permissão para a coleção "produtos".
// A tela "Produtos e Serviços" permite cadastrar produtos EXTRAS, que ficam salvos
// no Firestore e aparecem somados a esta lista (sem substituir nada abaixo).
const PRODUTOS_PADRAO_MT = [
    { nome: "Forro PVC", unidade: "m²", valorPadrao: 0 },
    { nome: "Forro PVC Amadeirado", unidade: "m²", valorPadrao: 0 },
    { nome: "Painel Ripado", unidade: "m²", valorPadrao: 0 },
    { nome: "Forro Mineral", unidade: "m²", valorPadrao: 0 },
    { nome: "Forro de Isopor", unidade: "m²", valorPadrao: 0 },
    { nome: "Forro de Lã de Vidro", unidade: "m²", valorPadrao: 0 },
    { nome: "Piso Laminado", unidade: "m²", valorPadrao: 0 },
    { nome: "Divisória Eucatex", unidade: "m²", valorPadrao: 0 },
    { nome: "Drywall", unidade: "m²", valorPadrao: 0 },
    { nome: "Desmontagem e Montagem de Divisórias", unidade: "m²", valorPadrao: 0 },
    { nome: "Desmontagem e Montagem de Forro", unidade: "m²", valorPadrao: 0 }
];

let CACHE_PRODUTOS = [];
let idProdutoEmEdicao = null;

function popularDatalist() {
    const datalist = document.getElementById("listaProdutos");
    if (!datalist) return;
    datalist.innerHTML = "";
    CACHE_PRODUTOS.forEach(p => {
        const option = document.createElement("option");
        option.value = p.nome;
        datalist.appendChild(option);
    });
}

// Junta um produto vindo do Firestore à lista: se o nome já existe (ex.: um dos padrão),
// atualiza a unidade/valor dele; se não existe, adiciona como item novo.
function mesclarProdutoFirestore(id, p) {
    const nomeNormalizado = (p.nome || "").trim().toLowerCase();
    const existente = CACHE_PRODUTOS.find(item => item.nome.trim().toLowerCase() === nomeNormalizado);
    if (existente) {
        existente.unidade = p.unidade || existente.unidade;
        existente.valorPadrao = p.valorPadrao || existente.valorPadrao;
        existente.id = id;
    } else {
        CACHE_PRODUTOS.push({ id: id, nome: p.nome, unidade: p.unidade || "m²", valorPadrao: p.valorPadrao || 0 });
    }
}

function renderizarTabelaProdutos() {
    const tabela = document.getElementById("listaProdutosTabela");
    if (!tabela) return;
    tabela.innerHTML = "";
    CACHE_PRODUTOS.forEach(p => {
        const tr = document.createElement("tr");
        const valorFormatado = p.valorPadrao
            ? p.valorPadrao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : "---";
        const ehPadrao = !p.id;
        tr.innerHTML = `
            <td>${p.nome}${ehPadrao ? ' <span style="color:var(--txt2); font-size:10px;">(padrão do sistema)</span>' : ''}</td>
            <td>${p.unidade || "m²"}</td>
            <td>${valorFormatado}</td>
            <td>
                <button class="btn-editar-produto">Editar</button>
                ${ehPadrao ? '' : '<button class="btn-excluir-produto">Excluir</button>'}
            </td>
        `;
        tr.querySelector(".btn-editar-produto").addEventListener("click", () => carregarProdutoParaEdicao(p.id, p));
        const btnExcluir = tr.querySelector(".btn-excluir-produto");
        if (btnExcluir) btnExcluir.addEventListener("click", () => excluirProduto(p.id));
        tabela.appendChild(tr);
    });
}

// Carrega os produtos: primeiro a lista fixa (instantâneo, nunca falha), depois tenta
// buscar produtos extras cadastrados no Firestore e mescla na mesma lista.
function carregarProdutos() {
    CACHE_PRODUTOS = PRODUTOS_PADRAO_MT.map(p => ({ ...p, id: null }));
    popularDatalist();
    renderizarTabelaProdutos();

    db.collection("produtos").orderBy("nome").get().then((snapshot) => {
        snapshot.forEach((doc) => mesclarProdutoFirestore(doc.id, doc.data()));
        popularDatalist();
        renderizarTabelaProdutos();
    }).catch(err => {
        console.warn("Não foi possível buscar produtos extras no Firestore (a lista padrão continua funcionando normalmente):", err);
    });
}

// Quando o campo Descrição bate com um produto cadastrado, preenche a unidade e o valor padrão sozinho
function aplicarProdutoNaLinha(tr, valorDigitado) {
    const encontrado = CACHE_PRODUTOS.find(p => p.nome.trim().toLowerCase() === (valorDigitado || "").trim().toLowerCase());
    if (!encontrado) return;

    const selectUnidade = tr.querySelector(".unidade");
    if (selectUnidade) selectUnidade.value = encontrado.unidade || "m²";

    const inputUnitario = tr.querySelector(".unitario");
    if (inputUnitario && (!inputUnitario.value || parseFloat(inputUnitario.value) === 0) && encontrado.valorPadrao) {
        inputUnitario.value = encontrado.valorPadrao;
    }

    atualizarVisibilidadeMedidas(tr);
    calcularTudo();
}

// ====== FORMULÁRIO DE CADASTRO DE PRODUTOS/SERVIÇOS ======
if (document.getElementById("btnAdicionarProduto")) {
    document.getElementById("btnAdicionarProduto").addEventListener("click", async () => {
        const nome = document.getElementById("produtoNome").value.trim();
        if (!nome) { alert("Informe o nome do produto/serviço."); return; }
        const unidade = document.getElementById("produtoUnidade").value;
        const valorPadrao = parseFloat(document.getElementById("produtoValor").value) || 0;

        try {
            await db.collection("produtos").add({ nome, unidade, valorPadrao });
            limparFormularioProduto();
            carregarProdutos();
        } catch (error) {
            alert("Erro ao salvar produto.");
        }
    });
}

if (document.getElementById("btnAtualizarProduto")) {
    document.getElementById("btnAtualizarProduto").addEventListener("click", async () => {
        if (!idProdutoEmEdicao) return;
        const nome = document.getElementById("produtoNome").value.trim();
        if (!nome) { alert("Informe o nome do produto/serviço."); return; }
        const unidade = document.getElementById("produtoUnidade").value;
        const valorPadrao = parseFloat(document.getElementById("produtoValor").value) || 0;

        try {
            await db.collection("produtos").doc(idProdutoEmEdicao).update({ nome, unidade, valorPadrao });
            limparFormularioProduto();
            carregarProdutos();
        } catch (error) {
            alert("Erro ao atualizar produto.");
        }
    });
}

function carregarProdutoParaEdicao(id, produto) {
    document.getElementById("produtoNome").value = produto.nome || "";
    document.getElementById("produtoUnidade").value = produto.unidade || "m²";
    document.getElementById("produtoValor").value = produto.valorPadrao || "";

    if (id) {
        // Produto extra, já salvo no Firestore: edição normal
        idProdutoEmEdicao = id;
        document.getElementById("btnAdicionarProduto").style.display = "none";
        document.getElementById("btnAtualizarProduto").style.display = "inline-block";
    } else {
        // Produto padrão do sistema: ao salvar, cria uma versão personalizada no Firestore
        // com o mesmo nome, que passa a valer no lugar do padrão (unidade/valor customizados).
        idProdutoEmEdicao = null;
        document.getElementById("btnAdicionarProduto").style.display = "inline-block";
        document.getElementById("btnAtualizarProduto").style.display = "none";
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limparFormularioProduto() {
    idProdutoEmEdicao = null;
    document.getElementById("produtoNome").value = "";
    document.getElementById("produtoUnidade").value = "m²";
    document.getElementById("produtoValor").value = "";
    document.getElementById("btnAdicionarProduto").style.display = "inline-block";
    document.getElementById("btnAtualizarProduto").style.display = "none";
}

async function excluirProduto(id) {
    if (confirm("Excluir este produto/serviço do banco de dados?")) {
        await db.collection("produtos").doc(id).delete();
        limparFormularioProduto();
        carregarProdutos();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    carregarProdutos();
    limparFormulario();
    carregarHistorico();
});

document.getElementById("btnAdicionar").addEventListener("click", () => adicionarItem());
document.getElementById("btnLimpar").addEventListener("click", limparFormulario);

// FUNÇÃO PARA ADICIONAR ITEM NA GRADE
// unidade aceita "m²" (metro quadrado), "m" (metro linear) ou "un" (unidade)
// usarCalculadoraMedidas: true para itens novos (ativa Comprimento x Largura quando for m²/m).
// Em pedidos antigos carregados do histórico (sem medidas salvas) isso vem como false,
// para não apagar a quantidade que já estava salva.
function adicionarItem(qtd = 1, unidade = "m²", descricao = "", unitario = 0, usarCalculadoraMedidas = true) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td data-label="Qtd">
            <div class="qtd-wrap">
                <div class="medida-area">
                    <input type="number" class="item-input comprimento" placeholder="Compr.(m)" step="0.01" min="0">
                    <span class="medida-x">×</span>
                    <input type="number" class="item-input largura" placeholder="Larg.(m)" step="0.01" min="0">
                </div>
                <div class="medida-linear">
                    <input type="number" class="item-input comprimento-linear" placeholder="Comprimento (m)" step="0.01" min="0">
                </div>
                <input type="number" class="item-input qtd" value="${qtd}" min="0.01" step="0.01">
                <small class="qtd-legenda">Calculado automaticamente</small>
            </div>
        </td>
        <td data-label="Unidade">
            <select class="item-input unidade">
                <option value="m²">m²</option>
                <option value="m">m</option>
                <option value="un">Unidade</option>
            </select>
        </td>
        <td data-label="Descrição">
            <div class="descricao-wrap">
                <input type="text" class="item-input descricao" list="listaProdutos" placeholder="Digite ou escolha o produto" value="${descricao}">
                <button type="button" class="btn-expandir" title="Escrever descrição detalhada"><i class="fa-solid fa-pen"></i></button>
            </div>
        </td>
        <td data-label="Valor Unitário"><input type="number" class="item-input unitario" value="${unitario}" step="0.01"></td>
        <td data-label="Total" class="valorTotal">R$ 0,00</td>
        <td data-label="Ação"><button class="btn-remover">X</button></td>
    `;
    itensBody.appendChild(tr);
    tr.querySelector(".unidade").value = unidade || "m²";

    if (usarCalculadoraMedidas) {
        atualizarVisibilidadeMedidas(tr);
    } else {
        // Pedido antigo: mantém o Qtd editável do jeito que foi salvo, sem calculadora
        tr.querySelector(".medida-area").style.display = "none";
        tr.querySelector(".medida-linear").style.display = "none";
    }

    tr.querySelector(".qtd").addEventListener("input", calcularTudo);
    tr.querySelector(".unitario").addEventListener("input", calcularTudo);
    tr.querySelector(".unidade").addEventListener("change", () => atualizarVisibilidadeMedidas(tr));
    tr.querySelector(".comprimento").addEventListener("input", () => calcularQtdPorArea(tr));
    tr.querySelector(".largura").addEventListener("input", () => calcularQtdPorArea(tr));
    tr.querySelector(".comprimento-linear").addEventListener("input", () => calcularQtdPorLinear(tr));
    tr.querySelector(".descricao").addEventListener("input", function () {
        aplicarProdutoNaLinha(tr, this.value);
    });
    tr.querySelector(".descricao").addEventListener("change", function () {
        aplicarProdutoNaLinha(tr, this.value);
    });
    tr.querySelector(".btn-expandir").addEventListener("click", function () {
        abrirModalDescricao(tr.querySelector(".descricao"));
    });
    tr.querySelector(".btn-remover").addEventListener("click", () => {
        tr.remove();
        calcularTudo();
    });
    calcularTudo();
}

// Mostra/esconde os campos de medida conforme a unidade escolhida e liga/desliga
// a edição manual do Qtd (quando calculado, o Qtd fica travado para o usuário).
function atualizarVisibilidadeMedidas(tr) {
    const unidade = tr.querySelector(".unidade").value;
    const areaWrap = tr.querySelector(".medida-area");
    const linearWrap = tr.querySelector(".medida-linear");
    const qtdInput = tr.querySelector(".qtd");
    const legenda = tr.querySelector(".qtd-legenda");

    if (unidade === "m²") {
        areaWrap.style.display = "flex";
        linearWrap.style.display = "none";
        qtdInput.readOnly = true;
        qtdInput.classList.add("qtd-calculada");
        legenda.style.display = "block";
        calcularQtdPorArea(tr);
    } else if (unidade === "m") {
        areaWrap.style.display = "none";
        linearWrap.style.display = "flex";
        qtdInput.readOnly = true;
        qtdInput.classList.add("qtd-calculada");
        legenda.style.display = "block";
        calcularQtdPorLinear(tr);
    } else {
        areaWrap.style.display = "none";
        linearWrap.style.display = "none";
        qtdInput.readOnly = false;
        qtdInput.classList.remove("qtd-calculada");
        legenda.style.display = "none";
    }
}

// Qtd = Comprimento x Largura (m²)
function calcularQtdPorArea(tr) {
    const c = parseFloat(tr.querySelector(".comprimento").value) || 0;
    const l = parseFloat(tr.querySelector(".largura").value) || 0;
    tr.querySelector(".qtd").value = (c * l).toFixed(2);
    calcularTudo();
}

// Qtd = Comprimento (m linear)
function calcularQtdPorLinear(tr) {
    const c = parseFloat(tr.querySelector(".comprimento-linear").value) || 0;
    tr.querySelector(".qtd").value = c.toFixed(2);
    calcularTudo();
}

// ====== MODAL DE DESCRIÇÃO DO SERVIÇO (campo maior para digitar) ======
const modalDescricao = document.getElementById("modalDescricao");
const modalTextarea = document.getElementById("modalTextarea");
const modalConfirmar = document.getElementById("modalConfirmar");
const modalCancelar = document.getElementById("modalCancelar");
let inputDescricaoAtual = null;

function abrirModalDescricao(inputEl) {
    inputDescricaoAtual = inputEl;
    modalTextarea.value = inputEl.value;
    modalDescricao.classList.add("ativo");
    setTimeout(() => modalTextarea.focus(), 100);
}

function fecharModalDescricao() {
    modalDescricao.classList.remove("ativo");
    inputDescricaoAtual = null;
}

if (modalConfirmar) {
    modalConfirmar.addEventListener("click", () => {
        if (inputDescricaoAtual) {
            inputDescricaoAtual.value = modalTextarea.value.trim();
        }
        fecharModalDescricao();
    });
}

if (modalCancelar) {
    modalCancelar.addEventListener("click", fecharModalDescricao);
}

if (modalDescricao) {
    modalDescricao.addEventListener("click", (e) => {
        if (e.target === modalDescricao) fecharModalDescricao();
    });
}

// CALCULA TUDO NA TELA
function calcularTudo() {
    let total = 0;
    document.querySelectorAll("#itens tr").forEach(tr => {
        const qtd = parseFloat(tr.querySelector(".qtd").value) || 0;
        const unitario = parseFloat(tr.querySelector(".unitario").value) || 0;
        const subtotal = qtd * unitario;
        tr.querySelector(".valorTotal").innerText = subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        total += subtotal;
    });
    totalGeral.innerText = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// BUSCA OS ITENS DO FORMULÁRIO COMO UM ARRAY CORRETO
function obterItensDoFormulario() {
    const listaItens = [];
    document.querySelectorAll("#itens tr").forEach(tr => {
        const qtd = parseFloat(tr.querySelector(".qtd").value) || 1;
        const unidade = tr.querySelector(".unidade") ? tr.querySelector(".unidade").value : "un";
        const desc = tr.querySelector(".descricao").value;
        const unit = parseFloat(tr.querySelector(".unitario").value) || 0;
        const tot = tr.querySelector(".valorTotal").innerText;
        if (desc) {
            listaItens.push({ qtd: qtd, unidade: unidade, descricao: desc, unitario: unit, totalItem: tot });
        }
    });
    return listaItens;
}

// LIMPA OS CAMPOS DA TELA
function limparFormulario() {
    idPedidoEmEdicao = null;
    document.getElementById("cliente").value = "";
    document.getElementById("telefone").value = "";
    document.getElementById("endereco").value = "";
    document.getElementById("cidade").value = "Belo Horizonte";
    document.getElementById("data").value = new Date().toISOString().split('T')[0];
    document.getElementById("tipo").value = "Orçamento";
    document.getElementById("entrada").value = "";
    document.getElementById("pagamento").value = "";
    document.getElementById("observacoes").value = "";
    itensBody.innerHTML = "";
    
    if(document.getElementById("atualizarPedido")) {
        document.getElementById("atualizarPedido").style.display = "none";
    }
    document.getElementById("salvarPedido").innerText = "Salvar Novo Pedido";
    
    adicionarItem();
}

// SALVAR NOVO PEDIDO
document.getElementById("salvarPedido").addEventListener("click", async () => {
    const cliente = document.getElementById("cliente").value;
    if (!cliente) { alert("Informe o cliente."); return; }

    const numeroPedido = Math.floor(Date.now() / 1000).toString().slice(-5);
    const pedido = {
        numero: numeroPedido,
        cliente: cliente,
        telefone: document.getElementById("telefone").value,
        endereco: document.getElementById("endereco").value,
        cidade: document.getElementById("cidade").value,
        data: document.getElementById("data").value,
        tipo: document.getElementById("tipo").value,
        entrada: document.getElementById("entrada").value,
        formaPagamento: document.getElementById("pagamento").value,
        observacoes: document.getElementById("observacoes").value,
        total: totalGeral.innerText,
        itens: obterItensDoFormulario(),
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("pedidos").add(pedido);
        alert("Salvo com sucesso!");
        limparFormulario();
        carregarHistorico();
    } catch (error) {
        alert("Erro ao salvar.");
    }
});

// SALVAR ALTERAÇÕES EM PEDIDO EXISTENTE
if(document.getElementById("atualizarPedido")) {
    document.getElementById("atualizarPedido").addEventListener("click", async () => {
        if (!idPedidoEmEdicao) return;
        const cliente = document.getElementById("cliente").value;
        if (!cliente) { alert("Informe o cliente."); return; }

        try {
            await db.collection("pedidos").doc(idPedidoEmEdicao).update({
                cliente: cliente,
                telefone: document.getElementById("telefone").value,
                endereco: document.getElementById("endereco").value,
                cidade: document.getElementById("cidade").value,
                data: document.getElementById("data").value,
                tipo: document.getElementById("tipo").value,
                entrada: document.getElementById("entrada").value,
                formaPagamento: document.getElementById("pagamento").value,
                observacoes: document.getElementById("observacoes").value,
                total: totalGeral.innerText,
                itens: obterItensDoFormulario()
            });
            alert("Atualizado com sucesso!");
            limparFormulario();
            carregarHistorico();
        } catch (error) {
            alert("Erro ao atualizar.");
        }
    });
}

// PUXAR DADOS DO HISTÓRICO PARA A TELA AO CLICAR
async function carregarPedidoParaEdicao(idDocumento) {
    try {
        const doc = await db.collection("pedidos").doc(idDocumento).get();
        if (!doc.exists) { alert("Documento não encontrado."); return; }
        
        const pedido = doc.data();
        idPedidoEmEdicao = idDocumento;

        document.getElementById("cliente").value = pedido.cliente || "";
        document.getElementById("telefone").value = pedido.telefone || "";
        document.getElementById("endereco").value = pedido.endereco || "";
        document.getElementById("cidade").value = pedido.cidade || "Belo Horizonte";
        document.getElementById("data").value = pedido.data || "";
        document.getElementById("tipo").value = pedido.tipo || "Orçamento";
        document.getElementById("entrada").value = pedido.entrada || "";
        document.getElementById("pagamento").value = pedido.formaPagamento || pedido.pagamento || "";
        document.getElementById("observacoes").value = pedido.observacoes || "";

        itensBody.innerHTML = "";
        if (pedido.itens && Array.isArray(pedido.itens) && pedido.itens.length > 0) {
            pedido.itens.forEach(item => {
                adicionarItem(item.qtd, item.unidade, item.descricao, item.unitario, false);
            });
        } else {
            adicionarItem();
        }

        if(document.getElementById("atualizarPedido")) {
            document.getElementById("atualizarPedido").style.display = "inline-block";
        }
        document.getElementById("salvarPedido").innerText = "Salvar como Novo (Clonar)";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error(error);
        alert("Erro ao carregar os dados.");
    }
}

// BUSCAR HISTÓRICO ATUALIZADO
function carregarHistorico() {
    const historico = document.getElementById("historico");
    if (!historico) return;
    historico.innerHTML = "";
    
    db.collection("pedidos").orderBy("criadoEm", "desc").get().then((snapshot) => {
        snapshot.forEach((doc) => {
            const pedido = doc.data();
            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";
            
            tr.innerHTML = `
                <td class="col-clicavel">${pedido.numero || '---'}</td>
                <td class="col-clicavel"><strong>${pedido.cliente}</strong></td>
                <td class="col-clicavel">${pedido.data}</td>
                <td class="col-clicavel">${pedido.total}</td>
                <td>
                    <button class="btn-pdf" data-id="${doc.id}" style="background:#007bff;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;margin-right:5px;">Ver PDF</button>
                    <button class="btn-excluir" data-id="${doc.id}" style="background:#ff4d4d;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">Excluir</button>
                </td>
            `;

            tr.querySelectorAll(".col-clicavel").forEach(td => {
                td.addEventListener("click", () => carregarPedidoParaEdicao(doc.id));
            });

            tr.querySelector(".btn-pdf").addEventListener("click", (e) => {
                e.stopPropagation();
                if(typeof visualizarPedidoPdf === "function") {
                    visualizarPedidoPdf(doc.id);
                }
            });
            tr.querySelector(".btn-excluir").addEventListener("click", (e) => {
                e.stopPropagation();
                excluirPedido(doc.id);
            });

            historico.appendChild(tr);
        });
    }).catch(err => {
        console.log("Erro ao carregar histórico:", err);
    });
}

// EXCLUIR REGISTRO
async function excluirPedido(idDocumento) {
    if (confirm("Deseja excluir definitivamente?")) {
        await db.collection("pedidos").doc(idDocumento).delete();
        alert("Excluído com sucesso.");
        limparFormulario();
        carregarHistorico();
    }
}

// NOVO BOTÃO WHATSAPP ATUALIZADO: SUPORTA ORÇAMENTOS, PEDIDOS E RECIBOS COM SUA LOGO
document.getElementById("enviarWhats").addEventListener("click", async () => {
    const cliente = document.getElementById("cliente").value;
    const telefoneRaw = document.getElementById("telefone").value.replace(/\D/g, "");
    const tipo = document.getElementById("tipo").value;
    const data = document.getElementById("data").value;
    const total = totalGeral.innerText;
    const itens = obterItensDoFormulario();

    if (!cliente) { alert("Informe o cliente antes de enviar."); return; }
    if (itens.length === 0) { alert("Adicione ao menos um item."); return; }

    const botao = document.getElementById("enviarWhats");
    const textoOriginal = botao.innerText;
    botao.innerText = "Processando PDF...";
    botao.disabled = true;

    try {
        // Correção do construtor jsPDF para carregar no escopo do app.js
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const dadosPedido = {
            numero: Math.floor(Date.now() / 1000).toString().slice(-5),
            cliente, 
            telefone: document.getElementById("telefone").value,
            endereco: document.getElementById("endereco").value,
            cidade: document.getElementById("cidade").value,
            data, tipo, total, itens,
            entrada: document.getElementById("entrada").value || "R$ 0,00",
            formaPagamento: document.getElementById("pagamento").value || "---",
            observacoes: document.getElementById("observacoes").value
        };

        // Renderiza o desenho idêntico usando a função do seu arquivo pdf.js
        const carregarLogoEDesenhar = () => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                // Usa o arquivo local da pasta assets (mesma logo do cabeçalho do site)
                img.src = "assets/logo.png";
                
                img.onload = () => {
                    desenharConteudo(doc, img, dadosPedido, false);
                    resolve();
                };
                img.onerror = () => {
                    desenharConteudo(doc, null, dadosPedido, false);
                    resolve();
                };
            });
        };

        await carregarLogoEDesenhar();

        // Envia o PDF para o Firebase Storage
        const pdfBlob = doc.output('blob');
        const nomeArquivo = `pdfs/${dadosPedido.numero}_${Date.now()}.pdf`;
        const storageRef = storage.ref().child(nomeArquivo);

        const snapshot = await storageRef.put(pdfBlob);
        const urlPublicaPdf = await snapshot.ref.getDownloadURL();

        // Salva os registros completos no Firestore
        dadosPedido.urlPdf = urlPublicaPdf;
        dadosPedido.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection("pedidos").add(dadosPedido);

        // Monta texto dinâmico dependendo do tipo (Orçamento, Pedido ou Recibo)
        let mensagem = `Olá ${cliente}! Segue o link do seu *${tipo}* da MT Divisórias:\n\n`;
        mensagem += `*Resumo:*\n`;
        itens.forEach(item => {
            const qtdUnidade = `${item.qtd}${item.unidade ? ' ' + item.unidade : ''}`;
            mensagem += `• ${qtdUnidade} de ${item.descricao} - ${item.totalItem}\n`;
        });
        mensagem += `\n*Total Geral: ${total}*\n`;
        
        if (tipo === "Recibo" && dadosPedido.entrada !== "R$ 0,00") {
            mensagem += `*Valor Recebido: ${dadosPedido.entrada}*\n`;
        }
        
        mensagem += `\n👉 Clique no link para abrir o PDF original:\n${urlPublicaPdf}`;

        let link;
        if (telefoneRaw) {
            const numeroCompleto = telefoneRaw.length <= 11 ? `55${telefoneRaw}` : telefoneRaw;
            link = `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(mensagem)}`;
        } else {
            link = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
        }

        window.open(link, "_blank");
        carregarHistorico();

    } catch (error) {
        console.error(error);
        alert("Erro ao processar o arquivo.");
    } finally {
        botao.innerText = textoOriginal;
        botao.disabled = false;
    }
});
// CONTROLE DOS NOVOS BOTÕES DE SELEÇÃO (ORÇAMENTO / PEDIDO / RECIBO)
const btnOrcamento = document.getElementById("btnTipoOrcamento");
const btnPedido = document.getElementById("btnTipoPedido");
const btnRecibo = document.getElementById("btnTipoRecibo");
const inputTipo = document.getElementById("tipo");

function alternarTipoDocumento(tipoSelecionado) {
    // Atualiza o valor do input oculto que o restante do sistema lê
    inputTipo.value = tipoSelecionado;

    // Reseta o visual de todos os botões para o estado inativo
    [btnOrcamento, btnPedido, btnRecibo].forEach(btn => {
        if(btn) btn.classList.remove("ativo");
    });

    // Aplica o visual ativo no botão clicado
    let btnAtivo = btnOrcamento;
    if (tipoSelecionado === "Pedido") btnAtivo = btnPedido;
    if (tipoSelecionado === "Recibo") btnAtivo = btnRecibo;

    if(btnAtivo) btnAtivo.classList.add("ativo");
    }

    // Vincula os eventos de clique aos botões do cabeçalho
    if(btnOrcamento) btnOrcamento.addEventListener("click", () => alternarTipoDocumento("Orçamento"));
    if(btnPedido) btnPedido.addEventListener("click", () => alternarTipoDocumento("Pedido"));
    if(btnRecibo) btnRecibo.addEventListener("click", () => alternarTipoDocumento("Recibo"));

    // Modifique sua função limparFormulario() existente para resetar os botões visualmente também
    const funcaoLimparOriginal = limparFormulario;
    limparFormulario = function() {
        funcaoLimparOriginal();
        alternarTipoDocumento("Orçamento"); // Volta o botão para Orçamento por padrão ao limpar
    }
