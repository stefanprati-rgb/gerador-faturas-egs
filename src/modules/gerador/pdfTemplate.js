/**
 * Template PDF para faturas EGS (Server-Side)
 * Retorna HTML completo para geração via Puppeteer
 */

export function getPDFTemplate(data) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { 
          font-family: 'Poppins', sans-serif; 
          margin: 0;
          padding: 0;
          background: #fff;
          color: #0B1220;
        }
        @page { size: A4; margin: 0; }
        .font-bold { font-weight: 700; }
        .text-right { text-align: right; }
        .text-gray-600 { color: #4B5563; }
      </style>
    </head>
    <body class="p-0 m-0 bg-white">
      <div id="pdf-page" style="width:210mm;min-height:297mm;background:#fff;padding:12mm 14mm 10mm 14mm;display:flex;flex-direction:column;font-size:10.5px;line-height:1.25;box-sizing:border-box;">
        
        <!-- Cabeçalho -->
        <header class="flex justify-between items-start" style="margin-bottom:6mm;">
          <div style="display:flex; flex-direction:column; gap:4mm; max-width:120mm;">
            <div style="font-weight:700; font-size:34px; letter-spacing:0.5px; text-align:left;">EGS ENERGIA</div>
            <div style="font-weight:600; font-size:13px; text-align:left;">
              ${data.titulo_p1}
            </div>
          </div>
        
          <div class="text-right" style="font-size:10px; max-width:72mm;">
            <p class="font-bold" style="font-size:12px;">${data.nome_cliente_p1}</p>
            <p class="text-gray-600">${data.cpf_p1}</p>
            <p class="text-gray-600">${data.endereco_p1}</p>
            <p class="mt-1">Código Instalação: <span class="font-bold">${data.instalacao_p1}</span></p>
            <p>Número da conta: <span class="font-bold">${data.numconta_p1}</span></p>
            <p>Emissão: <span class="font-bold">${data.emissao_p1}</span></p>
          </div>
        </header>

        <!-- Faixa superior: Total + Indicadores -->
        <section style="display:grid; grid-template-columns: 1.2fr 1fr; gap:8mm; align-items:start; margin-bottom:6mm;">
          <!-- Left box -->
          <div class="p-6 rounded-xl" style="background:#12123B; color:#fff;">
            <p style="font-size:12px;">Total a pagar</p>
            <p class="font-bold" style="font-size:34px; margin:6px 0 8px;">${data.total_pagar}</p>
            <p style="font-size:10px;">Data de vencimento</p>
            <p style="font-size:12px; font-weight:600;">${data.vencimento_p1}</p>
          </div>
          
          <!-- Indicators -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5mm;">
            <div class="p-3 rounded-lg" style="background:#12123B; color:#fff;">
              <p class="font-bold" style="font-size:16px;">${data.economia_mes}</p>
              <p style="opacity:.9;">Economia Mês</p>
            </div>
            <div class="p-3 rounded-lg" style="background:#12123B; color:#fff;">
              <p class="font-bold" style="font-size:16px;">${data.economia_acumulada}</p>
              <p style="opacity:.9;">Economia acumulada</p>
            </div>
            <div class="p-3 rounded-lg" style="background:#12123B; color:#fff;">
              <p class="font-bold" style="font-size:16px;">${data.arvores}</p>
              <p style="opacity:.9;">Árvores preservadas</p>
            </div>
            <div class="p-3 rounded-lg" style="background:#12123B; color:#fff;">
              <p class="font-bold" style="font-size:16px;">${data.co2}</p>
              <p style="opacity:.9;">CO2 poupados</p>
            </div>
          </div>
        </section>
        
        <!-- RESUMO DE ECONOMIA -->
        <section style="margin:6mm 0 6mm 0;">
          <div class="rounded-lg" style="background:#F3F4F6; padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <div style="font-weight:700; font-size:12px;">Resumo da sua economia</div>
              <div style="text-align:right;">
                <div style="font-size:18px; font-weight:800; color:#16A34A;">
                  <span>${data.econ_mes_valor}</span>
                </div>
                <div style="font-size:10px; color:#374151; margin-top:2px;">
                  Sem GD: <span>${data.econ_sem_gd}</span> &nbsp; • &nbsp;
                  Com GD: <span>${data.econ_com_gd}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
    
        <!-- Duas tabelas lado a lado -->
        <section style="display:grid; grid-template-columns: 1fr 1fr; gap:8mm; margin-bottom:6mm; font-size:10px;">
          <!-- Detalhamento Contribuição -->
          <div>
            <h2 class="font-bold" style="font-size:11px; margin-bottom:2mm;">Como calculamos sua contribuição</h2>
            <table class="w-full" style="width:100%; border-collapse:collapse;">
              <colgroup>
                <col style="width:44%"><col style="width:16%"><col style="width:20%"><col style="width:20%">
              </colgroup>
              <thead>
                <tr style="border-bottom:1px solid #D1D5DB;">
                  <th class="text-left" style="padding:6px 4px;">Descrição</th>
                  <th class="text-right" style="padding:6px 4px;">Quantidade</th>
                  <th class="text-right" style="padding:6px 4px;">Tarifa de referência</th>
                  <th class="text-right" style="padding:6px 4px;">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:5px 4px;">Crédito de Energia</td>
                  <td class="text-right" style="padding:5px 4px;">${data.det_credito_qtd}</td>
                  <td class="text-right" style="padding:5px 4px;">${data.det_credito_tar}</td>
                  <td class="text-right" style="padding:5px 4px; font-weight:600;">${data.det_credito_total}</td>
                </tr>
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:5px 4px;">Desconto extra</td>
                  <td class="text-right" style="padding:5px 4px;">0,00</td>
                  <td class="text-right" style="padding:5px 4px;">R$ 0,00</td>
                  <td class="text-right" style="padding:5px 4px; font-weight:600;">R$ 0,00</td>
                </tr>
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:5px 4px;">Ajuste retroativo</td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td class="text-right" style="padding:5px 4px; font-weight:600;">R$ 0,00</td>
                </tr>
                <tr style="background:#F3F4F6;">
                  <td style="padding:5px 4px; font-weight:700;">Total da sua contribuição</td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td class="text-right" style="padding:5px 4px; font-weight:700;">${data.det_total_contrib}</td>
                </tr>
              </tbody>
            </table>
          </div>
    
          <!-- Distribuidora -->
          <div>
            <h2 class="font-bold" style="font-size:11px; margin-bottom:2mm;">Como ficou sua conta da distribuidora</h2>
            <table class="w-full" style="width:100%; border-collapse:collapse; margin-bottom:4mm;">
              <colgroup>
                <col style="width:44%"><col style="width:16%"><col style="width:20%"><col style="width:20%">
              </colgroup>
              <thead>
                <tr style="border-bottom:1px solid #D1D5DB;">
                  <th class="text-left" style="padding:6px 4px;">Descrição</th>
                  <th class="text-right" style="padding:6px 4px;">Quantidade</th>
                  <th class="text-right" style="padding:6px 4px;">Tarifa</th>
                  <th class="text-right" style="padding:6px 4px;">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:5px 4px;">Energia Consumida</td>
                  <td class="text-right" style="padding:5px 4px;">${data.dist_consumo_qtd}</td>
                  <td class="text-right" style="padding:5px 4px;">${data.dist_consumo_tar}</td>
                  <td class="text-right" style="padding:5px 4px;">${data.dist_consumo_total}</td>
                </tr>
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:5px 4px;">Energia Compensada</td>
                  <td class="text-right" style="padding:5px 4px;">${data.dist_comp_qtd}</td>
                  <td class="text-right" style="padding:5px 4px;">${data.dist_comp_tar}</td>
                  <td class="text-right" style="padding:5px 4px;">${data.dist_comp_total}</td>
                </tr>
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:5px 4px;">Contrib. Ilum. Pública e Outros</td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td class="text-right" style="padding:5px 4px;">${data.dist_outros}</td>
                </tr>
                <tr style="background:#F3F4F6;">
                  <td style="padding:5px 4px; font-weight:700;">Total a pagar na sua fatura da distribuidora</td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td class="text-right" style="padding:5px 4px; font-weight:700;">${data.dist_total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
  
        <!-- Quadros de comparação -->
        <section style="margin-bottom:6mm;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5mm; margin-bottom:5mm;">
            <div class="rounded-lg" style="background:#F3F4F6; padding:8px 10px; display:flex; justify-content:space-between; align-items:baseline;">
              <div class="font-bold">Se fosse só distribuidora</div>
              <div class="text-right">
                <span class="font-bold" style="font-size:12px;">${data.econ_total_sem}</span><br>
                <span class="text-gray-600">(Tarifa <span>${data.econ_tarifa_dist}</span> x Qtd. <span>${data.econ_qtd_dist}</span>) + Outros <span>${data.econ_outros}</span></span>
              </div>
            </div>
        
            <div class="rounded-lg" style="background:#F3F4F6; padding:8px 10px; display:flex; justify-content:space-between; align-items:baseline;">
              <div class="font-bold">Com EGS</div>
              <div class="text-right">
                <span class="font-bold" style="font-size:12px;">${data.econ_total_com}</span><br>
                <span class="text-gray-600">${data.econ_exp_ev}</span>
              </div>
            </div>
          </div>
        
          <div class="rounded-lg text-center" style="background:#12123B; color:#fff; padding:10px;">
            <p class="font-bold" style="font-size:12px;">Sua economia neste mês</p>
            <p class="font-bold" style="font-size:18px;">${data.econ_economia_final}</p>
          </div>
        </section>
    
        <!-- Rodapé -->
        <footer style="margin-top:auto; font-size:9.5px; color:#6B7280;">
          <div class="p-2 rounded-lg font-bold text-white text-center" style="background:#12123B; margin-bottom:6px;">
            Atenção! Você ainda precisa pagar a conta da distribuidora.
          </div>
          <div class="text-center font-bold" style="color:#DC2626; margin-bottom:6mm; font-size:10px;">
            Boletos são expirados após 10 dias corridos do vencimento.
          </div>
        
          <div style="display:grid; grid-template-columns: 1fr; gap:8mm; align-items:start; margin-bottom:6mm;">
            <div>
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:1px solid #D1D5DB;">
                    <th class="text-left" style="padding:6px 4px; font-weight:600;">Referência</th>
                    <th class="text-left" style="padding:6px 4px; font-weight:600;">Valor</th>
                    <th class="text-left" style="padding:6px 4px; font-weight:600;">Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:5px 4px;">${data.ref_foot}</td>
                    <td style="padding:5px 4px;">${data.valor_foot}</td>
                    <td style="padding:5px 4px;">${data.venc_foot}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div style="margin-top:4mm;">
            <div class="rounded-lg" style="background:#F3F4F6; padding:8px 10px; display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:6px; font-size:10.5px; color:#0B1220;">
                <span><strong>E-mail:</strong> atendimento@egsenergia.com.br</span>
              </div>
              <div style="width:1px; height:14px; background:#D1D5DB;"></div>
              <div style="display:flex; align-items:center; gap:6px; font-size:10.5px; color:#0B1220;">
                 <span><strong>WhatsApp:</strong> (11) 99670-3826</span>
              </div>
            </div>
          </div>
        </footer>
    
      </div>
    </body>
    </html>
  `;
}
