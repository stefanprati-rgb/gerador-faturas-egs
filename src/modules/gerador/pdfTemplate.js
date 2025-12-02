/**
 * Template PDF para faturas EGS
 */

export function getPDFTemplate() {
  return `
    <div id="pdf-container" style="position:fixed; left:-9999px; top:0; width:210mm; min-height:297mm; z-index:-1;">
      <div id="pdf-page" style="width:210mm;height:297mm;background:#fff;color:#0B1220;padding:18mm 14mm;display:flex;flex-direction:column;font-family:'Poppins',sans-serif; font-size:10.5px; line-height:1.25; box-sizing:border-box; overflow:hidden; margin:0 auto;">
        
        <!-- Cabeçalho -->
        <header class="flex justify-between items-start" style="margin-bottom:6mm;">
          <div style="display:flex; flex-direction:column; gap:4mm; max-width:120mm;">
            <div style="font-weight:700; font-size:34px; letter-spacing:0.5px; text-align:left;">EGS ENERGIA</div>
            <div id="pdf-titulo-p1" style="font-weight:600; font-size:13px; text-align:left;">
              Sua contribuição de [Mês] chegou
            </div>
          </div>
        
          <div class="text-right" style="font-size:10px; max-width:72mm;">
            <p id="pdf-nome-cliente-p1" class="font-bold" style="font-size:12px;">[Nome Cliente]</p>
            <p id="pdf-cpf-p1" class="text-gray-600">[CPF/CNPJ]</p>
            <p id="pdf-endereco-p1" class="text-gray-600">[Endereço]</p>
            <p class="mt-1">Código Instalação: <span id="pdf-instalacao-p1" class="font-bold">[Instalação]</span></p>
            <p>Número da conta: <span id="pdf-numconta-p1" class="font-bold">[Num Conta]</span></p>
            <p>Emissão: <span id="pdf-emissao-p1" class="font-bold">[Emissão]</span></p>
          </div>
        </header>
    
        <!-- Faixa superior: Total + Indicadores -->
        <section style="display:grid; grid-template-columns: 1.2fr 1fr; gap:8mm; align-items:start; margin-bottom:6mm;">
          <div class="p-6 rounded-xl" style="background:#12123B; color:#fff;">
            <p style="font-size:12px;">Total a pagar</p>
            <p id="pdf-total-pagar" class="font-bold" style="font-size:34px; margin:6px 0 8px;">R$ 0,00</p>
            <p style="font-size:10px;">Data de vencimento</p>
            <p id="pdf-vencimento-p1" style="font-size:12px; font-weight:600;">[Data]</p>
          </div>
        
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5mm;">
            <div class="p-3 rounded-lg" style="background:#12123B; color:#fff;">
              <p id="pdf-economia-mes" class="font-bold" style="font-size:16px;">R$ 0,00</p>
              <p style="opacity:.9;">Economia Mês</p>
            </div>
            <div class="p-3 rounded-lg" style="background:#12123B; color:#fff;">
              <p id="pdf-economia-acumulada" class="font-bold" style="font-size:16px;">R$ 0,00</p>
              <p style="opacity:.9;">Economia acumulada</p>
            </div>
            <div class="p-3 rounded-lg" style="background:#12123B; color:#fff;">
              <p id="pdf-arvores" class="font-bold" style="font-size:16px;">0,00</p>
              <p style="opacity:.9;">Árvores preservadas</p>
            </div>
            <div class="p-3 rounded-lg" style="background:#12123B; color:#fff;">
              <p id="pdf-co2" class="font-bold" style="font-size:16px;">0,00 kg</p>
              <p style="opacity:.9;">CO2 poupados</p>
            </div>
          </div>
        </section>
        
        <!-- RESUMO DE ECONOMIA -->
        <section id="pdf-resumo-economia" style="margin:6mm 0 6mm 0;">
          <div class="rounded-lg" style="background:#F3F4F6; padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <div style="font-weight:700; font-size:12px;">Resumo da sua economia</div>
              <div style="text-align:right;">
                <div style="font-size:18px; font-weight:800; color:#16A34A;">
                  <span id="pdf-econ-mes-valor">R$ 0,00</span>
                </div>
                <div style="font-size:10px; color:#374151; margin-top:2px;">
                  Sem GD: <span id="pdf-econ-sem-gd">R$ 0,00</span> &nbsp; • &nbsp;
                  Com GD: <span id="pdf-econ-com-gd">R$ 0,00</span>
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
                  <td id="pdf-det-credito-qtd" class="text-right" style="padding:5px 4px;"></td>
                  <td id="pdf-det-credito-tar" class="text-right" style="padding:5px 4px;"></td>
                  <td id="pdf-det-credito-total" class="text-right" style="padding:5px 4px; font-weight:600;"></td>
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
                  <td id="pdf-det-total-contrib" class="text-right" style="padding:5px 4px; font-weight:700;"></td>
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
                  <td id="pdf-dist-consumo-qtd" class="text-right" style="padding:5px 4px;"></td>
                  <td id="pdf-dist-consumo-tar" class="text-right" style="padding:5px 4px;"></td>
                  <td id="pdf-dist-consumo-total" class="text-right" style="padding:5px 4px;"></td>
                </tr>
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:5px 4px;">Energia Compensada</td>
                  <td id="pdf-dist-comp-qtd" class="text-right" style="padding:5px 4px;"></td>
                  <td id="pdf-dist-comp-tar" class="text-right" style="padding:5px 4px;"></td>
                  <td id="pdf-dist-comp-total" class="text-right" style="padding:5px 4px;"></td>
                </tr>
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:5px 4px;">Contrib. Ilum. Pública e Outros</td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td id="pdf-dist-outros" class="text-right" style="padding:5px 4px;"></td>
                </tr>
                <tr style="background:#F3F4F6;">
                  <td style="padding:5px 4px; font-weight:700;">Total a pagar na sua fatura da distribuidora</td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td class="text-right" style="padding:5px 4px;"></td>
                  <td id="pdf-dist-total" class="text-right" style="padding:5px 4px; font-weight:700;"></td>
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
                <span id="pdf-econ-total-sem" class="font-bold" style="font-size:12px;">R$ 0,00</span><br>
                <span class="text-gray-600">(Tarifa <span id="pdf-econ-tarifa-dist"></span> x Qtd. <span id="pdf-econ-qtd-dist"></span>) + Outros <span id="pdf-econ-outros"></span></span>
              </div>
            </div>
        
            <div class="rounded-lg" style="background:#F3F4F6; padding:8px 10px; display:flex; justify-content:space-between; align-items:baseline;">
              <div class="font-bold">Com EGS</div>
              <div class="text-right">
                <span id="pdf-econ-total-com" class="font-bold" style="font-size:12px;">R$ 0,00</span><br>
                <span id="pdf-econ-exp-ev" class="text-gray-600"></span>
              </div>
            </div>
          </div>
        
          <div class="rounded-lg text-center" style="background:#12123B; color:#fff; padding:10px;">
            <p class="font-bold" style="font-size:12px;">Sua economia neste mês</p>
            <p id="pdf-econ-economia-final" class="font-bold" style="font-size:18px;">R$ 0,00</p>
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
                    <td id="pdf-ref-foot" style="padding:5px 4px;">[Ref]</td>
                    <td id="pdf-valor-foot" style="padding:5px 4px;">[Valor]</td>
                    <td id="pdf-venc-foot" style="padding:5px 4px;">[Venc]</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div style="margin-top:4mm;">
            <div class="rounded-lg" style="background:#F3F4F6; padding:8px 10px; display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:6px; font-size:10.5px; color:#0B1220;">
                <i class="fa-solid fa-envelope" aria-hidden="true" style="font-size:12px; color:#12123B;"></i>
                <span><strong>E-mail:</strong> atendimento@egsenergia.com.br</span>
              </div>
              <div style="width:1px; height:14px; background:#D1D5DB;"></div>
              <div style="display:flex; align-items:center; gap:6px; font-size:10.5px; color:#0B1220;">
                <i class="fa-brands fa-whatsapp" aria-hidden="true" style="font-size:12px; color:#16A34A;"></i>
                <span><strong>WhatsApp:</strong> (11) 99670-3826</span>
              </div>
            </div>
          </div>
        </footer>
    
      </div>
    </div>
  `;
}
